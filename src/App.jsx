import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApc2Socket, defaultWsUrl, httpBaseFromWs } from './api/socket.js';
import GcsPanel from './components/GcsPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import CenterPanel from './components/CenterPanel.jsx';
import LivePanel from './components/LivePanel.jsx';

const PANEL_LABELS = { left: 'Image Capture', center: 'Live', right: 'Monitor' };
const DEFAULT_ORDER = ['left', 'center', 'right'];

function loadOrder() {
  try {
    const s = JSON.parse(localStorage.getItem('apc2_panel_order'));
    if (Array.isArray(s) && s.length === 3) return s;
  } catch { /* ignore */ }
  return DEFAULT_ORDER;
}

function loadWidths() {
  try {
    const s = JSON.parse(localStorage.getItem('apc2_panel_widths'));
    if (s && typeof s === 'object') return s;
  } catch { /* ignore */ }
  return { left: 1, center: 1, right: 1 };
}

// ── Datastore Snapshot section (left panel, collapsed by default) ──────────
const fmtD = (v, d = 3) => (v == null || Number.isNaN(v) ? '—' : (typeof v === 'number' ? v.toFixed(d) : String(v)));

function DatastoreSection({ snapshot }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="section">
      <div className="section-head collapsible" onClick={() => setOpen((v) => !v)}>
        <h3>Datastore Snapshot</h3>
        <span className="collapse-arrow">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        !snapshot ? (
          <div style={{ color: 'var(--dim)' }}>(no telemetry yet)</div>
        ) : (
          <div className="kv">
            <div className="k">time</div><div className="v">{snapshot.time_iso}</div>
            <div className="k">lat / lon</div><div className="v">{fmtD(snapshot.lat, 6)} / {fmtD(snapshot.lon, 6)}</div>
            <div className="k">alt amsl / rel</div><div className="v">{fmtD(snapshot.alt_amsl_m, 1)} / {fmtD(snapshot.alt_rel_m, 1)} m</div>
            <div className="k">AGL</div><div className="v">{fmtD(snapshot.agl_m, 1)} m</div>
            <div className="k">heading</div><div className="v">{fmtD(snapshot.heading_deg, 1)}°</div>
            <div className="k">veh r/p/y</div><div className="v">{fmtD(snapshot.veh_roll_deg, 1)} / {fmtD(snapshot.veh_pitch_deg, 1)} / {fmtD(snapshot.veh_yaw_deg, 1)}°</div>
            <div className="k">gimbal r/p/y</div><div className="v">{fmtD(snapshot.gimbal_roll_deg, 1)} / {fmtD(snapshot.gimbal_pitch_deg, 1)} / {fmtD(snapshot.gimbal_yaw_deg, 1)}°</div>
            <div className="k">gimbal yaw abs</div><div className="v">{fmtD(snapshot.gimbal_yaw_abs_deg, 1)}° (true N)</div>
            <div className="k">gimbal yaw rate</div><div className="v">{fmtD(snapshot.gimbal_yaw_abs_rate_dps, 2)} °/s (abs); {fmtD(snapshot.gimbal_yaw_rate_dps, 2)} °/s (body)</div>
            <div className="k">groundspeed</div><div className="v">{fmtD(snapshot.groundspeed_mps, 2)} m/s</div>
            <div className="k">GPS fix / sats</div><div className="v">{snapshot.gps_fix ?? '—'} / {snapshot.gps_sats ?? '—'}</div>
            <div className="k">mast ID</div><div className="v">{snapshot.mast_id ?? '—'}</div>
            <div className="k">asset SL_ID</div><div className="v">{snapshot.asset_sl_id ?? '—'}</div>
            <div className="k">asset ID</div><div className="v">{snapshot.asset_id ?? '—'}</div>
            <div className="k">asset name</div><div className="v">{snapshot.asset_name ?? '—'}</div>
          </div>
        )
      )}
    </div>
  );
}

// ── MAVLink Wire Inspector section (left panel, collapsed by default) ──────
const wireTime = (ts) => new Date(ts).toISOString().slice(11, 23);

