import React, { useState, useEffect, useCallback, useRef } from 'react';

const READABLE = [
  { key: 'shutter_speed', label: 'Shutter speed' },
  { key: 'iso', label: 'ISO' },
  { key: 'white_balance', label: 'White balance' },
  { key: 'f_number', label: 'F-stop' },
  { key: 'exposure_bias_compensation', label: 'Exposure comp.' },
  { key: 'focus_position', label: 'Focus position' },
  { key: 'focus_mode', label: 'Focus mode' },
  { key: 'focal_distance_reported', label: 'Focus distance Reported' },
];

const SHUTTER_OPTIONS = [
  '1/10', '1/15', '1/20', '1/25', '1/30', '1/50', '1/60',
  '1/100', '1/125', '1/200', '1/250', '1/500', '1/750',
  '1/1000', '1/1500', '1/2000', '1/3000',
];

export default function SettingsPanel({ send, status, controlLink, getResults = {}, settingResults = {}, options = {} }) {
  const [shutterValue, setShutterValue] = useState('');
  const [focusPos, setFocusPos] = useState(() => localStorage.getItem('apc2_focus_pos') ?? '');
  const [focusModeValue, setFocusModeValue] = useState('');
  const [fNumberIndex, setFNumberIndex] = useState('');

  const linkDown = controlLink?.state !== 'up';
  const disabled = status !== 'open' || !controlLink?.cameraReady;

  const fNumberOptions = options.f_number?.options ?? [];

  const [setAt, setSetAt] = useState(0);
  const setResult = settingResults.shutter_speed;
  const settingPending = setAt > 0 && (!setResult || setResult.ts < setAt);

  // Exposure compensation: driven by the camera's actual possible-values list.
  const evOptions = options.exposure_bias_compensation?.options ?? null;
  const [evIdx, setEvIdx] = useState(null);
  const [evSetAt, setEvSetAt] = useState(0);
  const [evReqTs, setEvReqTs] = useState(0);
  const [evTimedOut, setEvTimedOut] = useState(false);

  // Enable buttons 1s after requesting options, even if camera never responds.
  useEffect(() => {
    if (evOptions || !evReqTs) return;
    const ms = evReqTs + 1000 - Date.now();
    if (ms <= 0) { setEvTimedOut(true); return; }
    const t = setTimeout(() => setEvTimedOut(true), ms);
    return () => clearTimeout(t);
  }, [evReqTs, evOptions]);

  const formatEvIdx = (idx) => {
    if (idx === 0) return '0';
    const neg = idx < 0;
    const abs = Math.abs(idx);
    const whole = Math.floor(abs / 3);
    const thirds = abs % 3;
    const sign = neg ? '-' : '+';
    const thirdStr = thirds === 1 ? '1/3' : thirds === 2 ? '2/3' : '';
    if (whole === 0) return sign + thirdStr;
    if (thirds === 0) return sign + whole;
    return sign + whole + ' ' + thirdStr;
  };

  const formatEvString = (str) => {
    if (str == null) return str;
    const f = parseFloat(str);
    if (!Number.isFinite(f)) return str;
    return formatEvIdx(Math.round(f * 3)) + ' EV';
  };

  // When options list + current value both known, find the matching index.
  const evRead = getResults.exposure_bias_compensation;
  useEffect(() => {
    if (!evRead?.ok || evRead.value == null || !evOptions?.length) return;
    const cur = parseFloat(evRead.value);
    if (!Number.isFinite(cur)) return;
    let best = 0, bestDiff = Infinity;
    evOptions.forEach((s, i) => {
      const d = Math.abs(parseFloat(s) - cur);
      if (d < bestDiff) { bestDiff = d; best = i; }
    });
    setEvIdx(best);
  }, [evRead?.value, evRead?.ok, evOptions]);

  const evSetResult = settingResults.exposure_bias_compensation;
  const evPending = evSetAt > 0 && (!evSetResult || evSetResult.ts < evSetAt);
  const evWaiting = !evOptions && !evTimedOut;
  const [evDirty, setEvDirty] = useState(false);


  // Auto-request all settings and option lists when camera becomes ready
  useEffect(() => {
    if (status !== 'open' || !controlLink?.cameraReady) return;
    const ts = Date.now();
    READABLE.forEach((r) => send({ t: 'get-setting', key: r.key, reqId: `get-${r.key}-${ts}` }));
    send({ t: 'list-options', key: 'f_number', reqId: `list-f_number-${ts}` });
    send({ t: 'list-options', key: 'exposure_bias_compensation', reqId: `list-ev-${ts}` });
    setEvReqTs(ts);
    setEvTimedOut(false);
    setEvIdx(null);
  }, [status, controlLink?.cameraReady]);

  const renderValue = (key) => {
    const r = getResults[key];
    if (!r) return <span style={{ color: 'var(--dim)' }}>—</span>;
    if (!r.ok) return <span className="badge bad">FAIL · {r.error || 'unknown'}</span>;
    if (key === 'exposure_bias_compensation') {
      return <span className="badge good">{formatEvString(r.value) ?? '(empty)'}</span>;
    }
    return <span className="badge good">{r.value || '(empty)'}</span>;
  };

  const refreshValues = () => {
    const ts = Date.now();
    READABLE.forEach((r) => send({ t: 'get-setting', key: r.key, reqId: `get-${r.key}-${ts}` }));
  };

  // Focus position stepping — local state tracks position optimistically so rapid
  // clicks don't read stale server state and flip back and forth.
  const FOCUS_SMALL_M = 0.5;
  const FOCUS_LARGE_M = 3.0;
  const [localFocusPos, setLocalFocusPos] = useState(null);
  const [localFocusDist, setLocalFocusDist] = useState(null);
  const focusSteppingRef = useRef(false);
  const focusIdleRef = useRef(null);

  // Sync local position from server only when not actively stepping.
  useEffect(() => {
    if (focusSteppingRef.current) return;
    const r = getResults.focus_position;
    if (!r?.ok || !r.value) return;
    const p = parseInt(r.value.replace(/^0x/i, ''), 16);
    if (Number.isFinite(p)) setLocalFocusPos(p);
  }, [getResults.focus_position?.value, getResults.focus_position?.ok]);

  useEffect(() => {
    if (focusSteppingRef.current) return;
    const r = getResults.focal_distance_reported;
    if (!r?.ok || !r.value || /^inf/i.test(r.value.trim())) { setLocalFocusDist(null); return; }
    const d = parseFloat(r.value);
    if (Number.isFinite(d) && d > 0) setLocalFocusDist(d);
  }, [getResults.focal_distance_reported?.value, getResults.focal_distance_reported?.ok]);

  const applyFocusStep = (deltaMeters) => {
    if (localFocusPos == null) return;

    // Direction is inverse: higher position = farther, so negate delta.
    const d = -deltaMeters;
    let newPos;
    let newDist = null;
    if (localFocusDist && localFocusDist > 0) {
      const nd = Math.max(0.05, localFocusDist + d);
      newPos = Math.round(localFocusPos * localFocusDist / nd);
      newDist = nd;
    } else {
      const step = Math.abs(d) >= FOCUS_LARGE_M ? 0x1000 : 0x0300;
      newPos = localFocusPos + (d < 0 ? -step : step);
    }
    newPos = Math.max(0, Math.min(0xFFFF, newPos));

    // Update local state immediately — next click builds on this, not server state.
    setLocalFocusPos(newPos);
    if (newDist != null) setLocalFocusDist(newDist);

    // Suppress server sync while stepping; re-enable 1s after last click.
    focusSteppingRef.current = true;
    clearTimeout(focusIdleRef.current);
    focusIdleRef.current = setTimeout(() => {
      focusSteppingRef.current = false;
      const ts = Date.now();
      send({ t: 'get-setting', key: 'focus_position', reqId: `sync-fp-${ts}` });
      send({ t: 'get-setting', key: 'focal_distance_reported', reqId: `sync-fd-${ts}` });
    }, 1000);

    const hex = `0x${newPos.toString(16).toUpperCase().padStart(4, '0')}`;
    const ts = Date.now();
    send({ t: 'setting', key: 'focus_position', value: hex, reqId: `fstep-${ts}` });
    setTimeout(() => {
      send({ t: 'get-setting', key: 'focal_distance_reported', reqId: `gfd-${ts}` });
    }, 100);
  };

  const applyExposure = () => {
    if (!shutterValue) return;
    setSetAt(Date.now());
    send({ t: 'setting', key: 'shutter_speed', value: shutterValue, reqId: `set-shutter-${Date.now()}` });
  };

  return (
    <>
      {!controlLink?.cameraReady && (
        <div className="section" style={{ color: 'var(--warn)' }}>
          {linkDown ? 'camhandler not reachable' : 'camera not connected'} — controls disabled.
        </div>
      )}

      <div className="section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Current values</h3>
          <button disabled={disabled} onClick={refreshValues} style={{ padding: '0.1rem 0.5rem', fontSize: '0.8rem' }}>Refresh</button>
        </div>
        <div className="kv">
          {READABLE.map((r) => (
            <React.Fragment key={r.key}>
              <div className="k">{r.label}</div>
              <div className="v">{renderValue(r.key)}</div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="section">
        <h3>Set exposure time</h3>
        <div className="row">
          <label>Shutter</label>
          <select
            value={shutterValue}
            disabled={disabled}
            onChange={(e) => setShutterValue(e.target.value)}
          >
            <option value="">—</option>
            {SHUTTER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <button disabled={disabled || settingPending || !shutterValue} onClick={applyExposure}>
            {settingPending ? 'Setting…' : 'Set'}
          </button>
        </div>
        {setResult && !settingPending && (
          <div className="row">
            {setResult.ok
              ? <span className="badge good">OK · {setResult.value}</span>
              : <span className="badge bad">FAIL · {setResult.error || 'unknown'}</span>}
          </div>
        )}
      </div>

      <div className="section">
        <h3>Set f-number</h3>
        <div className="row">
          <label>F-stop</label>
          <select
            disabled={disabled || fNumberOptions.length === 0}
            value={fNumberIndex}
            onChange={(e) => setFNumberIndex(e.target.value)}
          >
            <option value="">—</option>
            {fNumberOptions.map((o, i) => <option key={i} value={i}>{o}</option>)}
          </select>
          <button
            disabled={disabled || fNumberIndex === ''}
            onClick={() => send({ t: 'setting', key: 'f_number_index', value: Number(fNumberIndex), reqId: `set-f_number-${Date.now()}` })}
          >Set</button>
        </div>
        {settingResults.f_number_index && (
          <div className="row">
            {settingResults.f_number_index.ok
              ? <span className="badge good">OK · {settingResults.f_number_index.value}</span>
              : <span className="badge bad">FAIL · {settingResults.f_number_index.error || 'unknown'}</span>}
          </div>
        )}
      </div>

      <div className="section">
        <h3>Exposure Compensation</h3>
        <div className="row">
          <select
            disabled={disabled || evPending || evWaiting || !evOptions}
            value={evIdx ?? ''}
            onChange={(e) => { setEvIdx(Number(e.target.value)); setEvDirty(true); }}
          >
            {evWaiting && <option value="">Loading…</option>}
            {!evOptions && !evWaiting && <option value="">—</option>}
            {evOptions?.map((s, i) => (
              <option key={i} value={i}>{formatEvString(s)}</option>
            ))}
          </select>
          <button
            disabled={disabled || evPending || evWaiting || !evOptions || evIdx === null}
            onClick={() => {
              const ts = Date.now();
              setEvSetAt(ts);
              setEvDirty(false);
              const evValue = parseFloat(evOptions[evIdx]);
              send({ t: 'setting', key: 'exposure_bias_compensation', value: evValue, reqId: `set-ev-${ts}` });
              setTimeout(() => send({ t: 'get-setting', key: 'exposure_bias_compensation', reqId: `get-ev-${ts + 1}` }), 400);
            }}
          >{evPending ? 'Setting…' : 'Set'}</button>
        </div>
        {evSetResult && !evPending && !evDirty && (
          <div className="row">
            {evSetResult.ok
              ? <span className="badge good">OK · {formatEvString(evRead?.value)}</span>
              : <span className="badge bad">FAIL · {evSetResult.error || 'unknown'}</span>}
          </div>
        )}
      </div>

      <div className="section">
        <h3>Set focus mode</h3>
        <div className="row">
          <label>Focus mode</label>
          <select disabled={disabled} value={focusModeValue} onChange={(e) => setFocusModeValue(e.target.value)}>
            <option value="">—</option>
            {['AF_S', 'AF_C', 'MF'].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <button
            disabled={disabled || !focusModeValue}
            onClick={() => send({ t: 'setting', key: 'focus_mode', value: focusModeValue, reqId: `set-focus_mode-${Date.now()}` })}
          >Set</button>
        </div>
        {settingResults.focus_mode && (
          <div className="row">
            {settingResults.focus_mode.ok
              ? <span className="badge good">OK · {settingResults.focus_mode.value}</span>
              : <span className="badge bad">FAIL · {settingResults.focus_mode.error || 'unknown'}</span>}
          </div>
        )}
      </div>

      <div className="section">
        <h3>Set focus position</h3>
        <div className="row">
          <label>Position (hex)</label>
          <input
            type="text" placeholder="e.g. 0x1A2B"
            value={focusPos}
            onChange={(e) => { setFocusPos(e.target.value); localStorage.setItem('apc2_focus_pos', e.target.value); }}
          />
          <button
            disabled={disabled || !focusPos.trim()}
            onClick={() => send({ t: 'setting', key: 'focus_position', value: focusPos.trim(), reqId: `set-focus_pos-${Date.now()}` })}
          >Set</button>
        </div>
        {settingResults.focus_position && (
          <div className="row">
            {settingResults.focus_position.ok
              ? <span className="badge good">OK</span>
              : <span className="badge bad">FAIL · {settingResults.focus_position.error || 'unknown'}</span>}
          </div>
        )}
        {getResults.focus_position && (
          <div className="row">
            <label style={{ color: 'var(--dim)' }}>current</label>
            {getResults.focus_position.ok
              ? <span className="badge good">{getResults.focus_position.value}</span>
              : <span className="badge bad">{getResults.focus_position.error}</span>}
          </div>
        )}
        <div className="row" style={{ gap: '0.3rem', marginTop: '0.25rem' }}>
          <button disabled={disabled} onClick={() => applyFocusStep(+FOCUS_LARGE_M)} title={`−${FOCUS_LARGE_M}m`} style={{ padding: '2px 7px' }}>−−</button>
          <button disabled={disabled} onClick={() => applyFocusStep(+FOCUS_SMALL_M)} title={`−${FOCUS_SMALL_M}m`} style={{ padding: '2px 7px' }}>−</button>
          <button disabled={disabled} onClick={() => applyFocusStep(-FOCUS_SMALL_M)} title={`+${FOCUS_SMALL_M}m`} style={{ padding: '2px 7px' }}>+</button>
          <button disabled={disabled} onClick={() => applyFocusStep(-FOCUS_LARGE_M)} title={`+${FOCUS_LARGE_M}m`} style={{ padding: '2px 7px' }}>++</button>
          <span style={{ fontSize: '0.75rem', color: 'var(--dim)', alignSelf: 'center' }}>±{FOCUS_SMALL_M}m / ±{FOCUS_LARGE_M}m</span>
        </div>
      </div>
    </>
  );
}
