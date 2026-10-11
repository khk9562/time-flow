import * as stylex from '@stylexjs/stylex';
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { atmosphere, atmosphereSnapshot, subscribeAtmosphere } from '../lib/atmosphere';
import { rgba, seeded } from '../lib/canvas';
import { FIRST_HOUR, penRGB, TIME_COLS, TIME_ROWS } from '../lib/store';
import { now } from '../lib/time';
import { color } from '../tokens.stylex';

const s = stylex.create({
  root: { display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', flexGrow: 1, minHeight: 0 },
  // 캔버스의 고유 크기가 레이아웃을 밀어내지 않도록 절대 배치한다
  area: { position: 'relative', minHeight: 0 },
  hours: { display: 'grid', gridTemplateRows: 'repeat(24, minmax(0, 1fr))' },
  hour: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10.5,
    fontWeight: 500,
    lineHeight: 1,
    color: color.inkSoft,
    fontVariantNumeric: 'tabular-nums',
  },
  hourNow: { color: color.ink, fontWeight: 900 },
  canvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    // 좁은 화면(세로로 쌓인 시트)에서는 세로 스크롤을 살리고 가로로 긋는 획만 받는다
    touchAction: { default: 'none', '@media (max-width: 560px)': 'pan-y' },
    cursor: 'crosshair',
    outlineStyle: 'none',
  },
});

/** 형광펜 한 획: 살짝 기운 끝과 고르지 않은 가장자리 */
export function drawStroke(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  rgb: readonly number[], alpha: number, seed: number,
) {
  const rnd = seeded(seed * 9973 + 17);
  const j = () => (rnd() - 0.5) * 1.5;
  const top = y + h * 0.15;
  const bot = y + h * 0.87;
  const x0 = x - 1.5;
  const x1 = x + w + 1.5;
  const slant = Math.min(3, h * 0.18);
  ctx.beginPath();
  ctx.moveTo(x0 + slant, top + j());
  for (let px = x0 + slant + 9; px < x1 - 2; px += 9) ctx.lineTo(px, top + j());
  ctx.lineTo(x1, top + j());
  ctx.lineTo(x1 - slant, bot + j());
  for (let px = x1 - slant - 9; px > x0 + 2; px -= 9) ctx.lineTo(px, bot + j());
  ctx.lineTo(x0, bot + j());
  ctx.closePath();
  ctx.fillStyle = rgba(rgb, alpha);
  ctx.fill();
  ctx.fillStyle = rgba(rgb, alpha * 0.3);
  ctx.fillRect(x0 + slant, bot - h * 0.22, Math.max(0, x1 - x0 - slant * 2), h * 0.13);
}

type Props = {
  cells: number[];
  /** 0 = 쓰기, 1..5 = 형광펜, -1 = 지우개 */
  tool: number;
  isToday: boolean;
  onChange: (cells: number[]) => void;
  /** 펜을 고르지 않은 채 긋기 시작하면 마지막 펜을 꺼내 준다 */
  requestPen: () => number;
};

