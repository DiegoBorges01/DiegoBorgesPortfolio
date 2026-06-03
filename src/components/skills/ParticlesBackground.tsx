"use client";

import { useRef, useEffect } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  targetAlpha: number;
  size: number;
}

/**
 * Lightweight canvas particle system — ported from the reference portfolio.
 * Renders white dots drifting slowly across a transparent background.
 * Self-contained: no external deps beyond React.
 */
export default function ParticlesBackground({ quantity = 55 }: { quantity?: number }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef       = useRef<number>(0);
  const sizeRef      = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);

    const resize = () => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      sizeRef.current = { w, h };
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
      // Repopulate
      particlesRef.current = Array.from({ length: quantity }, () => makeParticle(w, h));
    };

    const makeParticle = (w: number, h: number): Particle => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      alpha: 0,
      targetAlpha: parseFloat((Math.random() * 0.55 + 0.1).toFixed(2)),
      size: Math.random() * 1.2 + 0.4,
    });

    const draw = () => {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      particlesRef.current.forEach((p, i) => {
        // Fade in/out near edges
        const edgeDist = Math.min(p.x, w - p.x, p.y, h - p.y);
        const edgeFactor = Math.min(edgeDist / 20, 1);
        p.alpha += (p.targetAlpha * edgeFactor - p.alpha) * 0.04;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < -2) p.x = w + 2;
        if (p.x > w + 2) p.x = -2;
        if (p.y < -2) p.y = h + 2;
        if (p.y > h + 2) p.y = -2;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha.toFixed(2)})`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        const next = entries[0]?.isIntersecting ?? true;
        if (next === visible) return;
        visible = next;
        if (visible) {
          rafRef.current = requestAnimationFrame(draw);
        } else {
          cancelAnimationFrame(rafRef.current);
        }
      },
      { rootMargin: "200px 0px" }
    );
    io.observe(container);
    draw();

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      io.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [quantity]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
