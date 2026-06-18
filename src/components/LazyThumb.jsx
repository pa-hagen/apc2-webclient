import { useEffect, useRef, useState } from 'react';

// Defers setting <img src> until the wrapper enters the viewport.
// Useful for scrollable lists; for paginated tables, native loading="lazy" is sufficient.
export default function LazyThumb({ src, alt, className, onError }) {
  const wrapRef = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active) return;
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setActive(true); },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [active]);

  return (
    <span ref={wrapRef} className="lazy-thumb-wrap">
      {active && src && (
        <img src={src} alt={alt} className={className} onError={onError} />
      )}
    </span>
  );
}
