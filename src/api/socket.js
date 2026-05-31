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
  // Latest setting-result keyed by setting key. The Settings panel reads its row from here.
  const [settingResults, setSettingResults] = useState({});
  // Option lists fetched on demand: { iso: ['ISO 100', ...], white_balance: [...], shutter_speed: [...] }
  const [options, setOptions] = useState({});
  // Latest writability diagnose result from camhandler: { ok, entries:[{name, writable, options}], ts }
  const [diagnose, setDiagnose] = useState(null);

  const sockRef = useRef(null);
  const backoffRef = useRef(500);
  const closedRef = useRef(false);

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
          case 'welcome': setWelcome({ apc2: m.apc2, config: m.config }); break;
          case 'snapshot': setSnapshot(m.snapshot); break;
          case 'stats': setStats(m.camera); break;
          case 'capture-result':
            setCaptures((prev) => [{ ts: Date.now(), ...m }, ...prev].slice(0, 50));
            break;
          case 'record':
            setRecords((prev) => [{ ts: Date.now(), record: m.record }, ...prev].slice(0, 50));
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
          case 'diagnose-result':
            setDiagnose({ ok: !!m.ok, entries: m.entries || [], error: m.error, ts: Date.now() });
            break;
          case 'mavlink-in':
          case 'mavlink-out':
            setWire((prev) => [{ ts: Date.now(), dir: m.t === 'mavlink-in' ? 'in' : 'out', name: m.name, msgid: m.msgid }, ...prev].slice(0, 200));
            break;
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

  return { status, welcome, snapshot, stats, controlLink, captures, records, wire, settingResults, options, diagnose, send };
}
