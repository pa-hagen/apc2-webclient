import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApc2Socket, defaultWsUrl, httpBaseFromWs } from './api/socket.js';

const time = (ts) => new Date(ts).toISOString().slice(11, 23);

function fmtShutter(s) {
  if (s == null || s <= 0) return '—';
  if (s >= 1) return `${Number.isInteger(s) ? s : s.toFixed(1)}s`;
  return `1/${Math.round(1 / s)}`;
}
function fmtFstop(f) {
  if (f == null) return '—';
  return `f/${f % 1 === 0 ? f : f.toFixed(1)}`;
}
function fmtFocus(m) {
  if (m == null) return '—';
  if (m >= 9999) return '∞';
  if (m < 10) return `${m.toFixed(1)}m`;
  return `${Math.round(m)}m`;
}

const ROW_H  = 44;
const TILE_W = 200;
const TILE_H = 186;

function ImageLink({ httpBase, seq, label }) {
  if (seq == null || !httpBase) return <>{label || '—'}</>;
  return <a href={`${httpBase}/image?seq=${seq}`} download title="download">{label || `seq ${seq}`}</a>;
}

function ListIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="3.5" x2="12" y2="3.5" /><line x1="4" y1="7" x2="12" y2="7" /><line x1="4" y1="10.5" x2="12" y2="10.5" />
      <circle cx="2" cy="3.5" r=".7" fill="currentColor" stroke="none" />
      <circle cx="2" cy="7"   r=".7" fill="currentColor" stroke="none" />
      <circle cx="2" cy="10.5" r=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TileIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="5" height="5" rx=".8" /><rect x="8" y="1" width="5" height="5" rx=".8" />
      <rect x="1" y="8" width="5" height="5" rx=".8" /><rect x="8" y="8" width="5" height="5" rx=".8" />
    </svg>
  );
}

