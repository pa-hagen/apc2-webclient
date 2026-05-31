import React, { useEffect, useState } from 'react';
import { useApc2Socket, defaultWsUrl } from './api/socket.js';
import GcsPanel from './components/GcsPanel.jsx';
import VehiclePanel from './components/VehiclePanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import LivePanel from './components/LivePanel.jsx';

export default function App() {
  const [url, setUrl] = useState(defaultWsUrl());
  const { status, welcome, snapshot, stats, controlLink, captures, records, wire, settingResults, options, diagnose, send } = useApc2Socket(url);
  const runDiagnose = () => send({ t: 'diagnose', reqId: `diag-${Date.now()}` });

  // Persist whatever the user typed so a refresh keeps the same target.
  useEffect(() => { try { localStorage.setItem('apc2_ws', url); } catch { /* ignore */ } }, [url]);

  return (
    <div className="app">
      <div className="topbar">
        <span className="title">apc2 web client</span>
        <span className={`dot ${status === 'open' ? 'on' : status === 'connecting' ? 'warn' : 'off'}`} />
        <span style={{ color: 'var(--dim)' }}>{status}</span>
        <span className="url">→</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} />
        {welcome?.apc2 && (
          <span style={{ color: 'var(--dim)' }}>
            apc2 sysid={welcome.apc2.sysid} compid={welcome.apc2.compid}
            {welcome.config?.camera && ` · ${welcome.config.camera.vendor} ${welcome.config.camera.model}`}
          </span>
        )}
      </div>

      <GcsPanel send={send} status={status} stats={stats} />
      <VehiclePanel send={send} status={status} />
      <SettingsPanel
        send={send} status={status} controlLink={controlLink}
        settingResults={settingResults} options={options}
        diagnose={diagnose} runDiagnose={runDiagnose}
      />
      <LivePanel
        snapshot={snapshot}
        captures={captures}
        records={records}
        wire={wire}
        controlLink={controlLink}
      />
    </div>
  );
}
