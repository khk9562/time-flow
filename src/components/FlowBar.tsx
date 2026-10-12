import * as stylex from '@stylexjs/stylex';
import { useRef } from 'react';
import { atmosphere } from '../lib/atmosphere';
import { reducedMotion, rgba, roundRectPath, seeded, useCanvas } from '../lib/canvas';
import { now } from '../lib/time';

// 빛이 게이지 밖으로 번질 자리. 캔버스를 이만큼 바깥으로 키운다.
const GX = 14;
const GY = 22;

const s = stylex.create({
  wrap: { position: 'relative', width: '100%', height: '100%' },
  // 번진 빛이 주변 글자를 덮지 않도록 뒤로 보낸다
  canvas: {
    position: 'absolute',
    top: -GY,
    left: -GX,
    width: `calc(100% + ${GX * 2}px)`,
    height: `calc(100% + ${GY * 2}px)`,
    zIndex: -1,
    pointerEvents: 'none',
  },
});

// 수면에서 피어올라 흩날리는 빛 안개
const rnd = seeded(41);
const WISPS = Array.from({ length: 9 }, () => ({
  x: rnd(),
  life: 3.5 + rnd() * 3,
  phase: rnd(),
  drift: 0.015 + rnd() * 0.03,
  w: 0.6 + rnd() * 0.8,
  a: 0.5 + rnd() * 0.5,
}));

type Props = {
  /** 0..1 을 돌려주는 함수. 매 프레임 호출된다. */
  progress: () => number;
  /** 연간 게이지: 아래에 12개월 숫자를 그린다 */
  months?: { year: number };
};

/**
 * 시간이 흐르고 있음을 보여주는 게이지. 무채색 빛이 오로라처럼 일렁이며 흩날리고,
 * 채워진 부분은 물처럼 출렁이며 차오른다. (예전 디자인: FlowBarClassic)
 */
