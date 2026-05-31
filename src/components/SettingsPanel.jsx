import React, { useEffect, useState } from 'react';

// Numeric-input row (used for focus distance).
function NumericRow({ label, sKey, defaultValue, step = 0.1, unit, send, status, lastResult }) {
  const [value, setValue] = useState(defaultValue);
  const [inFlightAt, setInFlightAt] = useState(0);
  const disabled = status !== 'open';
  const pending = inFlightAt > 0 && (!lastResult || lastResult.ts < inFlightAt);

  const apply = () => {
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return;
    setInFlightAt(Date.now());
    send({ t: 'setting', key: sKey, value: num, reqId: `${sKey}-${Date.now()}` });
  };

  return (
    <div className="section">
      <div className="row">
        <label>{label}</label>
        <input type="number" step={step} value={value} onChange={(e) => setValue(e.target.value)} />
        <span style={{ color: 'var(--dim)' }}>{unit}</span>
        <button disabled={disabled || pending} onClick={apply}>{pending ? 'Setting…' : 'Apply'}</button>
      </div>
      {lastResult && (
        <div className="row" style={{ marginLeft: 130 }}>
          {lastResult.ok
            ? <span className="badge good">OK · value={lastResult.value}</span>
            : <span className="badge bad">FAIL · {lastResult.error || 'unknown'}</span>}
        </div>
      )}
    </div>
  );
}

// Dropdown row (used for ISO / WB / Shutter). Auto-fetches the option list once the WS is open
// and the ControlLink is up. listKey is the property name camhandler expects in {type:"list"};
// setKey is the matching {type:"set"} key (typically "<listKey>_index").
function DropdownRow({ label, listKey, setKey, send, status, controlLink, options, lastResult }) {
  const [idx, setIdx] = useState(0);
  const [inFlightAt, setInFlightAt] = useState(0);
  const opts = options[listKey];
  const disabled = status !== 'open' || controlLink?.state !== 'up' || !opts?.ok || !opts.options?.length;
  const pending = inFlightAt > 0 && (!lastResult || lastResult.ts < inFlightAt);

  // Auto-request the option list as soon as both WS and ControlLink are up, and refresh whenever
  // ControlLink reconnects (e.g. camhandler restart -> camera firmware may differ).
  useEffect(() => {
    if (status === 'open' && controlLink?.state === 'up' && !opts) {
      send({ t: 'list-options', key: listKey, reqId: `list-${listKey}-${Date.now()}` });
    }
  }, [status, controlLink?.state, listKey, opts, send]);

  const refresh = () => send({ t: 'list-options', key: listKey, reqId: `list-${listKey}-${Date.now()}` });
  const apply = () => {
    setInFlightAt(Date.now());
    send({ t: 'setting', key: setKey, value: idx, reqId: `${setKey}-${Date.now()}` });
  };

  return (
    <div className="section">
      <div className="row">
        <label>{label}</label>
        <select value={idx} onChange={(e) => setIdx(parseInt(e.target.value, 10))} disabled={disabled} style={{ width: 180 }}>
          {(opts?.options || []).map((o, i) => <option key={i} value={i}>{i}: {o}</option>)}
          {!opts?.options?.length && <option value={0}>(no options loaded)</option>}
        </select>
        <button disabled={disabled || pending} onClick={apply}>{pending ? 'Setting…' : 'Apply'}</button>
        <button className="secondary" disabled={status !== 'open' || controlLink?.state !== 'up'} onClick={refresh}>↻</button>
      </div>
      {opts && !opts.ok && (
        <div className="row" style={{ marginLeft: 130, color: 'var(--bad)' }}>
          list failed: {opts.error || 'unknown'}
        </div>
      )}
      {lastResult && (
        <div className="row" style={{ marginLeft: 130 }}>
          {lastResult.ok
            ? <span className="badge good">OK · index={lastResult.value}</span>
            : <span className="badge bad">FAIL · {lastResult.error || 'unknown'}</span>}
        </div>
      )}
    </div>
  );
}

// Camera settings driven through camhandler's ControlLink `set` / `list` commands.
// Adding a new setting: add a CameraDevice setter + lister, an arm in camhandler.cpp's
// setting_handler / list_handler, and one row below.
export default function SettingsPanel({ send, status, controlLink, settingResults = {}, options = {}, diagnose, runDiagnose }) {
  const linkDown = controlLink?.state !== 'up';
  return (
    <div className="panel">
      <h2>Camera Settings</h2>
      <div className="panel-body">
        {linkDown && (
          <div className="section" style={{ color: 'var(--warn)' }}>
            ControlLink is {controlLink?.state ?? 'unknown'} — camhandler must be running with a connected camera for settings to take effect.
          </div>
        )}

        <div className="section">
          <div className="row">
            <button className="secondary" disabled={status !== 'open' || linkDown} onClick={runDiagnose}>
              Diagnose writability
            </button>
            <span style={{ color: 'var(--dim)' }}>
              Asks the camera what's currently settable. Most writes need PriorityKey=PC Remote + the camera in PC Remote USB mode.
            </span>
          </div>
          {diagnose && !diagnose.ok && (
            <div className="row" style={{ marginLeft: 0, color: 'var(--bad)' }}>
              diagnose failed: {diagnose.error || 'unknown'}
            </div>
          )}
          {diagnose?.ok && (
            <div className="records" style={{ marginTop: 6, maxHeight: 220 }}>
              <table>
                <thead><tr><th>property</th><th>writable</th><th>options</th></tr></thead>
                <tbody>
                  {diagnose.entries.map((e, i) => (
                    <tr key={i}>
                      <td>{e.name}</td>
                      <td>
                        {e.writable === 1 ? <span className="badge good">yes</span>
                          : e.writable === 0 ? <span className="badge">read-only</span>
                          : <span className="badge bad">not reported</span>}
                      </td>
                      <td>{e.options}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <NumericRow
          label="Focus distance" sKey="focus_distance_m"
          defaultValue={5.0} step={0.1} unit="m"
          send={send} status={status}
          lastResult={settingResults.focus_distance_m}
        />
        <DropdownRow
          label="ISO" listKey="iso" setKey="iso_index"
          send={send} status={status} controlLink={controlLink}
          options={options} lastResult={settingResults.iso_index}
        />
        <DropdownRow
          label="White Balance" listKey="white_balance" setKey="white_balance_index"
          send={send} status={status} controlLink={controlLink}
          options={options} lastResult={settingResults.white_balance_index}
        />
        <DropdownRow
          label="Shutter Speed" listKey="shutter_speed" setKey="shutter_speed_index"
          send={send} status={status} controlLink={controlLink}
          options={options} lastResult={settingResults.shutter_speed_index}
        />
      </div>
    </div>
  );
}
