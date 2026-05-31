import React, { useEffect, useRef, useState } from 'react';

// Vehicle-side simulator: pushes telemetry into apc2's MAVLink datastore (via the web bridge) at a
// configurable rate so the settle-gate, snapshot, and per-capture records have realistic inputs.
// Fields use friendly units (deg, m, m/s); the apc2 server converts to wire units.
const defaults = {
  // OSL / 100 m AMSL / heading north — change to your test site.
  lat: 59.91273,
  lon: 10.74609,
  alt_amsl_m: 100,
  alt_rel_m: 50,
  heading_deg: 0,
  veh_roll_deg: 0,
  veh_pitch_deg: 0,
  veh_yaw_deg: 0,
  gimbal_roll_deg: 0,
  gimbal_pitch_deg: -90,
  gimbal_yaw_deg: 0,
  gimbal_yaw_abs_deg: 0,
  agl_m: 50,
  groundspeed_mps: 0,
  sats: 14,
};

const Field = ({ label, value, onChange, step = 0.1 }) => (
  <div className="row">
    <label>{label}</label>
    <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
  </div>
);

export default function VehiclePanel({ send, status }) {
  const [f, setF] = useState(defaults);
  const [autoSend, setAutoSend] = useState(false);
  const [rateHz, setRateHz] = useState(5);
  const [yawSweepDps, setYawSweepDps] = useState(0);
  const tickRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fRef = useRef(f);
  fRef.current = f;
  const disabled = status !== 'open';

  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const sendAll = () => {
    const cur = fRef.current;
    // SYSTEM_TIME first so apc2's bestTimeMs() picks up wall-clock now.
    send({ t: 'telemetry', msg: 'SYSTEM_TIME', fields: { time_unix_usec: Date.now() * 1000 } });
    send({ t: 'telemetry', msg: 'GLOBAL_POSITION_INT', fields: {
      lat: cur.lat, lon: cur.lon,
      alt_amsl_m: cur.alt_amsl_m, alt_rel_m: cur.alt_rel_m,
      heading_deg: cur.heading_deg,
    }});
    send({ t: 'telemetry', msg: 'ATTITUDE', fields: {
      roll_deg: cur.veh_roll_deg, pitch_deg: cur.veh_pitch_deg, yaw_deg: cur.veh_yaw_deg,
    }});
    send({ t: 'telemetry', msg: 'MOUNT_ORIENTATION', fields: {
      roll_deg: cur.gimbal_roll_deg, pitch_deg: cur.gimbal_pitch_deg,
      yaw_deg: cur.gimbal_yaw_deg, yaw_absolute_deg: cur.gimbal_yaw_abs_deg,
    }});
    send({ t: 'telemetry', msg: 'TERRAIN_REPORT', fields: {
      lat: cur.lat, lon: cur.lon, agl_m: cur.agl_m,
    }});
    send({ t: 'telemetry', msg: 'GPS_RAW_INT', fields: {
      lat: cur.lat, lon: cur.lon, alt_amsl_m: cur.alt_amsl_m, sats: cur.sats, fix_type: 3,
    }});
    send({ t: 'telemetry', msg: 'VFR_HUD', fields: {
      groundspeed_mps: cur.groundspeed_mps, heading_deg: cur.heading_deg, alt_amsl_m: cur.alt_amsl_m,
    }});
  };

  // Auto-streamer: drives values at rateHz Hz and optionally slews gimbal yaw at yawSweepDps deg/s
  // so you can exercise the settle-gate.
  useEffect(() => {
    if (!autoSend || disabled) return;
    let timer = null;
    const tick = () => {
      const now = performance.now();
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      if (yawSweepDps !== 0) {
        setF((s) => {
          const next = (s.gimbal_yaw_abs_deg + yawSweepDps * dt + 540) % 360 - 180;
          return { ...s, gimbal_yaw_abs_deg: next, gimbal_yaw_deg: next };
        });
      }
      sendAll();
      tickRef.current++;
      timer = setTimeout(tick, Math.max(50, Math.round(1000 / Math.max(1, rateHz))));
    };
    lastTimeRef.current = performance.now();
    timer = setTimeout(tick, 0);
    return () => { if (timer) clearTimeout(timer); };
  // sendAll closes over fRef so we don't need it in deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend, rateHz, yawSweepDps, disabled]);

  return (
    <div className="panel">
      <h2>Vehicle Simulator</h2>
      <div className="panel-body">

        <div className="section">
          <h3>Position</h3>
          <Field label="Latitude" value={f.lat} onChange={set('lat')} step={0.00001} />
          <Field label="Longitude" value={f.lon} onChange={set('lon')} step={0.00001} />
          <Field label="Alt AMSL (m)" value={f.alt_amsl_m} onChange={set('alt_amsl_m')} step={1} />
          <Field label="Alt Rel (m)" value={f.alt_rel_m} onChange={set('alt_rel_m')} step={1} />
          <Field label="AGL (m)" value={f.agl_m} onChange={set('agl_m')} step={1} />
          <Field label="Heading (°)" value={f.heading_deg} onChange={set('heading_deg')} step={1} />
          <Field label="Groundspeed m/s" value={f.groundspeed_mps} onChange={set('groundspeed_mps')} step={0.1} />
          <Field label="GPS sats" value={f.sats} onChange={set('sats')} step={1} />
        </div>

        <div className="section">
          <h3>Vehicle attitude</h3>
          <Field label="Roll (°)" value={f.veh_roll_deg} onChange={set('veh_roll_deg')} step={1} />
          <Field label="Pitch (°)" value={f.veh_pitch_deg} onChange={set('veh_pitch_deg')} step={1} />
          <Field label="Yaw (°)" value={f.veh_yaw_deg} onChange={set('veh_yaw_deg')} step={1} />
        </div>

        <div className="section">
          <h3>Gimbal (MOUNT_ORIENTATION)</h3>
          <Field label="Roll (°)" value={f.gimbal_roll_deg} onChange={set('gimbal_roll_deg')} step={1} />
          <Field label="Pitch (°)" value={f.gimbal_pitch_deg} onChange={set('gimbal_pitch_deg')} step={1} />
          <Field label="Yaw body (°)" value={f.gimbal_yaw_deg} onChange={set('gimbal_yaw_deg')} step={1} />
          <Field label="Yaw abs (°)" value={f.gimbal_yaw_abs_deg} onChange={set('gimbal_yaw_abs_deg')} step={1} />
        </div>

        <div className="section">
          <h3>Streaming</h3>
          <div className="row">
            <label>Rate (Hz)</label>
            <input type="number" min="1" max="50" value={rateHz} onChange={(e) => setRateHz(parseInt(e.target.value, 10) || 1)} />
          </div>
          <div className="row">
            <label>Gimbal yaw sweep</label>
            <input type="number" step={1} value={yawSweepDps} onChange={(e) => setYawSweepDps(parseFloat(e.target.value) || 0)} />
            <span style={{ color: 'var(--dim)' }}>°/s</span>
          </div>
          <div className="row">
            <button disabled={disabled} onClick={() => setAutoSend((v) => !v)}>
              {autoSend ? 'Stop streaming' : 'Start streaming'}
            </button>
            <button className="secondary" disabled={disabled} onClick={sendAll}>Send once</button>
          </div>
        </div>

      </div>
    </div>
  );
}
