import * as stylex from '@stylexjs/stylex';
import { useRef } from 'react';
import { atmosphere, type RGB } from '../lib/atmosphere';
import { reducedMotion, rgba, useCanvas } from '../lib/canvas';
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

const WHITE: RGB = [255, 255, 255];

// 느린 사인파 묶음: [진폭, 주파수, 속도(rad/s), 위상]. 속도가 작을수록 천천히 흐른다.
type Wave = [number, number, number, number][];
const wave = (w: Wave, X: number, t: number) => w.reduce((v, [a, f, sp, ph]) => v + a * Math.sin(f * X + sp * t + ph), 0);
// 겹마다 다른 물결: 바깥 겹은 크고 옅게, 안쪽 겹은 작고 진하게.
const LAYERS: { wave: Wave; scale: number; alpha: number }[] = [
  { wave: [[0.55, 1.2, 0.34, 0], [0.3, 2.6, 0.22, 1.3], [0.15, 4.4, 0.47, 2.6]], scale: 1, alpha: 0.16 },
  { wave: [[0.5, 1.7, 0.27, 2.2], [0.35, 3.1, 0.41, 0.5], [0.15, 5.6, 0.31, 1.8]], scale: 0.72, alpha: 0.2 },
  { wave: [[0.6, 2.3, 0.39, 3.4], [0.25, 4.1, 0.29, 0.9], [0.15, 6.8, 0.53, 4.2]], scale: 0.42, alpha: 0.3 },
];

type Props = {
  /** 0..1 을 돌려주는 함수. 매 프레임 호출된다. */
  progress: () => number;
  /** 연간 게이지: 아래에 12개월 숫자를 그린다 */
  months?: { year: number };
};

/**
 * 빛줄기 게이지. 가운데 실선을 중심으로 반투명한 빛의 면이 굵어졌다 가늘어지며 천천히 머리 쪽으로
 * 흘러가고, 지금을 가리키는 머리의 한 점으로 모인다. 머리에는 가만히 선 빛의 심이 있다. (?bar=beam)
 */
export function FlowBarBeam({ progress, months }: Props) {
  const head = useRef({ pulse: 0, lastSec: -1 }).current;
  const { ref } = useCanvas((ctx, W, H, t, dt) => {
    const still = reducedMotion();
    if (still) t = 0;
    const { ink, dark } = atmosphere;
    // 밤에는 흰 빛, 낮에는 먹빛
    const core = dark ? WHITE : ink;
    const p = Math.max(0, Math.min(1, progress()));

    const x0 = GX;
    const bw = W - GX * 2;
    const bh = H - GY * 2;
    const fs = Math.max(9, Math.min(13, bw * 0.016));
    // 연간 게이지는 아래쪽에 월 숫자가 들어갈 자리를 남긴다
    const barH = months ? Math.min(bh - fs - 10, 46) : bh;
    const cy = GY + barH / 2;
    // 머리에서의 빛줄기 굵기
    const maxT = Math.min(barH, Math.max(9, bw * 0.026));
    ctx.clearRect(0, 0, W, H);

    // 바탕의 가는 선
    ctx.fillStyle = rgba(ink, 0.2);
    ctx.fillRect(x0, cy - 0.5, bw, 1);

    if (p > 0) {
      const fx = x0 + Math.max(maxT, bw * p);
      const span = fx - x0;
      // 빛의 면: 가운데 실선을 중심으로 위아래가 똑같이 부푼 반투명한 면 몇 겹.
      // 두께가 굵어졌다 가늘어지는 마디가 천천히 머리 쪽으로 흘러가고, 폭은 머리에서 0 이 되어 한 점으로 모인다.
      const amp = barH / 2 + GY * 0.6;
      const env = (u: number) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.9);
      const STEP = 3;
      const n = Math.max(2, Math.ceil(span / STEP) + 1);
      const xs = new Float32Array(n);
      const es = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        const x = Math.min(fx, x0 + k * STEP);
        xs[k] = x;
        es[k] = env((x - x0) / span) * amp;
      }
      ctx.save();
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      const hs = new Float32Array(n);
      for (const ly of LAYERS) {
        for (let k = 0; k < n; k++) {
          const X = ((xs[k] - x0) / span) * 6;
          // 0..1 로 접어 두께로 쓴다 (마디가 오른쪽으로 흐르도록 위상에서 시간을 뺀다)
          const w = 0.5 + 0.5 * wave(ly.wave, X, -t);
          hs[k] = es[k] * ly.scale * (0.18 + 0.82 * w);
        }
        ctx.beginPath();
        ctx.moveTo(xs[0], cy);
        for (let k = 0; k < n; k++) ctx.lineTo(xs[k], cy - hs[k]);
        for (let k = n - 1; k >= 0; k--) ctx.lineTo(xs[k], cy + hs[k]);
        ctx.closePath();
        const g = ctx.createLinearGradient(x0, 0, fx, 0);
        g.addColorStop(0, rgba(core, 0));
        g.addColorStop(0.25, rgba(core, ly.alpha * 0.6));
        g.addColorStop(1, rgba(core, ly.alpha));
        ctx.fillStyle = g;
        ctx.fill();
      }
      // 모이는 쪽으로 갈수록 환해지는 가는 심
      const spine = ctx.createLinearGradient(x0, 0, fx, 0);
      spine.addColorStop(0, rgba(core, 0));
      spine.addColorStop(0.7, rgba(core, dark ? 0.25 : 0.3));
      spine.addColorStop(1, rgba(core, dark ? 0.9 : 0.8));
      ctx.fillStyle = spine;
      ctx.fillRect(x0, cy - 0.75, span, 1.5);
      ctx.restore();

      // 지금 이 순간: 머리의 빛은 가만히 서 있고, 초마다 한 번 둘레가 환하게 번진다
      const sec = now().getSeconds();
      if (sec !== head.lastSec) {
        head.lastSec = sec;
        head.pulse = still ? 0 : 1;
      }
      head.pulse = Math.max(0, head.pulse - dt * 1.25);
      const pulse = head.pulse;
      const hx = Math.min(x0 + bw, fx);

      ctx.save();
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      const halo = ctx.createRadialGradient(hx, cy, 0, hx, cy, maxT * 1.2 + GY * (0.8 + (1 - pulse) * 0.4));
      halo.addColorStop(0, rgba(ink, (dark ? 0.32 : 0.14) + (dark ? 0.3 : 0.12) * pulse));
      halo.addColorStop(1, rgba(ink, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(hx - GY * 3, 0, GY * 6, H);

      // 머리의 심: 세로로 선 빛 한 줄기와 둥근 빛망울
      const flare = ctx.createLinearGradient(0, cy - maxT * 1.3, 0, cy + maxT * 1.3);
      flare.addColorStop(0, rgba(core, 0));
      flare.addColorStop(0.5, rgba(core, 0.95));
      flare.addColorStop(1, rgba(core, 0));
      ctx.fillStyle = flare;
      ctx.fillRect(hx - 1, cy - maxT * 1.3, 2, maxT * 2.6);
      const bead = ctx.createRadialGradient(hx, cy, 0, hx, cy, maxT * 0.7);
      bead.addColorStop(0, rgba(core, 1));
      bead.addColorStop(0.35, rgba(core, 0.6));
      bead.addColorStop(1, rgba(core, 0));
      ctx.fillStyle = bead;
      ctx.fillRect(hx - maxT, cy - maxT, maxT * 2, maxT * 2);
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
      const ty = GY + barH + 8;
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