export default function CapturesPage() {
  const url      = defaultWsUrl();
  const httpBase = httpBaseFromWs(url);
  const { status, captures, records, images, history } = useApc2Socket(url);

  const [mode, setMode]         = useState('list'); // 'list' | 'tile'
  const [page, setPage]         = useState(0);
  const [pageSize, setPageSize] = useState(15);

  const headerRef     = useRef(null);
  const paginationRef = useRef(null);

  const computePageSize = useCallback(() => {
    const headerH     = headerRef.current?.offsetHeight     ?? 42;
    const paginationH = paginationRef.current?.offsetHeight ?? 42;
    const available   = window.innerHeight - headerH - paginationH;
    if (mode === 'list') {
      const theadH = 33;
      setPageSize(Math.max(5, Math.floor((available - theadH) / ROW_H)));
    } else {
      const cols = Math.max(1, Math.floor(window.innerWidth / (TILE_W + 8)));
      const rows = Math.max(1, Math.floor(available / (TILE_H + 8)));
      setPageSize(cols * rows);
    }
  }, [mode]);

  useLayoutEffect(() => { computePageSize(); }, [computePageSize]);
  useEffect(() => {
    window.addEventListener('resize', computePageSize);
    return () => window.removeEventListener('resize', computePageSize);
  }, [computePageSize]);

  const rows = useMemo(() => {
    const bySeq = new Map();
    for (const h of history) bySeq.set(h.seq, { ...h });
    for (const c of captures) {
      const existing = bySeq.get(c.seq) || {};
      bySeq.set(c.seq, { ...existing, ts: c.ts, seq: c.seq, success: c.success, file: c.file, reason: c.reason, drift: c.drift, orphan: c.orphan });
    }
    for (const r of records) {
      const rec = r.record;
      const existing = bySeq.get(rec.seq) || { ts: r.ts, seq: rec.seq };
      bySeq.set(rec.seq, { ...existing, gimbal_yaw_abs_deg: rec.gimbal_yaw_abs_deg, gimbal_settled: rec.gimbal_settled });
    }
    return [...bySeq.values()].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
  }, [captures, records, history]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows   = rows.slice(page * pageSize, (page + 1) * pageSize);

  const prevFirstSeq = useRef(null);
  useEffect(() => {
    const first = rows[0]?.seq ?? null;
    if (first !== prevFirstSeq.current) { prevFirstSeq.current = first; setPage(0); }
  }, [rows]);

  return (
    <div className="captures-page">
      <div ref={headerRef} className="captures-page-header">
        <span className="title">Captures</span>
        <span className={`dot ${status === 'open' ? 'on' : status === 'connecting' ? 'warn' : 'off'}`} />
        <span style={{ color: 'var(--dim)' }}>{status}</span>
        <span style={{ flex: 1 }} />
        <div className="mode-toggle">
          <button className={mode === 'list' ? 'active' : ''} onClick={() => setMode('list')} title="List view"><ListIcon /></button>
          <button className={mode === 'tile' ? 'active' : ''} onClick={() => setMode('tile')} title="Tile view"><TileIcon /></button>
        </div>
        <span style={{ color: 'var(--dim)', marginLeft: 12 }}>{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="captures-page-table">
        {mode === 'list' ? (
          <div className="records">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 56 }}></th>
                  <th style={{ width: 88 }}>time</th>
                  <th>file / error</th>
                  <th style={{ width: 56 }}>ISO</th>
                  <th style={{ width: 72 }}>shutter</th>
                  <th style={{ width: 60 }}>f-stop</th>
                  <th style={{ width: 60 }}>focus</th>
                  <th style={{ width: 64 }}>settled</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const img = images[row.seq];
                  return (
                    <tr key={row.seq} className={`cap-row ${row.success === true ? 'ok' : row.success === false ? 'fail' : ''} ${row.drift ? 'drift' : ''}`}>
                      <td className="thumb-cell">
                        {httpBase && img?.ts > 0 && (
                          <img
                            key={img.ts}
                            src={`${httpBase}/thumbnail?seq=${row.seq}&v=${img.ts}`}
                            alt=""
                            className="table-thumb"
                            loading="lazy"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                      </td>
                      <td>{time(row.ts)}</td>
                      <td>
                        {row.success === true
                          ? <ImageLink httpBase={httpBase} seq={row.seq} label={img?.file || '…'} />
                          : <span style={{ color: 'var(--bad)' }}>{row.reason || (row.success === false ? 'failed' : '—')}</span>}
                      </td>
                      <td>{img?.iso ?? '—'}</td>
                      <td>{fmtShutter(img?.shutter)}</td>
                      <td>{fmtFstop(img?.fstop)}</td>
                      <td>{fmtFocus(img?.focus)}</td>
                      <td>
                        {row.gimbal_settled === false
                          ? <span className="badge bad">no</span>
                          : row.gimbal_settled === true
                            ? <span className="badge good">yes</span>
                            : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="captures-tiles">
            {pageRows.map((row) => {
              const img = images[row.seq];
              const ok  = row.success === true;
              const fail = row.success === false;
              return (
                <div key={row.seq} className={`tile ${ok ? 'ok' : fail ? 'fail' : ''}`}>
                  <div className="tile-thumb">
                    {httpBase && img?.ts > 0 && (
                      <img
                        key={img.ts}
                        src={`${httpBase}/thumbnail?seq=${row.seq}&v=${img.ts}`}
                        alt=""
                        className="tile-img"
                        loading="lazy"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    {fail && <div className="tile-fail-overlay">FAIL</div>}
                  </div>
                  <div className="tile-info">
                    <div className="tile-time">{time(row.ts)}</div>
                    <div className="tile-file">
                      {ok
                        ? <ImageLink httpBase={httpBase} seq={row.seq} label={img?.file || `seq ${row.seq}`} />
                        : <span style={{ color: 'var(--bad)' }}>{row.reason || 'failed'}</span>}
                    </div>
                    {img && (
                      <div className="tile-exif">
                        {img.iso != null && <span>ISO {img.iso}</span>}
                        {img.shutter != null && <span>{fmtShutter(img.shutter)}</span>}
                        {img.fstop != null && <span>{fmtFstop(img.fstop)}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div ref={paginationRef} className="captures-page-pagination">
        <button disabled={page === 0} onClick={() => setPage(0)}>«</button>
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
        <span>{page + 1} / {totalPages}</span>
        <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>›</button>
        <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
        <span style={{ marginLeft: 8 }}>{rows.length} total</span>
      </div>
    </div>
  );
}
