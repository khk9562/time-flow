import * as stylex from '@stylexjs/stylex';
import { useRef } from 'react';
import { atmosphere } from '../lib/atmosphere';
import { reducedMotion, rgba, useCanvas } from '../lib/canvas';
import { dayHasContent, penRGB, useDB } from '../lib/store';
import { dayKey, daysInMonth, now, WEEKDAYS } from '../lib/time';

const s = stylex.create({
  wrap: { position: 'relative', width: '100%', aspectRatio: '32 / 14.2', maxHeight: 260 },
  canvas: { position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', touchAction: 'manipulation' },
});

type Props = { year: number; onOpenDay: (month: number, day: number) => void };

/** 한 해를 점으로 펼친 지도: 가로 31일 × 세로 12개월. 지나간 날은 채워지고, 기록한 날은 형광펜 색이 묻는다. */
export function YearMap({ year, onOpenDay }: Props) {
  const db = useDB();
  const dbRef = useRef(db);
  dbRef.current = db;
  const st = useRef({ hover: null as null | { m: number; d: number }, born: performance.now(), geo: { x0: 0, y0: 0, cell: 1 } }).current;

  const { ref } = useCanvas((ctx, W, H, t) => {
    const { ink, dark } = atmosphere;
    const labelW = 22;
    const top = 20;
    const cell = Math.min((W - labelW) / 31, (H - top) / 12);
    const x0 = labelW;
    const y0 = top;
    st.geo = { x0, y0, cell };
    ctx.clearRect(0, 0, W, H);
    const today = now();
    const tKey = dayKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const age = reducedMotion() ? 9 : (performance.now() - st.born) / 1000;

    ctx.font = `600 ${Math.max(9, Math.min(11, cell * 0.7))}px Paperlogy, sans-serif`;
    ctx.textBaseline = 'middle';
    for (let m = 1; m <= 12; m++) {
      const cy = y0 + (m - 0.5) * cell;
      ctx.textAlign = 'left';
      ctx.fillStyle = rgba(ink, today.getFullYear() === year && today.getMonth() + 1 === m ? 1 : 0.6);
      ctx.fillText(String(m), 0, cy);
      const n = daysInMonth(year, m);
      for (let d = 1; d <= n; d++) {
        const cx = x0 + (d - 0.5) * cell;
        // 왼쪽 위에서부터 물결처럼 나타난다
        const k = Math.max(0, Math.min(1, (age - (m * 0.035 + d * 0.012)) / 0.35));
        if (k <= 0) continue;
        const key = dayKey(year, m, d);
        const entry = dbRef.current.days[key];
        const has = dayHasContent(entry);
        const isToday = key === tKey;
        const hovered = st.hover?.m === m && st.hover.d === d;
        let r = cell * (has ? 0.36 : 0.2) * (0.4 + 0.6 * k);
        if (hovered) r = cell * 0.44;
        if (has) {
          const pen = entry.cells.find((c) => c > 0) || entry.tasks.find((x) => x.hl > 0)?.hl || 0;
          ctx.fillStyle = pen ? rgba(penRGB(pen), dark ? 0.9 : 1) : rgba(ink, 1);
        } else {
          ctx.fillStyle = rgba(ink, (key < tKey ? 0.5 : 0.17) * k);
        }
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.283);
        ctx.fill();
        if (has && !dark) {
          ctx.strokeStyle = rgba(ink, 0.35);
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (isToday) {
          const pulse = reducedMotion() ? 0.5 : (t * 0.8) % 1;
          ctx.strokeStyle = rgba(ink, 1);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, cell * 0.46, 0, 6.283);
          ctx.stroke();
          ctx.strokeStyle = rgba(ink, 0.5 * (1 - pulse));
          ctx.beginPath();
          ctx.arc(cx, cy, cell * (0.46 + pulse * 0.5), 0, 6.283);
          ctx.stroke();
        } else if (hovered) {
          ctx.strokeStyle = rgba(ink, 0.9);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, cell * 0.5, 0, 6.283);
          ctx.stroke();
        }
      }
    }

    const h = st.hover;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = '600 12px Paperlogy, sans-serif';
    ctx.fillStyle = rgba(ink, h ? 1 : 0.66);
    const label = h
      ? `${h.m}월 ${h.d}일 ${WEEKDAYS[new Date(year, h.m - 1, h.d).getDay()]}${dayHasContent(dbRef.current.days[dayKey(year, h.m, h.d)]) ? ' · 기록 있음' : ''}`
      : '날짜를 누르면 그날의 플래너가 열립니다';
    ctx.fillText(label, Math.min(W, x0 + 31 * cell), 0);
  });

  const hit = (e: React.PointerEvent | React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const { x0, y0, cell } = st.geo;
    const d = Math.floor((e.clientX - r.left - x0) / cell) + 1;
    const m = Math.floor((e.clientY - r.top - y0) / cell) + 1;
    if (m < 1 || m > 12 || d < 1 || d > daysInMonth(year, m)) return null;
    return { m, d };
  };

  return (
    <div {...stylex.props(s.wrap)}>
      <canvas
        ref={ref}
        aria-hidden
        {...stylex.props(s.canvas)}
        onPointerMove={(e) => {
          st.hover = hit(e);
        }}
        onPointerLeave={() => {
          st.hover = null;
        }}
        onClick={(e) => {
          const h = hit(e);
          if (h) onOpenDay(h.m, h.d);
        }}
      />
    </div>
  );
}
