import { useEffect, useRef } from 'react';

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 캔버스를 요소 크기에 맞추고 매 프레임 draw 를 부른다.
 * draw 가 false 를 돌려주면 다음 invalidate() 까지 루프를 쉰다.
 */
export function useCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number) => boolean | void,
  opts: { maxDpr?: number } = {},
) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const wake = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let w = 0;
    let h = 0;
    let dpr = 1;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr ?? 2);
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // 크기를 바꾸면 캔버스가 지워진다. 같은 프레임 안에 바로 다시 그려 깜빡임을 막는다 (dt = 0).
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current(ctx, w, h, performance.now() / 1000, 0);
      loop.start();
    };

    const frame = (t: number) => {
      raf = 0;
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const keep = drawRef.current(ctx, w, h, t / 1000, dt);
      if (keep !== false) raf = requestAnimationFrame(frame);
    };
    const loop = {
      start() {
        if (!raf) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      },
    };
    wake.current = loop.start;

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, invalidate: () => wake.current() };
}

export const rgba = (c: readonly number[], a: number) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/** 결정적 난수 (같은 seed 면 항상 같은 흔들림) */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