function WireSection({ wire = [], wireCam = [], apc2 }) {
  const [open, setOpen] = useState(false);
  const [camOnly, setCamOnly] = useState(false);
  const camSys  = apc2?.sysid  ?? 1;
  const camComp = apc2?.compid ?? 100;
  const shown = camOnly ? wireCam : wire;
  return (
    <div className="section">
      <div className="section-head collapsible" onClick={() => setOpen((v) => !v)}>
        <h3>MAVLink{camOnly ? ' (cam)' : ''} ({shown.length})</h3>
        <span className="collapse-arrow">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--dim)', marginBottom: 6 }}>
            <input type="checkbox" checked={camOnly} onChange={(e) => setCamOnly(e.target.checked)} />
            cam only ({camSys}/{camComp})
          </label>
          <div className="log">
            {shown.map((w, i) => (
              <div key={i} className={`line ${w.dir}`}>
                {wireTime(w.ts)} {w.dir === 'in' ? '<-' : w.dir === 'out' ? '->' : '!!'}{w.sysid != null ? ` ${w.sysid}/${w.compid}` : ''} {w.name || `msgid=${w.msgid}`}{w.cmd ? ` (${[w.cmd.id, w.cmd.name].filter((x) => x != null && x !== '').join(' ')})` : ''}{w.targetSystem != null ? ` →${w.targetSystem}/${w.targetComponent}` : ''}{w.error ? ` ${w.error}` : ''}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [url, setUrl] = useState(defaultWsUrl());
  const {
    status, welcome, snapshot, stats, controlLink, captures, records,
    wire, wireCam, images, history, getResults, settingResults, options, liveViewFrame, assets, send,
  } = useApc2Socket(url);
  const httpBase = httpBaseFromWs(url);

  useEffect(() => { try { localStorage.setItem('apc2_ws', url); } catch { /* ignore */ } }, [url]);

  // Panel order (drag-to-reorder)
  const [panelOrder, setPanelOrder] = useState(loadOrder);
  const [dragOver, setDragOver]     = useState(null);
  const draggingId = useRef(null);

  useEffect(() => {
    try { localStorage.setItem('apc2_panel_order', JSON.stringify(panelOrder)); } catch { /* ignore */ }
  }, [panelOrder]);

  // Panel widths stored as flex-grow proportions
  const [widths, setWidths] = useState(loadWidths);
  useEffect(() => {
    try { localStorage.setItem('apc2_panel_widths', JSON.stringify(widths)); } catch { /* ignore */ }
  }, [widths]);

  // Left-panel collapse
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const panelsRef = useRef(null);

  // ── Shared capture state (center table + right preview both use pinnedSeq) ──
  const [pinnedSeq, setPinnedSeq] = useState(null);

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
      bySeq.set(rec.seq, { ...existing, lat: rec.lat, lon: rec.lon, gimbal_yaw_abs_deg: rec.gimbal_yaw_abs_deg, agl_m: rec.agl_m, gimbal_settled: rec.gimbal_settled });
    }
    return [...bySeq.values()].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
  }, [captures, records, history]);

  const latestReadySeq = useMemo(() => {
    const entries = Object.entries(images);
    if (entries.length === 0) return null;
    let bestSeq = null, bestTs = -1;
    for (const [seq, data] of entries) {
      if ((data.ts ?? 0) > bestTs) { bestTs = data.ts ?? 0; bestSeq = Number(seq); }
    }
    return bestSeq;
  }, [images]);

  const latestCaptureSeq = rows.length > 0 ? rows[0].seq : null;
  const previewSeq = pinnedSeq ?? latestReadySeq ?? latestCaptureSeq;

  // Auto-clear pin when a new image arrives
  const prevLatestRef = useRef(latestReadySeq);
  useEffect(() => {
    if (latestReadySeq !== null && latestReadySeq !== prevLatestRef.current) {
      prevLatestRef.current = latestReadySeq;
      setPinnedSeq(null);
    }
  }, [latestReadySeq]);

  // ── Resize handle ──────────────────────────────────────────────────────
  const startResize = (e, idA, idB) => {
    e.preventDefault();
    const startX    = e.clientX;
    const startA    = widths[idA];
    const startB    = widths[idB];
    const containerW = panelsRef.current?.offsetWidth ?? 1;
    const totalFlex  = Object.values(widths).reduce((s, v) => s + v, 0);
    const onMove = (e) => {
      const delta = ((e.clientX - startX) / containerW) * totalFlex;
      setWidths((prev) => ({
        ...prev,
        [idA]: Math.max(0.08, startA + delta),
        [idB]: Math.max(0.08, startB - delta),
      }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Drag to reorder ────────────────────────────────────────────────────
  const onDragStart = (id) => { draggingId.current = id; };
  const onDragEnd   = ()   => { draggingId.current = null; setDragOver(null); };
  const onDragOver  = (e, id) => { e.preventDefault(); if (id !== draggingId.current) setDragOver(id); };
  const onDrop = (targetId) => {
    const src = draggingId.current;
    if (src && src !== targetId) {
      setPanelOrder((prev) => {
        const next = [...prev];
        const fi = next.indexOf(src), ti = next.indexOf(targetId);
        next.splice(fi, 1);
        next.splice(ti, 0, src);
        return next;
      });
    }
    setDragOver(null);
  };

  const renderContent = (id) => {
    if (id === 'left') return (
      <>
        <GcsPanel send={send} status={status} stats={stats} />
        <hr className="panel-divider" />
        <SettingsPanel
          send={send} status={status} controlLink={controlLink}
          getResults={getResults} settingResults={settingResults} options={options}
        />
        <hr className="panel-divider" />
        <DatastoreSection snapshot={snapshot} />
        <WireSection wire={wire} wireCam={wireCam} apc2={welcome?.apc2} />
      </>
    );
    if (id === 'center') return (
      <CenterPanel
        liveViewFrame={liveViewFrame}
        rows={rows} images={images} httpBase={httpBase}
        pinnedSeq={pinnedSeq} setPinnedSeq={setPinnedSeq}
        assets={assets}
        currentMastSlId={snapshot?.asset_sl_id ?? null}
      />
    );
    if (id === 'right') return (
      <LivePanel
        previewSeq={previewSeq} pinnedSeq={pinnedSeq} setPinnedSeq={setPinnedSeq}
        images={images} httpBase={httpBase}
      />
    );
  };

  return (
    <div className={`app${status !== 'open' ? ' disconnected' : ''}`}>

      <div className="topbar">
        <span className="title">apc2 web client</span>
        <span className={`dot ${status === 'open' ? 'on' : status === 'connecting' ? 'warn' : 'off'}`} />
        <span style={{ color: 'var(--dim)' }}>{status}</span>
        <span className="url">→</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} />
        {welcome?.apc2 && (
          <span style={{ color: 'var(--dim)' }}>
            apc2 {welcome.apc2.sysid}/{welcome.apc2.compid}
            {welcome.config?.camera && ` · ${welcome.config.camera.vendor} ${welcome.config.camera.model}`}
          </span>
        )}
        <span style={{ color: 'var(--line)', margin: '0 4px' }}>|</span>
        <span className={`dot ${controlLink.state === 'up' ? 'on' : controlLink.state === 'down' ? 'off' : ''}`} />
        <span style={{ color: 'var(--dim)' }}>
          cam {controlLink.state ?? '—'}
          {controlLink.state === 'up' && controlLink.info?.model ? ` · ${controlLink.info.model}` : ''}
        </span>
      </div>

      <div className="panels-row" ref={panelsRef}>
        {panelOrder.map((id, i) => {
          const isLeftmost  = i === 0;
          const isCollapsed = isLeftmost && leftCollapsed;
          const showHandle  = i > 0 && !(i === 1 && leftCollapsed);

          return (
            <React.Fragment key={id}>
              {showHandle && (
                <div
                  className="resize-handle"
                  onMouseDown={(e) => startResize(e, panelOrder[i - 1], id)}
                />
              )}

              <div
                className={`panel${dragOver === id ? ' drag-over' : ''}${isCollapsed ? ' collapsed' : ''}`}
                style={isCollapsed ? undefined : { flex: widths[id] }}
                onDragOver={(e) => onDragOver(e, id)}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => onDrop(id)}
              >
                {isCollapsed ? (
                  <button
                    className="expand-btn"
                    onClick={() => setLeftCollapsed(false)}
                    title={`Expand ${PANEL_LABELS[id]}`}
                  >▶</button>
                ) : (
                  <>
                    <h2
                      draggable
                      onDragStart={() => onDragStart(id)}
                      onDragEnd={onDragEnd}
                    >
                      <span>{PANEL_LABELS[id]}</span>
                      {isLeftmost && (
                        <button
                          className="collapse-btn"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); setLeftCollapsed(true); }}
                          title="Collapse panel"
                        >◀</button>
                      )}
                    </h2>
                    <div className={`panel-body${id === 'center' ? ' panel-body--fill' : ''}`}>
                      {renderContent(id)}
                    </div>
                  </>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

    </div>
  );
}
