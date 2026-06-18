import React, { useState, useEffect } from 'react';

const READABLE = [
  { key: 'shutter_speed', label: 'Shutter speed' },
  { key: 'iso', label: 'ISO' },
  { key: 'white_balance', label: 'White balance' },
  { key: 'f_number', label: 'F-stop' },
  { key: 'focus_position', label: 'Focus position' },
  { key: 'focus_mode', label: 'Focus mode' },
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
  const disabled = status !== 'open' || linkDown;

  const fNumberOptions = options.f_number?.options ?? [];

  const [setAt, setSetAt] = useState(0);
  const setResult = settingResults.shutter_speed;
  const settingPending = setAt > 0 && (!setResult || setResult.ts < setAt);

  // Auto-request all settings and option lists when controlLink comes up
  useEffect(() => {
    if (status !== 'open' || controlLink?.state !== 'up') return;
    const ts = Date.now();
    READABLE.forEach((r) => send({ t: 'get-setting', key: r.key, reqId: `get-${r.key}-${ts}` }));
    send({ t: 'list-options', key: 'f_number', reqId: `list-f_number-${ts}` });
  }, [status, controlLink?.state]);

  const renderValue = (key) => {
    const r = getResults[key];
    if (!r) return <span style={{ color: 'var(--dim)' }}>—</span>;
    return r.ok
      ? <span className="badge good">{r.value || '(empty)'}</span>
      : <span className="badge bad">FAIL · {r.error || 'unknown'}</span>;
  };

  const applyExposure = () => {
    if (!shutterValue) return;
    setSetAt(Date.now());
    send({ t: 'setting', key: 'shutter_speed', value: shutterValue, reqId: `set-shutter-${Date.now()}` });
  };

  return (
    <>
      {linkDown && (
        <div className="section" style={{ color: 'var(--warn)' }}>
          ControlLink {controlLink?.state ?? 'unknown'} — camhandler must be running with a connected camera.
        </div>
      )}

      <div className="section">
        <h3>Current values</h3>
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
      </div>
    </>
  );
}
