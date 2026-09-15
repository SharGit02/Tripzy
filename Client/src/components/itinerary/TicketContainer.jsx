import React, { useRef, useState, useEffect } from "react";

export default function TicketContainer({ children, className = "" }) {
  const containerRef = useRef(null);
  const [clipPath, setClipPath] = useState("");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const updateClipPath = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return;

      const toothW = 16; // width of each tooth triangle
      const toothH = 7;  // depth of each tooth cutout

      const points = [];

      // 1. TOP EDGE: left to right (y = 0 is top)
      const numTeethX = Math.max(1, Math.floor(w / toothW));
      const stepX = w / numTeethX;
      
      for (let i = 0; i < numTeethX; i++) {
        const xStart = i * stepX;
        const xMid = xStart + stepX / 2;
        points.push(`${xStart.toFixed(1)}px ${toothH}px`);
        points.push(`${xMid.toFixed(1)}px 0px`);
      }
      points.push(`${w}px ${toothH}px`);

      // 2. RIGHT EDGE: top to bottom (x = w is right)
      const numTeethY = Math.max(1, Math.floor(h / toothW));
      const stepY = h / numTeethY;

      for (let i = 0; i < numTeethY; i++) {
        const yStart = i * stepY;
        const yMid = yStart + stepY / 2;
        points.push(`${(w - toothH).toFixed(1)}px ${yStart.toFixed(1)}px`);
        points.push(`${w}px ${yMid.toFixed(1)}px`);
      }
      points.push(`${(w - toothH).toFixed(1)}px ${h}px`);

      // 3. BOTTOM EDGE: right to left (y = h is bottom)
      for (let i = numTeethX - 1; i >= 0; i--) {
        const xEnd = (i + 1) * stepX;
        const xMid = i * stepX + stepX / 2;
        points.push(`${xEnd.toFixed(1)}px ${(h - toothH).toFixed(1)}px`);
        points.push(`${xMid.toFixed(1)}px ${h}px`);
      }
      points.push(`0px ${(h - toothH).toFixed(1)}px`);

      // 4. LEFT EDGE: bottom to top (x = 0 is left)
      for (let i = numTeethY - 1; i >= 0; i--) {
        const yEnd = (i + 1) * stepY;
        const yMid = i * stepY + stepY / 2;
        points.push(`${toothH}px ${yEnd.toFixed(1)}px`);
        points.push(`0px ${yMid.toFixed(1)}px`);
      }

      setClipPath(`polygon(${points.join(", ")})`);
    };

    updateClipPath();

    const observer = new ResizeObserver(updateClipPath);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="filter drop-shadow-[0_16px_36px_rgba(15,36,66,0.10)] mb-8">
      <div
        ref={containerRef}
        style={{ clipPath: clipPath || undefined }}
        className={`bg-white relative ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
