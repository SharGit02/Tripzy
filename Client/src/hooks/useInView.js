import { useEffect, useRef, useState } from "react";

/**
 * True once the ref'd element has scrolled within `rootMargin` of the
 * viewport, and stays true after (a one-shot reveal, not a visibility
 * toggle) — for gating heavy widgets (a live map, a chart) so they aren't
 * mounted and repainting on every scroll frame before the user ever sees
 * them.
 */
export function useInView({ rootMargin = "200px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView || !ref.current) return;
    const node = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView];
}
