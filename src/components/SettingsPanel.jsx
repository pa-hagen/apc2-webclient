import React, { useState } from 'react';

// Camera settings, driven through camhandler's ControlLink. The "current values" section reads live
// values (shutter/ISO/WB/f-stop/focus distance); the exposure section can also set the shutter speed.
// All values speak the same human-readable string form the camera/list flow uses (e.g. "1/500").

// Settings camhandler can READ today (its ControlLink `get` handler). "Request all" fans out to these.
const READABLE = [
  { key: 'shutter_speed', label: 'Shutter speed' },
  { key: 'iso', label: 'ISO' },
  { key: 'white_balance', label: 'White balance' },
  { key: 'f_number', label: 'F-stop' },
  { key: 'focus_distance_m', label: 'Focus distance' },
  { key: 'focus_mode', label: 'Focus mode' },
];

export default function SettingsPanel({ send, status, controlLink, getResults = {}, settingResults = {} }) {
  const [setAt, setSetAt] = useState(0);
  const [value, setValue] = useState('');
  const [focusModeValue, setFocusModeValue] = useState('AF_S');
  // Per-key "requested at" timestamps so each row can show "Requesting…" until a fresh result lands.
  const [reqAt, setReqAt] = useState({});
  const linkDown = controlLink?.state !== 'up';
  const disabled = status !== 'open' || linkDown;

  const setResult = settingResults.shutter_speed;
  const setting = setAt > 0 && (!setResult || setResult.ts < setAt);

  const requestKey = (key) => {
    const ts = Date.now();
    setReqAt((prev) => ({ ...prev, [key]: ts }));
    send({ t: 'get-setting', key, reqId: `get-${key}-${ts}` });
  };
  const requestAll = () => READABLE.forEach((r) => requestKey(r.key));

  const focusModeOptions = ['AF_S', 'MF'];

  const applyExposure = () => {
    const v = value.trim();
    if (!v) return;
    setSetAt(Date.now());
    send({ t: 'setting', key: 'shutter_speed', value: v, reqId: `set-shutter-${Date.now()}` });
  };

  const renderValue = (key) => {
    const r = getResults[key];
    const pending = (reqAt[key] || 0) > 0 && (!r || r.ts < reqAt[key]);
    if (pending) return <span className="badge">Requesting…</span>;
    if (!r) return <span style={{ color: 'var(--dim)' }}>—</span>;
    return r.ok
      ? <span className="badge good">{r.value || '(empty)'}</span>
      : <span className="badge bad">FAIL · {r.error || 'unknown'}</span>;
  };

  return (
    <div className="panel">
      <h2>Camera Settings</h2>
      <div className="panel-body">
        {linkDown && (
          <div className="section" style={{ color: 'var(--warn)' }}>
            ControlLink is {controlLink?.state ?? 'unknown'} — camhandler must be running with a connected camera for settings to work.
          </div>
        )}

        <div className="section">
          <div className="section-head">
            <h3>Current values</h3>
            <button disabled={disabled} onClick={requestAll}>Request all</button>
          </div>
          <div className="kv">
            {READABLE.map((r) => (
              <React.Fragment key={r.key}>
                <div className="k">{r.label}</div>
                <div className="v" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="secondary" disabled={disabled} onClick={() => requestKey(r.key)}>Get</button>
                  {renderValue(r.key)}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="section">
          <h3>Set exposure time</h3>
          <div className="row">
            <label>Set exposure</label>
            <input
              type="text" placeholder="e.g. 1/500" value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyExposure(); }}
            />
            <button disabled={disabled || setting || !value.trim()} onClick={applyExposure}>
              {setting ? 'Setting…' : 'Set'}
            </button>
          </div>
          {setResult && !setting && (
            <div className="row">
              {setResult.ok
                ? <span className="badge good">set OK · {setResult.value}</span>
                : <span className="badge bad">FAIL · {setResult.error || 'unknown'}</span>}
            </div>
          )}
        </div>

        <div className="section">
          <h3>Set focus mode</h3>
          <div className="row">
            <label>Focus mode</label>
            <select
              disabled={disabled}
              value={focusModeValue}
              onChange={(e) => setFocusModeValue(e.target.value)}
            >
              {focusModeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <button
              disabled={disabled || !focusModeValue || focusModeOptions.length === 0}
              onClick={() => send({ t: 'setting', key: 'focus_mode', value: focusModeValue, reqId: `set-focus_mode-${Date.now()}` })}
            >Set</button>
          </div>
          {settingResults.focus_mode && (
            <div className="row">
              {settingResults.focus_mode.ok
                ? <span className="badge good">set OK · {settingResults.focus_mode.value}</span>
                : <span className="badge bad">FAIL · {settingResults.focus_mode.error || 'unknown'}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
