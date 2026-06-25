import React, { useRef, useState } from 'react';

// Control chars that cannot appear in id/name
const BAD_CHAR_RE = /[\x00-\x1f\x7f]/;

function validateStr(val, label) {
  if (!val && val !== 0) return `${label} is empty`;
  if (BAD_CHAR_RE.test(String(val))) return `${label} contains invalid control characters`;
  return null;
}

function ImportDialog({ httpBase, onClose, onImported }) {
  const [step, setStep]         = useState('pick');   // 'pick' | 'map' | 'importing' | 'done' | 'error'
  const [geoJson, setGeoJson]   = useState(null);
  const [propKeys, setPropKeys] = useState([]);
  const [mapping, setMapping]   = useState({ sl_id: '', id: '', name: '', group: '' });
  const [result, setResult]     = useState(null);
  const fileRef = useRef();

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        const features = json.type === 'FeatureCollection' ? json.features
          : json.type === 'Feature' ? [json] : [];
        if (features.length === 0) { setResult({ ok: false, error: 'No features found in GeoJSON' }); setStep('error'); return; }
        // Collect all property keys present across features
        const keySet = new Set();
        for (const f of features) Object.keys(f?.properties ?? {}).forEach((k) => keySet.add(k));
        const keys = [...keySet].sort();
        setGeoJson({ features });
        setPropKeys(keys);
        setMapping({ sl_id: keys[0] ?? '', id: keys[1] ?? '', name: '', group: '' });
        setStep('map');
      } catch (e) {
        setResult({ ok: false, error: `JSON parse error: ${e.message}` });
        setStep('error');
      }
    };
    reader.readAsText(file);
  };

  const doImport = async () => {
    if (!mapping.sl_id || !mapping.id) return;
    setStep('importing');
    try {
      const res = await fetch(`${httpBase}/assets/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: geoJson.features, mapping: { sl_id: mapping.sl_id, id: mapping.id, name: mapping.name || null, group: mapping.group || null } }),
      });
      const body = await res.json();
      if (body.ok) {
        setResult({ ok: true, count: body.count });
        setStep('done');
        onImported?.();
      } else {
        setResult({ ok: false, errors: body.errors ?? [body.error] });
        setStep('error');
      }
    } catch (e) {
      setResult({ ok: false, errors: [e.message] });
      setStep('error');
    }
  };

  return (
    <div className="asset-dialog-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="asset-dialog">
        <div className="asset-dialog-header">
          <span>Import Asset List (GeoJSON)</span>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="asset-dialog-body">

          {step === 'pick' && (
            <>
              <p style={{ color: 'var(--dim)', marginTop: 0 }}>Select a GeoJSON file (.geojson or .json). Feature properties will be mapped to asset fields.</p>
              <input ref={fileRef} type="file" accept=".geojson,.json,application/geo+json,application/json" style={{ display: 'none' }} onChange={onFile} />
              <button onClick={() => fileRef.current?.click()}>Choose file…</button>
            </>
          )}

          {step === 'map' && (
            <>
              <p style={{ color: 'var(--dim)', marginTop: 0 }}>{geoJson.features.length} features found. Map GeoJSON properties to asset fields:</p>
              <div className="kv" style={{ marginBottom: 12 }}>
                <div className="k">SL_ID <span style={{ color: 'var(--bad)' }}>*</span></div>
                <div className="v">
                  <select value={mapping.sl_id} onChange={(e) => setMapping((m) => ({ ...m, sl_id: e.target.value }))} style={{ width: '100%' }}>
                    {propKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>must be an integer — sent via MAVLink USER_1 command</div>
                </div>
                <div className="k">ID <span style={{ color: 'var(--bad)' }}>*</span></div>
                <div className="v">
                  <select value={mapping.id} onChange={(e) => setMapping((m) => ({ ...m, id: e.target.value }))} style={{ width: '100%' }}>
                    {propKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div className="k">Name</div>
                <div className="v">
                  <select value={mapping.name} onChange={(e) => setMapping((m) => ({ ...m, name: e.target.value }))} style={{ width: '100%' }}>
                    <option value="">(none)</option>
                    {propKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>optional display label</div>
                </div>
                <div className="k">Group</div>
                <div className="v">
                  <select value={mapping.group} onChange={(e) => setMapping((m) => ({ ...m, group: e.target.value }))} style={{ width: '100%' }}>
                    <option value="">(none)</option>
                    {propKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>optional grouping/category</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={doImport} disabled={!mapping.sl_id || !mapping.id}>Import {geoJson.features.length} assets</button>
                <button className="secondary" onClick={onClose}>Cancel</button>
              </div>
            </>
          )}

          {step === 'importing' && (
            <p style={{ color: 'var(--dim)' }}>Importing…</p>
          )}

          {step === 'done' && (
            <>
              <p style={{ color: 'var(--good)' }}>Imported {result.count} assets successfully.</p>
              <button onClick={onClose}>Close</button>
            </>
          )}

          {step === 'error' && (
            <>
              <p style={{ color: 'var(--bad)', marginTop: 0 }}>Import failed:</p>
              <ul style={{ margin: '0 0 12px', padding: '0 0 0 18px', color: 'var(--bad)', fontSize: 11 }}>
                {(result.errors ?? [result.error]).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep('map')} disabled={!geoJson}>Back</button>
                <button className="secondary" onClick={onClose}>Close</button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default function AssetPanel({ assets = [], httpBase = '', currentMastSlId = null }) {
  const [open, setOpen]         = useState(false);
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="center-asset-section">
      <div className="section-head collapsible" onClick={() => setOpen((v) => !v)}>
        <h3>Asset List ({assets.length})</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="icon-btn"
            title="Import GeoJSON"
            onClick={(e) => { e.stopPropagation(); setShowImport(true); }}
          >
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 1v7M3.5 5.5L6 8l2.5-2.5" />
              <path d="M1.5 9.5h9" />
            </svg>
          </button>
          <span className="collapse-arrow">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="records asset-table">
          <table>
            <thead>
              <tr>
                <th style={{ width: 56 }}>SL_ID</th>
                <th>ID</th>
                <th>Name</th>
                <th>Group</th>
                <th style={{ width: 56 }}>Captures</th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0
                ? <tr><td colSpan={5} style={{ color: 'var(--dim)', textAlign: 'center', padding: '8px 0' }}>No assets — import a GeoJSON file</td></tr>
                : assets.map((a) => (
                  <tr key={a.sl_id} className={a.sl_id === currentMastSlId ? 'asset-row active' : 'asset-row'}>
                    <td>{a.sl_id}</td>
                    <td>{a.id}</td>
                    <td style={{ color: 'var(--dim)' }}>{a.name ?? '—'}</td>
                    <td style={{ color: 'var(--dim)' }}>{a.group ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{a.capture_count ?? 0}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <ImportDialog
          httpBase={httpBase}
          onClose={() => setShowImport(false)}
          onImported={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
