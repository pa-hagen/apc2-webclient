import React, { useLayoutEffect, useRef, useState } from 'react';
import AssetPanel from './AssetPanel.jsx';

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

const MAX_ROWS = 50;
const ROW_H    = 36;

function ImageLink({ httpBase, seq, label }) {
  if (seq == null || !httpBase) return <>{label || '—'}</>;
  return (
    <a href={`${httpBase}/image?seq=${seq}`} download title="download full image">
      {label || `seq ${seq}`}
    </a>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2H2.5A.5.5 0 002 2.5v7a.5.5 0 00.5.5h7a.5.5 0 00.5-.5V7" />
      <path d="M7 2h3v3M10 2L5.5 6.5" />
    </svg>
  );
}

export default function CapturesSection({ rows = [], images = {}, httpBase = '', pinnedSeq, setPinnedSeq, assets = [], currentMastSlId = null, simulating, stopSim, startSim }) {
  const [page, setPage]         = useState(0);
  const [pageSize, setPageSize] = useState(5);

  const capturesRef    = useRef(null);
  const sectionHeadRef = useRef(null);
  const paginationRef  = useRef(null);

  useLayoutEffect(() => {
    const el = capturesRef.current;
    if (!el) return;
    const compute = () => {
      const total  = el.offsetHeight;
      const headH  = sectionHeadRef.current?.offsetHeight ?? 28;
      const pagH   = paginationRef.current?.offsetHeight  ?? 28;
      const theadH = 28;
      const avail  = total - headH - theadH - pagH;
      setPageSize(Math.max(1, Math.floor(avail / ROW_H)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const prevFirstSeq = useRef(null);
  React.useEffect(() => {
    const first = rows[0]?.seq ?? null;
    if (first !== prevFirstSeq.current) { prevFirstSeq.current = first; setPage(0); }
  }, [rows]);

  const displayRows = rows.slice(0, MAX_ROWS);
  const totalPages  = Math.max(1, Math.ceil(displayRows.length / pageSize));
  const pageRows    = displayRows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="captures-section">
      <div className="captures-main" ref={capturesRef}>
        <div className="section-head" ref={sectionHeadRef}>
          <h3>Captures ({displayRows.length}{rows.length > MAX_ROWS ? `/${rows.length}` : ''})</h3>
          <button
            onClick={simulating ? stopSim : startSim}
            title={simulating ? 'Stop mast ID simulation' : 'Simulate mast ID (random, 5s interval)'}
            style={{ fontSize: '0.75rem', padding: '2px 8px', ...(simulating ? { background: '#e53e3e', color: '#fff', borderColor: '#e53e3e' } : {}) }}
          >
            {simulating ? 'Stop Sim' : 'Sim Mast'}
          </button>
          <button
            className="icon-btn"
            onClick={() => window.open(`${location.pathname}?view=captures`, '_blank')}
            title="Open in new tab"
          >
            <ExternalLinkIcon />
          </button>
        </div>

        <div className="records records--fill">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>time</th>
                <th>file / error</th>
                <th>SL_ID</th>
                <th>asset ID</th>
                <th>name</th>
                <th>group</th>
                <th>ISO</th>
                <th>shutter</th>
                <th>f-stop</th>
                <th>focus</th>
                <th>settled</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const img      = images[row.seq];
                const isPinned = pinnedSeq === row.seq;
                return (
                  <tr
                    key={row.seq}
                    className={`cap-row ${row.success === true ? 'ok' : row.success === false ? 'fail' : ''} ${row.drift ? 'drift' : ''} ${isPinned ? 'pinned' : ''}`}
                    onClick={() => setPinnedSeq(row.seq)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="thumb-cell">
                      {httpBase && row.success !== false && img?.ts > 0 && (
                        <img
                          key={img.ts}
                          src={`${httpBase}/thumbnail?seq=${row.seq}&v=${img.ts}`}
                          alt=""
                          className="table-thumb"
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
                    <td>{row.asset_sl_id ?? '—'}</td>
                    <td style={{ maxWidth: '6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.asset_id ?? undefined}>{row.asset_id ?? '—'}</td>
                    <td style={{ maxWidth: '8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.asset_name ?? undefined}>{row.asset_name ?? '—'}</td>
                    <td style={{ maxWidth: '6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.asset_group ?? undefined}>{row.asset_group ?? '—'}</td>
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

        <div className="pagination" ref={paginationRef}>
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
          <span>{page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>›</button>
        </div>
      </div>

      <AssetPanel assets={assets} httpBase={httpBase} currentMastSlId={currentMastSlId} />
    </div>
  );
}
