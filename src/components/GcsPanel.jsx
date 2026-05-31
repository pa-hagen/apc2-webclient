import React, { useState } from 'react';

// GCS-side controls: the same MAVLink commands a real ground station would send. Each button
// synthesizes a CommandLong addressed to apc2 (sysid 1 / compid 100 in the default config) on the
// server side. The "request" buttons ask apc2 to emit CAMERA_INFORMATION etc., so you can verify
// the camera handshake is alive end-to-end.
export default function GcsPanel({ send, status, stats }) {
  const [count, setCount] = useState(1);
  const [seqStart, setSeqStart] = useState('');
  const disabled = status !== 'open';

  const capture = () => send({
    t: 'gcs',
    cmd: 'capture',
    count: Math.max(1, Math.min(100, parseInt(count, 10) || 1)),
    seqStart: seqStart === '' ? undefined : parseInt(seqStart, 10),
  });
  const setMode = (mode) => send({ t: 'gcs', cmd: 'set-mode', mode });
  const request = (which) => send({ t: 'gcs', cmd: 'request', which });

  return (
    <div className="panel">
      <h2>GCS Simulator</h2>
      <div className="panel-body">

        <div className="section">
          <h3>Capture</h3>
          <div className="row">
            <label>Count</label>
            <input type="number" min="1" max="100" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div className="row">
            <label>Seq start</label>
            <input type="number" placeholder="(auto)" value={seqStart} onChange={(e) => setSeqStart(e.target.value)} />
          </div>
          <div className="row">
            <button disabled={disabled} onClick={capture}>IMAGE_START_CAPTURE</button>
          </div>
        </div>

        <div className="section">
          <h3>Camera Mode</h3>
          <div className="row">
            <button className="secondary" disabled={disabled} onClick={() => setMode(0)}>SET_CAMERA_MODE = IMAGE (0)</button>
          </div>
          <div className="row">
            <button className="secondary" disabled={disabled} onClick={() => setMode(1)}>SET_CAMERA_MODE = VIDEO (1)</button>
          </div>
        </div>

        <div className="section">
          <h3>REQUEST_MESSAGE</h3>
          <div className="row">
            <button className="secondary" disabled={disabled} onClick={() => request('info')}>CAMERA_INFORMATION</button>
          </div>
          <div className="row">
            <button className="secondary" disabled={disabled} onClick={() => request('settings')}>CAMERA_SETTINGS</button>
          </div>
          <div className="row">
            <button className="secondary" disabled={disabled} onClick={() => request('storage')}>STORAGE_INFORMATION</button>
          </div>
          <div className="row">
            <button className="secondary" disabled={disabled} onClick={() => request('status')}>CAMERA_CAPTURE_STATUS</button>
          </div>
          <div className="row">
            <button className="secondary" disabled={disabled} onClick={() => request('component')}>COMPONENT_INFORMATION</button>
          </div>
        </div>

        <div className="section">
          <h3>Camera Ledger</h3>
          <div className="kv">
            <div className="k">requested</div><div className="v">{stats?.requested ?? 0}</div>
            <div className="k">succeeded</div><div className="v">{stats?.succeeded ?? 0}</div>
            <div className="k">failed</div><div className="v">{stats?.failed ?? 0}</div>
            <div className="k">orphaned</div><div className="v">{stats?.orphaned ?? 0}</div>
            <div className="k">drift</div><div className="v">{stats?.drift ?? 0}</div>
            <div className="k">queued</div><div className="v">{stats?.queued ?? 0}</div>
            <div className="k">in-flight</div><div className="v">{stats?.inFlight ?? 0}</div>
          </div>
        </div>

      </div>
    </div>
  );
}
