import * as stylex from '@stylexjs/stylex';
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { atmosphere, atmosphereSnapshot, subscribeAtmosphere } from '../lib/atmosphere';
import { reducedMotion, rgba } from '../lib/canvas';
import { color } from '../tokens.stylex';

export type DialItem = { key: string | number; label: string; disabled?: boolean; aria?: string };

type Props = {
  items: DialItem[];
  index: number;
  /** 다이얼이 새 칸에 멈췄을 때 */
  onChange: (index: number) => void;
  /** 가운데 칸을 누르거나 Enter 를 눌렀을 때 */
  onCommit?: (index: number) => void;
  radius: number;
  stepDeg: number;
  fontSize: number;
  height: number;
  /** 가운데 양옆으로 보이는 칸 수 */
  visible: number;
  sideScale: number;
  sideOpacity: number;
  weight: number;
  /** 가운데 칸이 확정 선택된 상태인지 (눈금에 점으로 표시) */
  marked?: boolean;
  ariaLabel: string;
  id: string;
};

const s = stylex.create({
  root: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    cursor: { default: 'grab', ':active': 'grabbing' },
    userSelect: 'none',
    touchAction: 'none',
    outlineStyle: 'none',
  },
  canvas: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' },
  item: {
    position: 'absolute',
    left: '50%',
    transformOrigin: '0 0',
    willChange: 'transform',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  label: {
    display: 'block',
    transformOrigin: '50% 100%',
    paddingInline: '0.18em',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.01em',
    color: color.ink,
  },
  disabled: { fontWeight: 300 },
});

const K = 190;
const C = 25;

/**
 * 화면 아래에 중심을 둔 큰 원의 윗부분만 보이는 다이얼.
 * 끌거나, 숫자를 누르거나, 휠·방향키로 돌린다. 비활성 칸에는 멈추지 못하고 되돌아온다.
 */
