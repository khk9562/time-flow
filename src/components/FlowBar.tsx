import * as stylex from '@stylexjs/stylex';
import { useRef } from 'react';
import { atmosphere, type RGB } from '../lib/atmosphere';
import { reducedMotion, rgba, useCanvas } from '../lib/canvas';
import { now } from '../lib/time';

// 빛이 게이지 밖으로 번질 자리. 캔버스를 이만큼 바깥으로 키운다.
const GX = 14;
const GY = 48;
// 실 다발이 퍼지고 머리의 빛이 번지는 크기의 기준 (캔버스 여백과 따로 둔다)
const SPREAD = 22;

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

// 느린 사인파 묶음: [진폭, 주파수, 속도(rad/s), 위상]. 속도가 작을수록 천천히 흔들린다.
type Wave = [number, number, number, number][];
const wave = (w: Wave, X: number, t: number) => w.reduce((v, [a, f, sp, ph]) => v + a * Math.sin(f * X + sp * t + ph), 0);
const RIBBONS: { a: Wave; b: Wave; alpha: number }[] = [
  {
    a: [[0.55, 1.1, 0.31, 0], [0.3, 2.7, -0.23, 1.2], [0.15, 4.9, 0.41, 2.5]],
    b: [[0.5, 1.6, -0.27, 2.1], [0.35, 3.3, 0.19, 0.4], [0.15, 6.1, -0.37, 1.7]],
    alpha: 0.13,
  },
  {
    a: [[0.45, 0.8, -0.21, 3.3], [0.35, 2.2, 0.29, 0.9], [0.2, 5.3, -0.17, 4.1]],
    b: [[0.6, 1.9, 0.17, 1.4], [0.25, 3.9, -0.33, 2.8], [0.15, 7.2, 0.25, 0.3]],
    alpha: 0.09,
  },
];
const STRANDS = 26;

type Props = {
  /** 0..1 을 돌려주는 함수. 매 프레임 호출된다. */
  progress: () => number;
  /** 연간 게이지: 아래에 12개월 숫자를 그린다 */
  months?: { year: number };
};

/**
 * 빛줄기 게이지. 가는 실 여러 가닥이 리본처럼 겹쳐 천천히 제각각 일렁인다. 양 끝은 1월 앞과
 * 지금 위치의 세로 실선 위에 고르게 펼쳐진 채 고정돼, 두 실선 사이를 잇는다. (예전 디자인: FlowBarClassic)
 */
export function FlowBar({ progress, months }: Props) {
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
      // 실 다발: 두 물결 곡선 사이를 가는 실 여러 가닥으로 이어 리본을 만든다.
      // 곡선마다 느린 사인파를 겹쳐 천천히 제각각 흔들린다. 양 끝에서는 흔들림이 잦아들어,
      // 실들이 세로 실선 위에 고르게 펼쳐진 채 고정된다 (1월 앞과 지금 위치, 두 실선에서 시작해 이어진다).
      const amp = barH / 2 + SPREAD * 0.6;
      const endH = maxT * 0.9;
      const env = (u: number) => Math.pow(Math.sin(Math.PI * u), 0.8);
      const STEP = 4;
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
      ctx.lineWidth = 0.7;
      for (const rb of RIBBONS) {
        const a = new Float32Array(n);
        const b = new Float32Array(n);
        for (let k = 0; k < n; k++) {
          const X = ((xs[k] - x0) / span) * 6;
          a[k] = wave(rb.a, X, t);
          b[k] = wave(rb.b, X, t);
        }
        for (let i = 0; i < STRANDS; i++) {
          const s = i / (STRANDS - 1);
          ctx.strokeStyle = rgba(core, rb.alpha * (dark ? 1 : 1.4) * (0.35 + 0.65 * Math.sin(Math.PI * s)));
          ctx.beginPath();
          for (let k = 0; k < n; k++) {
            const m = es[k] / amp;
            const y = cy + (1 - m) * (s * 2 - 1) * endH + es[k] * (a[k] + (b[k] - a[k]) * s);
            if (k === 0) ctx.moveTo(xs[k], y);
            else ctx.lineTo(xs[k], y);
          }
          ctx.stroke();
        }
      }
      // 머리 쪽으로 갈수록 환해지는 가는 심
      const spine = ctx.createLinearGradient(x0, 0, fx, 0);
      spine.addColorStop(0, rgba(core, dark ? 0.12 : 0.15));
      spine.addColorStop(0.7, rgba(core, dark ? 0.25 : 0.3));
      spine.addColorStop(1, rgba(core, dark ? 0.9 : 0.8));
      ctx.fillStyle = spine;
      ctx.fillRect(x0, cy - 0.75, span, 1.5);
      // 시작 실선: 머리의 실선과 짝을 이루는, 실들이 붙어 있는 세로선
      const start = ctx.createLinearGradient(0, cy - maxT * 1.3, 0, cy + maxT * 1.3);
      start.addColorStop(0, rgba(core, 0));
      start.addColorStop(0.5, rgba(core, dark ? 0.7 : 0.75));
      start.addColorStop(1, rgba(core, 0));
      ctx.fillStyle = start;
      ctx.fillRect(x0 - 0.75, cy - maxT * 1.3, 1.5, maxT * 2.6);
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
      const halo = ctx.createRadialGradient(hx, cy, 0, hx, cy, maxT * 1.2 + SPREAD * (0.8 + (1 - pulse) * 0.4));
      halo.addColorStop(0, rgba(ink, (dark ? 0.32 : 0.14) + (dark ? 0.3 : 0.12) * pulse));
      halo.addColorStop(1, rgba(ink, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(hx - SPREAD * 3, 0, SPREAD * 6, H);

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
