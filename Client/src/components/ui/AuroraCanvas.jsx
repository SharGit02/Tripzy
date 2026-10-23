import { useEffect, useRef } from "react";

/**
 * Themed HTML canvas backdrop: drifting route nodes joined by faint lines,
 * over slow-moving aurora blobs. Purely decorative (aria-hidden).
 *
 * Pauses when scrolled out of view and renders a single static frame when the
 * visitor prefers reduced motion.
 */
const PALETTE = ["#91E5F6", "#59A5D8", "#386FA4", "#14b8a6"];

export default function AuroraCanvas({
  className = "",
  density = 0.00009,
  linkDistance = 150,
  blobs = true,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let nodes = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;
    let t = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(
        Math.min(Math.max(width * height * density, 18), 70)
      );
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1 + Math.random() * 1.8,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      }));
    };

    const drawBlobs = () => {
      if (!blobs) return;
      const specs = [
        { cx: 0.18, cy: 0.25, r: 0.45, color: "rgba(89,165,216,0.20)", speed: 0.00022 },
        { cx: 0.82, cy: 0.7, r: 0.4, color: "rgba(20,184,166,0.16)", speed: -0.00017 },
        { cx: 0.55, cy: 0.1, r: 0.35, color: "rgba(145,229,246,0.18)", speed: 0.00029 },
      ];
      for (const s of specs) {
        const drift = Math.sin(t * s.speed) * 0.06;
        const x = (s.cx + drift) * width;
        const y = (s.cy - drift * 0.6) * height;
        const radius = s.r * Math.max(width, height);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, s.color);
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
    };

    const draw = (advance) => {
      ctx.clearRect(0, 0, width, height);
      drawBlobs();

      for (const node of nodes) {
        if (advance) {
          node.x += node.vx;
          node.y += node.vy;
          if (node.x < 0 || node.x > width) node.vx *= -1;
          if (node.y < 0 || node.y > height) node.vy *= -1;
        }
      }

      // Links first so dots sit on top.
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist > linkDistance) continue;
          ctx.strokeStyle = `rgba(56,111,164,${0.3 * (1 - dist / linkDistance)})`;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }

      for (const node of nodes) {
        ctx.fillStyle = node.color;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      t += 16;
      draw(true);
      frame = requestAnimationFrame(loop);
    };

    resize();

    if (reduced) {
      draw(false);
    } else {
      frame = requestAnimationFrame(loop);
    }

    const onResize = () => {
      resize();
      draw(false);
    };
    window.addEventListener("resize", onResize);

    // ponytail: pause offscreen only; no frame budget tuning until it shows up in a profile.
    const observer = new IntersectionObserver(([entry]) => {
      const nowVisible = entry.isIntersecting;
      if (nowVisible === visible) return;
      visible = nowVisible;
      if (reduced) return;
      if (visible) {
        frame = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(frame);
      }
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, [density, linkDistance, blobs]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
}