export function Dial(props: Props) {
  const { items, index, radius, fontSize, height, weight, ariaLabel, id } = props;
  useSyncExternalStore(subscribeAtmosphere, atmosphereSnapshot);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const P = useRef(props);
  P.current = props;
  const st = useRef({
    pos: index,
    vel: 0,
    target: index as number,
    raf: 0,
    last: 0,
    focus: false,
    drag: null as null | { id: number; x0: number; pos0: number; moved: boolean; samples: { t: number; x: number }[] },
    wheel: 0,
    wheelAt: 0,
  }).current;

  const baseline = Math.round(fontSize * 1.1);

  const layout = () => {
    const p = P.current;
    const R = p.radius;
    const base = Math.round(p.fontSize * 1.1);
    for (let i = 0; i < p.items.length; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const d = i - st.pos;
      const ad = Math.abs(d);
      const label = el.firstElementChild as HTMLElement;
      if (ad > p.visible + 0.7) {
        el.style.visibility = 'hidden';
        continue;
      }
      el.style.visibility = 'visible';
      el.style.top = `${base + R}px`;
      el.style.transform = `rotate(${(d * p.stepDeg).toFixed(3)}deg) translate(-50%, calc(-100% - ${R}px))`;
      const near = Math.min(1, ad);
      let o = ad < 1 ? 1 - (1 - p.sideOpacity) * ad : p.sideOpacity * Math.max(0, 1 - (ad - 1) / (p.visible - 0.35));
      if (p.items[i].disabled) o *= 0.5;
      label.style.opacity = o.toFixed(3);
      label.style.transform = `scale(${(1 - (1 - p.sideScale) * near).toFixed(3)})`;
    }
    drawTicks();
  };

  const drawTicks = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const p = P.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const R = p.radius;
    const cx = W / 2;
    const cy = Math.round(p.fontSize * 1.1) + R;
    const ink = atmosphere.ink;
    const step = (p.stepDeg * Math.PI) / 180;
    const SUB = 5;
    const span = p.visible + 0.9;
    const first = Math.ceil((st.pos - span) * SUB);
    const lastTick = Math.floor((st.pos + span) * SUB);
    ctx.lineCap = 'round';
    for (let k = first; k <= lastTick; k++) {
      const d = k / SUB - st.pos;
      const a = d * step;
      const major = k % SUB === 0;
      const fade = Math.max(0, 1 - Math.pow(Math.abs(d) / span, 2));
      const r0 = R - 7;
      const r1 = R - (major ? 15 : 10.5);
      const sx = Math.sin(a);
      const cxs = Math.cos(a);
      ctx.strokeStyle = rgba(ink, (major ? 0.6 : 0.28) * fade);
      ctx.lineWidth = major ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + r0 * sx, cy - r0 * cxs);
      ctx.lineTo(cx + r1 * sx, cy - r1 * cxs);
      ctx.stroke();
    }
    // 고정된 선택 표식: 가운데 눈금. 확정되면 점이 찍힌다.
    ctx.strokeStyle = rgba(ink, 1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - R + 6);
    ctx.lineTo(cx, cy - R + 19);
    ctx.stroke();
    if (p.marked) {
      ctx.fillStyle = rgba(ink, 1);
      ctx.beginPath();
      ctx.arc(cx, cy - R + 26, 2.6, 0, 6.283);
      ctx.fill();
    }
    if (st.focus) {
      ctx.strokeStyle = rgba(ink, 0.9);
      ctx.lineWidth = 2;
      const w = p.fontSize * (p.items[Math.round(st.pos)]?.label.length ?? 2) * 0.72 + 12;
      const h = p.fontSize * 1.08;
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, Math.round(p.fontSize * 1.1) - h + 1, w, h, 8);
      ctx.stroke();
    }
  };

  const nearestEnabled = (i: number, dir = 0) => {
    const n = P.current.items.length;
    const c = Math.max(0, Math.min(n - 1, i));
    if (!P.current.items[c]?.disabled) return c;
    for (let d = 1; d < n; d++) {
      const order = dir >= 0 ? [c + d, c - d] : [c - d, c + d];
      for (const j of order) if (j >= 0 && j < n && !P.current.items[j].disabled) return j;
    }
    return P.current.index;
  };

  const run = () => {
    if (st.raf) return;
    st.last = performance.now();
    const frame = (t: number) => {
      st.raf = 0;
      const dt = Math.min(0.032, (t - st.last) / 1000);
      st.last = t;
      if (!st.drag) {
        if (reducedMotion()) {
          st.pos = st.target;
          st.vel = 0;
        } else {
          const a = -K * (st.pos - st.target) - C * st.vel;
          st.vel += a * dt;
          st.pos += st.vel * dt;
        }
        if (Math.abs(st.vel) < 0.02 && Math.abs(st.pos - st.target) < 0.002) {
          st.pos = st.target;
          st.vel = 0;
          layout();
          if (st.target !== P.current.index) P.current.onChange(st.target);
          return;
        }
      }
      layout();
      st.raf = requestAnimationFrame(frame);
    };
    st.raf = requestAnimationFrame(frame);
  };

  const goTo = (i: number, dir = 0) => {
    st.target = nearestEnabled(i, dir);
    run();
  };

  const step = (dir: number) => {
    const n = P.current.items.length;
    let j = st.target + dir;
    while (j >= 0 && j < n && P.current.items[j].disabled) j += dir;
    if (j < 0 || j >= n) {
      st.vel += dir * 5; // 더 갈 곳이 없으면 살짝 튕긴다
      run();
      return;
    }
    goTo(j, dir);
  };

  // 바깥에서 값이 바뀌면 그쪽으로 돌아간다
  useEffect(() => {
    if (!st.drag && st.target !== index) {
      st.target = index;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useLayoutEffect(layout);

  useEffect(() => {
    const ro = new ResizeObserver(() => layout());
    if (rootRef.current) ro.observe(rootRef.current);
    document.fonts?.ready.then(layout);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(st.raf);
      st.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pxPerStep = () => (P.current.radius * P.current.stepDeg * Math.PI) / 180;
  const rubber = (x: number) => {
    const max = P.current.items.length - 1;
    if (x < 0) return x * 0.35;
    if (x > max) return max + (x - max) * 0.35;
    return x;
  };

  return (
    <div
      ref={rootRef}
      id={id}
      role="listbox"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      aria-activedescendant={`${id}-${index}`}
      tabIndex={0}
      {...stylex.props(s.root)}
      style={{ height, fontSize, fontWeight: weight }}
      onFocus={(e) => {
        st.focus = e.currentTarget.matches(':focus-visible');
        drawTicks();
      }}
      onBlur={() => {
        st.focus = false;
        drawTicks();
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(1);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-1);
        else if (e.key === 'Home') goTo(0, 1);
        else if (e.key === 'End') goTo(items.length - 1, -1);
        else if (e.key === 'Enter' || e.key === ' ') props.onCommit?.(st.target);
        else return;
        e.preventDefault();
      }}
      onWheel={(e) => {
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        const t = performance.now();
        if (t - st.wheelAt > 300) st.wheel = 0;
        st.wheel += d;
        if (Math.abs(st.wheel) > 46 && t - st.wheelAt > 110) {
          st.wheelAt = t;
          step(st.wheel > 0 ? 1 : -1);
          st.wheel = 0;
        }
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        st.drag = { id: e.pointerId, x0: e.clientX, pos0: st.pos, moved: false, samples: [{ t: performance.now(), x: e.clientX }] };
        st.vel = 0;
      }}
      onPointerMove={(e) => {
        const g = st.drag;
        if (!g || g.id !== e.pointerId) return;
        const dx = e.clientX - g.x0;
        if (Math.abs(dx) > 5) g.moved = true;
        if (!g.moved) return;
        st.pos = rubber(g.pos0 - dx / pxPerStep());
        g.samples.push({ t: performance.now(), x: e.clientX });
        if (g.samples.length > 6) g.samples.shift();
        run();
      }}
      onPointerUp={(e) => {
        const g = st.drag;
        if (!g || g.id !== e.pointerId) return;
        st.drag = null;
        if (!g.moved) {
          const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-dial-i]');
          const owner = hit?.closest('[role="listbox"]');
          if (hit && owner === e.currentTarget) {
            const i = Number(hit.getAttribute('data-dial-i'));
            if (i === st.target) props.onCommit?.(i);
            else if (!items[i].disabled) goTo(i);
            else {
              st.vel += Math.sign(i - st.pos) * 4.5; // 비활성 칸: 살짝 끌려갔다 돌아온다
              run();
            }
          }
          return;
        }
        const a = g.samples[0];
        const b = g.samples[g.samples.length - 1];
        const v = b.t - a.t > 8 ? (-(b.x - a.x) / pxPerStep() / (b.t - a.t)) * 1000 : 0;
        st.vel = v;
        st.target = nearestEnabled(Math.round(st.pos + v * 0.16), Math.sign(v));
        run();
      }}
      onPointerCancel={() => {
        st.drag = null;
        st.target = nearestEnabled(Math.round(st.pos));
        run();
      }}
    >
      <canvas ref={canvasRef} aria-hidden {...stylex.props(s.canvas)} />
      {items.map((it, i) => (
        <div
          key={it.key}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === index}
          aria-disabled={it.disabled || undefined}
          aria-label={it.aria}
          data-dial-i={i}
          {...stylex.props(s.item)}
          style={{ top: baseline + radius }}
        >
          <span {...stylex.props(s.label, it.disabled && s.disabled)}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}
