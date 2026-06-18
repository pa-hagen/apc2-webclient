import React, { useState } from 'react';

export default function GcsPanel({ send, status, stats }) {
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const disabled = status !== 'open';

  return (
    <>
      <div className="section">
        <h3>Image capture</h3>
        <div className="row">
          <button disabled={disabled} onClick={() => send({ t: 'gcs', cmd: 'capture', count: 1 })}>
            Capture Now
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-head collapsible" onClick={() => setLedgerOpen((v) => !v)}>
          <h3>Camera Ledger</h3>
          <span className="collapse-arrow">{ledgerOpen ? '▲' : '▼'}</span>
        </div>
        {ledgerOpen && (
          <div className="kv">
            <div className="k">requested</div><div className="v">{stats?.requested ?? 0}</div>
            <div className="k">succeeded</div><div className="v">{stats?.succeeded ?? 0}</div>
            <div className="k">failed</div><div className="v">{stats?.failed ?? 0}</div>
            <div className="k">orphaned</div><div className="v">{stats?.orphaned ?? 0}</div>
            <div className="k">drift</div><div className="v">{stats?.drift ?? 0}</div>
            <div className="k">queued</div><div className="v">{stats?.queued ?? 0}</div>
            <div className="k">in-flight</div><div className="v">{stats?.inFlight ?? 0}</div>
          </div>
        )}
      </div>
    </>
  );
}