/** 6시부터 다음날 5시까지, 10분 단위 칸에 형광펜을 긋는 타임라인 */
export function Timeline(props: Props) {
  useSyncExternalStore(subscribeAtmosphere, atmosphereSnapshot);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const P = useRef(props);
  P.current = props;
  const st = useRef({
    stroke: null as null | { id: number; mode: number; x: number; y: number; work: number[]; changed: boolean },
    fresh: new Map<number, number>(),
    cursor: 0,
    focus: false,
    raf: 0,
  }).current;

  const draw = () => {
    st.raf = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cw = W / TIME_COLS;
    const rh = H / TIME_ROWS;
    const cells = st.stroke?.work ?? P.current.cells;
    const { ink, dark } = atmosphere;
    const alpha = dark ? 0.46 : 0.68;

    for (let r = 0; r < TIME_ROWS; r++) {
      let c = 0;
      while (c < TIME_COLS) {
        const v = cells[r * TIME_COLS + c];
        if (!v) {
          c++;
          continue;
        }
        let c1 = c;
        while (c1 + 1 < TIME_COLS && cells[r * TIME_COLS + c1 + 1] === v) c1++;
        drawStroke(ctx, c * cw, r * rh, (c1 - c + 1) * cw, rh, penRGB(v), alpha, r * 7 + c);
        c = c1 + 1;
      }
    }

    // 방금 그은 칸은 잉크가 마르듯 잠깐 더 진하다
    let animating = false;
    const t = performance.now();
    for (const [i, t0] of st.fresh) {
      const age = (t - t0) / 520;
      const v = cells[i];
      if (age >= 1 || !v) {
        st.fresh.delete(i);
        continue;
      }
      animating = true;
      ctx.fillStyle = rgba(penRGB(v), (1 - age) * 0.4);
      ctx.fillRect((i % TIME_COLS) * cw, Math.floor(i / TIME_COLS) * rh + rh * 0.12, cw, rh * 0.78);
    }

    ctx.lineWidth = 1;
    for (let c = 1; c < TIME_COLS; c++) {
      ctx.strokeStyle = rgba(ink, 0.18);
      const x = Math.round(c * cw) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let r = 1; r < TIME_ROWS; r++) {
      ctx.strokeStyle = rgba(ink, r % 6 === 0 ? 0.5 : 0.18);
      const y = Math.round(r * rh) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(ink, 0.62);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, W - 1.5, H - 1.5);

    if (P.current.isToday) {
      const d = now();
      const r = (d.getHours() - FIRST_HOUR + 24) % 24;
      const x = Math.max(1.5, Math.min(W - 1.5, ((d.getMinutes() + d.getSeconds() / 60) / 60) * W));
      ctx.fillStyle = rgba(ink, 1);
      ctx.fillRect(x - 1, r * rh, 2, rh);
      ctx.beginPath();
      ctx.arc(x, r * rh, 3, 0, 6.283);
      ctx.fill();
    }

    if (st.focus) {
      ctx.strokeStyle = rgba(ink, 1);
      ctx.lineWidth = 2;
      ctx.strokeRect((st.cursor % TIME_COLS) * cw + 1, Math.floor(st.cursor / TIME_COLS) * rh + 1, cw - 2, rh - 2);
    }
    if (animating) st.raf = requestAnimationFrame(draw);
  };

  useLayoutEffect(draw);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    const id = window.setInterval(draw, 20000);
    return () => {
      ro.disconnect();
      clearInterval(id);
      cancelAnimationFrame(st.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cellAt = (x: number, y: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const c = Math.max(0, Math.min(TIME_COLS - 1, Math.floor(((x - r.left) / r.width) * TIME_COLS)));
    const row = Math.max(0, Math.min(TIME_ROWS - 1, Math.floor(((y - r.top) / r.height) * TIME_ROWS)));
    return row * TIME_COLS + c;
  };
  const paint = (i: number) => {
    const k = st.stroke;
    if (!k || k.work[i] === k.mode) return;
    k.work[i] = k.mode;
    k.changed = true;
    if (k.mode) st.fresh.set(i, performance.now());
  };

  const d = now();
  const nowRow = props.isToday ? (d.getHours() - FIRST_HOUR + 24) % 24 : -1;

  return (
    <div {...stylex.props(s.root)}>
      <div {...stylex.props(s.hours)} aria-hidden>
        {Array.from({ length: TIME_ROWS }, (_, r) => (
          <span key={r} {...stylex.props(s.hour, r === nowRow && s.hourNow)}>
            {(FIRST_HOUR + r) % 12 || 12}
          </span>
        ))}
      </div>
      <div {...stylex.props(s.area)}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label="타임라인. 형광펜으로 10분 단위 칸을 칠합니다. 방향키로 칸을 옮기고 스페이스로 칠합니다."
        {...stylex.props(s.canvas)}
        onFocus={(e) => {
          st.focus = e.currentTarget.matches(':focus-visible');
          draw();
        }}
        onBlur={() => {
          st.focus = false;
          draw();
        }}
        onKeyDown={(e) => {
          const move: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -TIME_COLS, ArrowDown: TIME_COLS };
          if (e.key in move) {
            st.cursor = Math.max(0, Math.min(TIME_ROWS * TIME_COLS - 1, st.cursor + move[e.key]));
            st.focus = true;
          } else if (e.key === ' ' || e.key === 'Enter') {
            const tool = props.tool === 0 ? props.requestPen() : props.tool;
            const next = [...props.cells];
            next[st.cursor] = tool === -1 || next[st.cursor] === tool ? 0 : tool;
            if (next[st.cursor]) st.fresh.set(st.cursor, performance.now());
            props.onChange(next);
          } else return;
          e.preventDefault();
          draw();
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const tool = props.tool === 0 ? props.requestPen() : props.tool;
          const i = cellAt(e.clientX, e.clientY);
          const work = [...props.cells];
          // 같은 색 위에서 시작하면 지우고, 아니면 칠한다
          const mode = tool === -1 || work[i] === tool ? 0 : tool;
          st.stroke = { id: e.pointerId, mode, x: e.clientX, y: e.clientY, work, changed: false };
          paint(i);
          draw();
        }}
        onPointerMove={(e) => {
          const k = st.stroke;
          if (!k || k.id !== e.pointerId) return;
          const dx = e.clientX - k.x;
          const dy = e.clientY - k.y;
          const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 5));
          for (let q = 1; q <= n; q++) paint(cellAt(k.x + (dx * q) / n, k.y + (dy * q) / n));
          k.x = e.clientX;
          k.y = e.clientY;
          if (!st.raf) st.raf = requestAnimationFrame(draw);
        }}
        onPointerUp={(e) => {
          const k = st.stroke;
          if (!k || k.id !== e.pointerId) return;
          st.stroke = null;
          if (k.changed) props.onChange(k.work);
          else draw();
        }}
        onPointerCancel={() => {
          st.stroke = null;
          draw();
        }}
      />
      </div>
    </div>
  );
}
