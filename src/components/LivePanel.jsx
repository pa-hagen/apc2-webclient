import React from 'react';

export default function LivePanel({ previewSeq, pinnedSeq, setPinnedSeq, images = {}, httpBase = '' }) {
  return (
    <div className="section">
      <div className="section-head">
        <h3>Preview{pinnedSeq !== null ? ` — seq ${pinnedSeq}` : ' — latest'}</h3>
        {pinnedSeq !== null && (
          <button className="secondary" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => setPinnedSeq(null)}>
            ↺ latest
          </button>
        )}
      </div>
      <div className="preview-wrap">
        {previewSeq != null ? (
          <img
            key={previewSeq}
            src={`${httpBase}/thumbnail?seq=${previewSeq}&v=${images[previewSeq]?.ts || 0}`}
            alt={`seq ${previewSeq}`}
            className="preview-img"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="preview-placeholder">No captures yet</div>
        )}
      </div>
    </div>
  );
}
