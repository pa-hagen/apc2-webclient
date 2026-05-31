import React from 'react';

const fmt = (v, d = 3) => (v == null || Number.isNaN(v) ? '—' : (typeof v === 'number' ? v.toFixed(d) : String(v)));
const time = (ts) => new Date(ts).toISOString().slice(11, 23);

export default function LivePanel({ snapshot, captures, records, wire, controlLink }) {
  return (
    <div className="panel">
      <h2>Live</h2>
      <div className="panel-body">

        <div className="section">
          <h3>ControlLink (camhandler)</h3>
          <div className="row">
            <span className={`dot ${controlLink.state === 'up' ? 'on' : controlLink.state === 'down' ? 'off' : ''}`} />
            <span style={{ color: 'var(--dim)' }}>{controlLink.state ?? 'unknown'}</span>
            {controlLink.info?.vendor && (
              <span style={{ marginLeft: 8 }}>
                {controlLink.info.vendor} {controlLink.info.model}
                {controlLink.info.can_capture_image ? ' (capture=yes)' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="section">
          <h3>Datastore snapshot</h3>
          {!snapshot ? (
            <div style={{ color: 'var(--dim)' }}>(no telemetry yet — push some from the Vehicle panel)</div>
          ) : (
            <div className="kv">
              <div className="k">time</div><div className="v">{snapshot.time_iso}</div>
              <div className="k">lat / lon</div><div className="v">{fmt(snapshot.lat, 6)} / {fmt(snapshot.lon, 6)}</div>
              <div className="k">alt amsl / rel</div><div className="v">{fmt(snapshot.alt_amsl_m, 1)} / {fmt(snapshot.alt_rel_m, 1)} m</div>
              <div className="k">AGL</div><div className="v">{fmt(snapshot.agl_m, 1)} m</div>
              <div className="k">heading</div><div className="v">{fmt(snapshot.heading_deg, 1)}°</div>
              <div className="k">veh r/p/y</div><div className="v">{fmt(snapshot.veh_roll_deg, 1)} / {fmt(snapshot.veh_pitch_deg, 1)} / {fmt(snapshot.veh_yaw_deg, 1)}°</div>
              <div className="k">gimbal r/p/y</div><div className="v">{fmt(snapshot.gimbal_roll_deg, 1)} / {fmt(snapshot.gimbal_pitch_deg, 1)} / {fmt(snapshot.gimbal_yaw_deg, 1)}°</div>
              <div className="k">gimbal yaw abs</div><div className="v">{fmt(snapshot.gimbal_yaw_abs_deg, 1)}° (true N)</div>
              <div className="k">gimbal yaw rate</div><div className="v">{fmt(snapshot.gimbal_yaw_abs_rate_dps, 2)} °/s (abs); {fmt(snapshot.gimbal_yaw_rate_dps, 2)} °/s (body)</div>
              <div className="k">groundspeed</div><div className="v">{fmt(snapshot.groundspeed_mps, 2)} m/s</div>
              <div className="k">GPS fix / sats</div><div className="v">{snapshot.gps_fix ?? '—'} / {snapshot.gps_sats ?? '—'}</div>
            </div>
          )}
        </div>

        <div className="section">
          <h3>Capture results ({captures.length})</h3>
          <div className="records">
            <table>
              <thead>
                <tr><th>time</th><th>seq</th><th>result</th><th>file / reason</th></tr>
              </thead>
              <tbody>
                {captures.map((c, i) => (
                  <tr key={i} className={`cap-row ${c.success ? 'ok' : 'fail'} ${c.drift ? 'drift' : ''}`}>
                    <td>{time(c.ts)}</td>
                    <td>{c.seq}</td>
                    <td>{c.success ? 'OK' : 'FAIL'}{c.drift ? ' (drift)' : ''}{c.orphan ? ' (orphan)' : ''}</td>
                    <td>{c.success ? (c.file || '—') : (c.reason || '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section">
          <h3>Records ({records.length})</h3>
          <div className="records">
            <table>
              <thead>
                <tr><th>time</th><th>seq</th><th>file</th><th>lat / lon</th><th>gimbal y_abs</th><th>AGL</th><th>settled</th></tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const rec = r.record || {};
                  return (
                    <tr key={i}>
                      <td>{time(r.ts)}</td>
                      <td>{rec.seq}</td>
                      <td>{rec.filename || '—'}</td>
                      <td>{fmt(rec.lat, 5)} / {fmt(rec.lon, 5)}</td>
                      <td>{fmt(rec.gimbal_yaw_abs_deg, 1)}°</td>
                      <td>{fmt(rec.agl_m, 1)}</td>
                      <td>{rec.gimbal_settled === false ? <span className="badge bad">no</span> : <span className="badge good">yes</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section">
          <h3>MAVLink wire log</h3>
          <div className="log">
            {wire.map((w, i) => (
              <div key={i} className={`line ${w.dir}`}>
                {time(w.ts)} {w.dir === 'in' ? '<-' : w.dir === 'out' ? '->' : '!!'} {w.name || `msgid=${w.msgid}`}{w.error ? ` ${w.error}` : ''}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