export function FlowBar({ progress, months }: Props) {
  const head = useRef({ pulse: 0, lastSec: -1 }).current;
  const curtain = useRef<HTMLCanvasElement | null>(null);
  const { ref } = useCanvas((ctx, W, H, t, dt) => {
    const still = reducedMotion();
    if (still) t = 0;
    const { ink, paper, dark } = atmosphere;
    const p = Math.max(0, Math.min(1, progress()));

    const x0 = GX;
    const y0 = GY;
    const bw = W - GX * 2;
    const bh = H - GY * 2;
    const fs = Math.max(9, Math.min(13, bw * 0.016));
    // 연간 게이지는 아래쪽에 월 숫자가 들어갈 자리를 남긴다
    const barH = months ? Math.min(bh - fs - 10, 46) : bh;
    const r = barH / 2;
    ctx.clearRect(0, 0, W, H);

    // 트랙
    roundRectPath(ctx, x0 + 0.5, y0 + 0.5, bw - 1, barH - 1, r);
    ctx.fillStyle = rgba(ink, 0.07);
    ctx.fill();
    ctx.strokeStyle = rgba(ink, 0.2);
    ctx.lineWidth = 1;
    ctx.stroke();

    if (p > 0) {
      const fx = x0 + Math.max(barH, bw * p);
      const span = fx - x0;
      // 윗면: 물결이 오른쪽으로 밀려가며 출렁인다
      const swell = barH * 0.11;
      const top = (x: number) =>
        y0 + swell * (1 + 0.6 * Math.sin(x * 0.03 - t * 1.7) + 0.4 * Math.sin(x * 0.075 + t * 2.4 + 1));
      // 앞머리: 위아래로 일렁이고, 천천히 밀려왔다 물러나며 차오른다
      const amp = Math.max(2.5, Math.min(9, barH * 0.32));
      const surge = amp * 0.45 * Math.sin(t * 1.1) + amp * 0.2 * Math.sin(t * 2.7 + 0.8);
      const edge = (v: number) =>
        fx - amp * 0.6 + surge + amp * (0.75 * Math.sin(v * 4.6 + t * 2.3) + 0.25 * Math.sin(v * 9.5 - t * 3.1 + 1.1));
      const STEPS = 28;
      const front: [number, number][] = [];
      const fy0 = top(edge(0));
      for (let i = 0; i <= STEPS; i++) {
        const v = i / STEPS;
        front.push([edge(v), fy0 + v * (y0 + barH - fy0)]);
      }
      const fillPath = () => {
        ctx.beginPath();
        ctx.moveTo(x0, top(x0));
        for (let x = x0 + 6; x < front[0][0]; x += 6) ctx.lineTo(x, top(x));
        for (const [x, y] of front) ctx.lineTo(x, y);
        ctx.lineTo(x0, y0 + barH);
        ctx.closePath();
      };

      // 바깥으로 번지는 빛: 옅은 빛 덩어리들이 숨 쉬듯 떠돈다
      const BLOBS = 5;
      for (let i = 0; i < BLOBS; i++) {
        const u = Math.max(0, Math.min(1, (i + 0.5) / BLOBS + 0.07 * Math.sin(t * 0.45 + i * 1.7)));
        const cx = x0 + span * u;
        const cy = y0 + barH / 2 - barH * 0.2 + barH * 0.15 * Math.sin(t * 0.8 + i * 2.1);
        const rx = Math.max(span / BLOBS, barH * 2.2);
        const ry = barH / 2 + GY * 0.95;
        const breath = 0.7 + 0.3 * Math.sin(t * 1.3 + i * 1.3);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(rx / ry, 1);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
        g.addColorStop(0, rgba(ink, (dark ? 0.3 : 0.1) * breath));
        g.addColorStop(0.5, rgba(ink, (dark ? 0.1 : 0.035) * breath));
        g.addColorStop(1, rgba(ink, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-ry, -ry, ry * 2, ry * 2);
        ctx.restore();
      }

      // 오로라 커튼: 수면 위로 세로 빛줄기가 늘어져 일렁인다
      const ch = GY + barH * 0.4;
      const cv = curtain.current ?? (curtain.current = document.createElement('canvas'));
      if (cv.width !== Math.ceil(W) || cv.height !== Math.ceil(ch)) {
        cv.width = Math.ceil(W);
        cv.height = Math.ceil(ch);
      }
      const cc = cv.getContext('2d');
      if (cc) {
        cc.globalCompositeOperation = 'source-over';
        cc.clearRect(0, 0, cv.width, cv.height);
        const cg = cc.createLinearGradient(x0, 0, fx, 0);
        const CN = 40;
        for (let i = 0; i <= CN; i++) {
          const u = i / CN;
          const x = span * u * 0.04;
          const w = 0.55 * Math.sin(x * 1.3 - t * 0.6) + 0.3 * Math.sin(x * 3.7 + t * 1.1 + 1.7) + 0.15 * Math.sin(x * 8.2 - t * 1.9);
          const ends = Math.min(1, u * 8, (1 - u) * 5);
          cg.addColorStop(u, rgba(ink, Math.pow(Math.max(0, w), 1.4) * (dark ? 0.5 : 0.16) * ends));
        }
        cc.fillStyle = cg;
        cc.fillRect(x0, 0, span, ch);
        cc.globalCompositeOperation = 'destination-in';
        const fadeUp = cc.createLinearGradient(0, 0, 0, ch);
        fadeUp.addColorStop(0, 'rgba(0,0,0,0)');
        fadeUp.addColorStop(0.75, 'rgba(0,0,0,0.85)');
        fadeUp.addColorStop(1, 'rgba(0,0,0,1)');
        cc.fillStyle = fadeUp;
        cc.fillRect(0, 0, cv.width, ch);
        ctx.drawImage(cv, 0, y0 + barH * 0.4 - ch, W, ch);
      }

      // 흩날림: 수면에서 빛 안개가 피어올라 비스듬히 흩어진다
      for (const w of WISPS) {
        const k = (t / w.life + w.phase) % 1;
        const fade = Math.sin(k * Math.PI);
        const wx = x0 + span * ((w.x + t * w.drift) % 1) + k * barH * 1.5;
        if (wx > fx) continue;
        const wy = top(wx) - k * (GY + barH * 0.3);
        const ry = Math.max(3, barH * 0.35) * (0.7 + k * 0.8);
        const rx = ry * (2.4 + 2 * w.w);
        const edgeFade = Math.min(1, (wx - x0) / 20, (fx - wx) / 30);
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(-0.18);
        ctx.scale(rx / ry, 1);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
        g.addColorStop(0, rgba(ink, (dark ? 0.34 : 0.1) * w.a * fade * edgeFade));
        g.addColorStop(1, rgba(ink, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-ry, -ry, ry * 2, ry * 2);
        ctx.restore();
      }

      // 채워진 물: 농담이 겹친 사인파로 오른쪽으로 밀려간다
      ctx.save();
      roundRectPath(ctx, x0, y0, bw, barH, r);
      ctx.clip();
      fillPath();
      ctx.shadowColor = rgba(ink, dark ? 0.85 : 0.3);
      ctx.shadowBlur = GY;
      const base = ctx.createLinearGradient(x0, 0, fx, 0);
      const N = 22;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const x = u * (span / 180);
        const wave =
          0.5 + 0.28 * Math.sin(x * 2.1 - t * 1.15) + 0.16 * Math.sin(x * 5.3 - t * 2.1 + 1.3) + 0.08 * Math.sin(x * 11 - t * 3.4);
        base.addColorStop(u, rgba(ink, (dark ? 0.55 : 0.4) + (dark ? 0.45 : 0.6) * Math.max(0, Math.min(1, wave)) * (0.55 + 0.45 * u)));
      }
      ctx.fillStyle = base;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.clip();

      // 오로라 커튼: 밝고 어두운 세로 빛줄기가 반짝이며 옆으로 흐른다
      const rays = ctx.createLinearGradient(x0, 0, fx, 0);
      const RAYS = 48;
      for (let i = 0; i <= RAYS; i++) {
        const u = i / RAYS;
        const x = span * u * 0.05;
        const w = 0.5 * Math.sin(x * 1.7 - t * 0.9) + 0.3 * Math.sin(x * 4.3 + t * 1.6 + 2) + 0.2 * Math.sin(x * 9.1 - t * 2.8);
        rays.addColorStop(u, w > 0 ? rgba(ink, w * 0.5) : rgba(paper, -w * (dark ? 0.16 : 0.24)));
      }
      ctx.fillStyle = rays;
      ctx.fillRect(x0, y0, span + amp * 2, barH);

      // 수면의 윤기와 바닥의 깊이
      const gloss = ctx.createLinearGradient(0, y0, 0, y0 + barH);
      gloss.addColorStop(0, rgba(paper, 0));
      gloss.addColorStop(0.18, rgba(dark ? [255, 255, 255] : paper, dark ? 0.22 : 0.18));
      gloss.addColorStop(0.5, rgba(paper, 0));
      gloss.addColorStop(1, rgba(paper, dark ? 0.1 : 0.18));
      ctx.fillStyle = gloss;
      ctx.fillRect(x0, y0, span + amp * 2, barH);
      ctx.restore();

      // 지금 이 순간: 초마다 한 번, 차오르는 앞머리가 환하게 번진다
      const sec = now().getSeconds();
      if (sec !== head.lastSec) {
        head.lastSec = sec;
        head.pulse = still ? 0 : 1;
      }
      head.pulse = Math.max(0, head.pulse - dt * 1.25);
      const pulse = head.pulse;
      const hx = edge(0.5);
      const hy = y0 + barH / 2;
      const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, barH * 0.6 + GY * (0.7 + (1 - pulse) * 0.5));
      halo.addColorStop(0, rgba(ink, (dark ? 0.2 : 0.1) + (dark ? 0.3 : 0.15) * pulse));
      halo.addColorStop(1, rgba(ink, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(hx - GY * 2 - barH, 0, GY * 4 + barH * 2, H);

      ctx.save();
      roundRectPath(ctx, x0 - 2, y0 - 2, bw + 4, barH + 4, r + 2);
      ctx.clip();
      ctx.beginPath();
      front.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = rgba(ink, 0.9);
      ctx.shadowBlur = 8 + 10 * pulse;
      ctx.strokeStyle = rgba(ink, 0.85 + 0.15 * pulse);
      ctx.lineWidth = Math.max(1.5, Math.min(3, barH * 0.08)) + pulse;
      ctx.stroke();
      ctx.restore();
    }

    if (months) {
      // 월 숫자: 실제 일수 비율대로 나눈 칸의 가운데
      const y = months.year;
      const start = new Date(y, 0, 1).getTime();
      const total = new Date(y + 1, 0, 1).getTime() - start;
      const cur = now();
      ctx.font = `600 ${fs}px Paperlogy, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const ty = y0 + barH + 8;
      for (let m = 0; m < 12; m++) {
        const a = x0 + ((new Date(y, m, 1).getTime() - start) / total) * bw;
        const b = x0 + ((new Date(y, m + 1, 1).getTime() - start) / total) * bw;
        const isCur = cur.getFullYear() === y && cur.getMonth() === m;
        const past = cur.getTime() >= new Date(y, m + 1, 1).getTime();
        ctx.fillStyle = rgba(ink, isCur ? 1 : past ? 0.62 : 0.34);
        ctx.fillText(String(m + 1), (a + b) / 2, ty);
      }
    }
  });

  return (
    <div {...stylex.props(s.wrap)}>
      <canvas ref={ref} aria-hidden {...stylex.props(s.canvas)} />
    </div>
  );
}
