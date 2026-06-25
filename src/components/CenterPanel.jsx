import React, { useEffect, useRef, useState } from 'react';

function LiveViewOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function CenterPanel({ liveViewFrame }) {
  const lastFrameAt = useRef(0);
  const [frameStale, setFrameStale] = useState(false);

  useEffect(() => { if (liveViewFrame) lastFrameAt.current = Date.now(); }, [liveViewFrame]);
  useEffect(() => {
    const id = setInterval(
      () => setFrameStale(lastFrameAt.current > 0 && Date.now() - lastFrameAt.current > 3000),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="center-layout">
      <div className="center-live" style={{ flex: 1 }}>
        <div className="liveview-wrap">
          {liveViewFrame
            ? <img
                src={`data:image/jpeg;base64,${liveViewFrame}`}
                alt="live view"
                style={{ filter: frameStale ? 'grayscale(1)' : 'none', transition: 'filter 0.5s' }}
              />
            : <div className="liveview-placeholder" />
          }
          {(!liveViewFrame || frameStale) && (
            <div className="liveview-overlay"><LiveViewOffIcon /></div>
          )}
          {liveViewFrame && !frameStale && (
            <div className="liveview-live-badge">
              <span className="live-dot" />
              LIVE
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
