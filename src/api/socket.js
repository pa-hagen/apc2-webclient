import { useEffect, useRef, useState, useCallback } from 'react';

// Default to the same host that served this page (handy when both run on the Pi); allow override via
// localStorage.apc2_ws or ?ws= so you can point at apc2 on another machine.
export function defaultWsUrl() {
  try {
    const fromQs = new URLSearchParams(location.search).get('ws');
    if (fromQs) return fromQs;
    const fromLs = localStorage.getItem('apc2_ws');
    if (fromLs) return fromLs;
  } catch { /* SSR / private mode */ }
  const host = (typeof location !== 'undefined' && location.hostname) || '127.0.0.1';
  return `ws://${host}:8430/ws`;
}

// Derive the plain-HTTP base (for image downloads etc.) from the WS URL the client is pointed at, so
// downloads always hit the same apc2 host/port the data is coming from.
export function httpBaseFromWs(wsUrl) {
  try {
    const u = new URL(wsUrl);
    u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
    u.pathname = ''; u.search = ''; u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch { return ''; }
}

/**
 * Connects to the apc2 web bridge and exposes:
 *   status      'connecting' | 'open' | 'closed' | 'error'
 *   welcome     { apc2, config } once received
 *   snapshot    latest datastore snapshot (1 Hz)
 *   stats       latest camera ledger
 *   controlLink { state:'up'|'down'|null, info? }
 *   captures    rolling list of last N capture-results (newest first)
 *   records     rolling list of last N finalized records (newest first)
 *   wire        rolling MAVLink frame log (in/out) for debugging
 *   getResults  latest read-back of a camera setting, keyed by key (e.g. shutter_speed)
 *   send(msg)   send any client->server JSON object (see src/web/server.js for the protocol)
 * Reconnects with a small backoff if the link drops.
 */
export function useApc2Socket(url) {
  const [status, setStatus] = useState('connecting');
  const [welcome, setWelcome] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [stats, setStats] = useState(null);
  const [controlLink, setControlLink] = useState({ state: null, info: null });
  const [captures, setCaptures] = useState([]);
  const [records, setRecords] = useState([]);
  const [wire, setWire] = useState([]);
  // Frames addressed at the camera component (apc2's sysid/compid), kept as a separate capped list so
  // the filtered view isn't starved by broadcast telemetry before the cap is applied.
  const [wireCam, setWireCam] = useState([]);
  // seq -> { file, thumb, ts } once a capture's image has been post-processed and is downloadable.
  const [images, setImages] = useState({});
  // Capture history loaded from DB on connect: [{seq,ts,success,file,reason,...}]
  const [history, setHistory] = useState([]);
  // Latest setting-result keyed by setting key. The Settings panel reads its row from here.
  const [settingResults, setSettingResults] = useState({});
  // Option lists fetched on demand: { iso: ['ISO 100', ...], white_balance: [...], shutter_speed: [...] }
  const [options, setOptions] = useState({});
  // Latest writability diagnose result from camhandler: { ok, entries:[{name, writable, options}], ts }
  const [diagnose, setDiagnose] = useState(null);
  // Latest get-setting result keyed by setting key: { iso: { ok, value, error, ts }, ... }
  const [getResults, setGetResults] = useState({});
  const [liveViewFrame, setLiveViewFrame] = useState(null);
  // Asset (mast) list from the server's asset store.
  const [assets, setAssets] = useState([]);

  const sockRef = useRef(null);
  const backoffRef = useRef(500);
  const closedRef = useRef(false);
  // The camera component to match for the camhandler-only wire list; updated from the welcome message,
  // defaults to 1/100 until then.
  const camIdRef = useRef({ sys: 1, comp: 100 });

  useEffect(() => {
    closedRef.current = false;
    let timer = null;

    const connect = () => {
      setStatus('connecting');
      let ws;
      try { ws = new WebSocket(url); }
      catch (e) { setStatus('error'); return; }
      sockRef.current = ws;

      ws.onopen = () => { backoffRef.current = 500; setStatus('open'); };
      ws.onerror = () => setStatus('error');
      ws.onclose = () => {
        setStatus('closed');
        sockRef.current = null;
        if (closedRef.current) return;
        timer = setTimeout(connect, backoffRef.current);
        backoffRef.current = Math.min(backoffRef.current * 2, 5000);
      };

      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        switch (m.t) {
          case 'welcome':
            if (m.apc2) camIdRef.current = { sys: m.apc2.sysid ?? 1, comp: m.apc2.compid ?? 100 };
            setWelcome({ apc2: m.apc2, config: m.config });
            break;
          case 'snapshot': setSnapshot(m.snapshot); break;
          case 'stats': setStats(m.camera); break;
          case 'capture-result':
            setCaptures((prev) => [{ ts: Date.now(), ...m }, ...prev].slice(0, 50));
            break;
          case 'record':
            setRecords((prev) => [{ ts: Date.now(), record: m.record }, ...prev].slice(0, 50));
            break;
          case 'image-ready':
            setImages((prev) => ({ ...prev, [m.seq]: { file: m.file, thumb: !!m.thumb, ts: m.ts || 0, ...m.exif } }));
            break;
          case 'history':
            setHistory(m.entries || []);
            break;
          case 'controllink':
            setControlLink({ state: m.state, info: m.info ?? null });
            break;
          case 'setting-result':
            setSettingResults((prev) => ({ ...prev, [m.key]: { ok: !!m.ok, value: m.value, error: m.error, ts: Date.now() } }));
            break;
          case 'list-options-result':
            setOptions((prev) => ({ ...prev, [m.key]: { ok: !!m.ok, options: m.options || [], error: m.error, ts: Date.now() } }));
            break;
          case 'get-setting-result':
            setGetResults((prev) => ({ ...prev, [m.key]: { ok: !!m.ok, value: m.value, error: m.error, ts: Date.now() } }));
            break;
          case 'diagnose-result':
            setDiagnose({ ok: !!m.ok, entries: m.entries || [], error: m.error, ts: Date.now() });
            break;
          case 'liveview-frame':
            setLiveViewFrame(m.data);
            break;
          case 'asset-list':
            setAssets(m.assets || []);
            break;
          case 'mavlink-in':
          case 'mavlink-out': {
            // Pull the MAVLink routing target out of the payload (node-mavlink uses camelCase) so the
            // UI can filter to frames addressed at a specific component (e.g. the camera, 1/100).
            const tgtSys = m.msg?.targetSystem ?? m.msg?.target_system ?? null;
            const tgtComp = m.msg?.targetComponent ?? m.msg?.target_component ?? null;
            const entry = {
              ts: Date.now(), dir: m.t === 'mavlink-in' ? 'in' : 'out',
              name: m.name, msgid: m.msgid,
              sysid: m.sysid ?? null, compid: m.compid ?? null,
              targetSystem: tgtSys, targetComponent: tgtComp,
              cmd: m.cmd ?? null,
            };
            setWire((prev) => [entry, ...prev].slice(0, 200));
            // Filter BEFORE the cap: keep camhandler frames in their own capped list so they survive
            // even when broadcast telemetry dominates the raw stream. apc2 *is* the camhandler (1/100),
            // so that's anything addressed TO it (incoming) plus the *addressed* (non-broadcast) frames
            // it sends (outgoing) — broadcast heartbeats/telemetry are excluded.
            const cam = camIdRef.current;
            if ((entry.dir === 'out' && tgtSys != null) || (tgtSys === cam.sys && tgtComp === cam.comp)) {
              setWireCam((prev) => [entry, ...prev].slice(0, 200));
            }
            break;
          }
          case 'error':
            setWire((prev) => [{ ts: Date.now(), dir: 'sys', name: 'ERROR', msgid: null, error: m.message }, ...prev].slice(0, 200));
            break;
          default: break;
        }
      };
    };

    connect();
    return () => {
      closedRef.current = true;
      if (timer) clearTimeout(timer);
      try { sockRef.current?.close(); } catch { /* ignore */ }
    };
  }, [url]);

  const send = useCallback((obj) => {
    const ws = sockRef.current;
    if (!ws || ws.readyState !== 1) return false;
    try { ws.send(JSON.stringify(obj)); return true; } catch { return false; }
  }, []);

  return { status, welcome, snapshot, stats, controlLink, captures, records, wire, wireCam, images, history, settingResults, options, diagnose, getResults, liveViewFrame, assets, send };
}
