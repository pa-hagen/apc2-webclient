import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
const ROW_H    = 36; // matches tbody tr height in CSS

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

function LiveViewOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function CenterPanel({ liveViewFrame, rows = [], images = {}, httpBase = '', pinnedSeq, setPinnedSeq, assets = [], currentMastSlId = null }) {
  const lastFrameAt = useRef(0);
  const [frameStale, setFrameStale] = useState(false);
  const [page, setPage]             = useState(0);
  const [liveH, setLiveH]           = useState(220);
  const [pageSize, setPageSize]     = useState(5);

  const capturesRef  = useRef(null);
  const sectionHeadRef = useRef(null);
  const paginationRef  = useRef(null);

  useEffect(() => { if (liveViewFrame) lastFrameAt.current = Date.now(); }, [liveViewFrame]);
  useEffect(() => {
    const id = setInterval(
      () => setFrameStale(lastFrameAt.current > 0 && Date.now() - lastFrameAt.current > 3000),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  // Reset page when a new capture arrives at the top
  const prevFirstSeq = useRef(null);
  useEffect(() => {
    const first = rows[0]?.seq ?? null;
    if (first !== prevFirstSeq.current) { prevFirstSeq.current = first; setPage(0); }
  }, [rows]);

  // Dynamically compute page size from available captures area height
  useLayoutEffect(() => {
    const el = capturesRef.current;
    if (!el) return;
    const compute = () => {
      const total  = el.offsetHeight;
      const headH  = sectionHeadRef.current?.offsetHeight  ?? 28;
      const pagH   = paginationRef.current?.offsetHeight   ?? 28;
      const theadH = 28;
      const avail  = total - headH - theadH - pagH;
      setPageSize(Math.max(1, Math.floor(avail / ROW_H)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draggable separator between live view and captures
  const onSepMouseDown = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = liveH;
    const onMove = (mv) => setLiveH(Math.max(80, startH + mv.clientY - startY));
    const onUp   = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const displayRows  = rows.slice(0, MAX_ROWS);
  const totalPages   = Math.max(1, Math.ceil(displayRows.length / pageSize));
  const pageRows     = displayRows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="center-layout">

      {/* ── Live view ── */}
      <div className="center-live" style={{ height: liveH }}>
        <div className="liveview-wrap">
          {liveViewFrame
            ? <img
                src={`data:image/jpeg;base64,${liveViewFrame}`}
                alt="live view"
                style={{ filter: frameStale ? 'grayscale(1)' : 'none', transition: 'filter 0.5s' }}
              />
            : <div className="liveview-placeholder" />
          }
          {(!liveViewFrame || frameStale) && (
            <div className="liveview-overlay"><LiveViewOffIcon /></div>
          )}
          {liveViewFrame && !frameStale && (
            <div className="liveview-live-badge">
              <span className="live-dot" />
              LIVE
            </div>
          )}
        </div>
      </div>

      {/* ── Drag separator ── */}
      <div className="center-sep" onMouseDown={onSepMouseDown} />

      {/* ── Captures ── */}
      <div className="center-captures" ref={capturesRef}>
        <div className="section-head" ref={sectionHeadRef}>
          <h3>Captures ({displayRows.length}{rows.length > MAX_ROWS ? `/${rows.length}` : ''})</h3>
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
                      {httpBase && img?.ts > 0 && (
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
