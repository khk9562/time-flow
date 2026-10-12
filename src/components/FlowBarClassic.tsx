import * as stylex from '@stylexjs/stylex';
import { useRef } from 'react';
import { atmosphere } from '../lib/atmosphere';
import { reducedMotion, rgba, roundRectPath, seeded, useCanvas } from '../lib/canvas';
import { now } from '../lib/time';

const s = stylex.create({
  canvas: { display: 'block', width: '100%', height: '100%' },
});

const rnd = seeded(77);
const SPECKS = Array.from({ length: 34 }, () => ({
  x: rnd(),
  y: 0.14 + rnd() * 0.72,
  v: 0.02 + rnd() * 0.06,
  r: 0.5 + rnd() * 1.3,
  a: 0.25 + rnd() * 0.5,
}));

type Props = {
  /** 0..1 을 돌려주는 함수. 매 프레임 호출된다. */
  progress: () => number;
  /** 연간 게이지: 아래에 12개월 눈금을 그린다 */
  months?: { year: number };
};

/** (백업) 2026-10 까지 쓰던 무채색 게이지. 되돌리려면 쓰는 곳의 import 를 FlowBarClassic 으로 바꾼다.
 *  채워진 부분 안에서 농담이 오른쪽으로 흐르고, 물결 줄·입자·초마다 번지는 머리 선이 있다. */
export function FlowBarClassic({ progress, months }: Props) {
  const head = useRef({ pulse: 0, lastSec: -1 }).current;
  const { ref } = useCanvas((ctx, W, H, t, dt) => {
    const still = reducedMotion();
    if (still) t = 0;
    const { ink, paper } = atmosphere;
    const p = Math.max(0, Math.min(1, progress()));
    const fs = Math.max(9, Math.min(13, W * 0.016));
    // 연간 게이지는 아래쪽에 월 눈금과 숫자가 들어갈 자리를 남긴다
    const barH = months ? Math.min(H - fs - 14, 46) : H;
    const r = barH / 2;
    const fillW = Math.max(barH, W * p);
    ctx.clearRect(0, 0, W, H);

    // 트랙
    roundRectPath(ctx, 0.5, 0.5, W - 1, barH - 1, r);
    ctx.fillStyle = rgba(ink, 0.07);
    ctx.fill();
    ctx.strokeStyle = rgba(ink, 0.22);
    ctx.lineWidth = 1;
    ctx.stroke();

    if (p > 0) {
      ctx.save();
      roundRectPath(ctx, 0, 0, fillW, barH, r);
      ctx.clip();

      // 흐르는 그라데이션: 겹친 사인파로 농도가 오른쪽으로 밀려간다
      const g = ctx.createLinearGradient(0, 0, fillW, 0);
      const N = 22;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const x = u * (fillW / 180);
        const wave =
          0.5 + 0.28 * Math.sin(x * 2.1 - t * 1.15) + 0.16 * Math.sin(x * 5.3 - t * 2.1 + 1.3) + 0.08 * Math.sin(x * 11 - t * 3.4);
        g.addColorStop(u, rgba(ink, 0.34 + 0.66 * Math.max(0, Math.min(1, wave)) * (0.55 + 0.45 * u)));
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, fillW, barH);

      // 물결 결: 위아래로 일렁이는 밝은 줄
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        for (let x = 0; x <= fillW; x += 6) {
          const y = barH * (0.3 + k * 0.2) + Math.sin(x * 0.018 - t * (1.4 + k * 0.5) + k * 2) * barH * 0.13;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = rgba(paper, 0.2 - k * 0.04);
        ctx.stroke();
      }

      // 머리 쪽으로 떠내려가는 입자
      for (const sp of SPECKS) {
        const x = ((sp.x + t * sp.v) % 1) * fillW;
        const fade = Math.min(1, x / 30, (fillW - x) / 30);
        ctx.fillStyle = rgba(paper, sp.a * fade);
        ctx.beginPath();
        ctx.arc(x, sp.y * barH, sp.r, 0, 6.283);
        ctx.fill();
      }
      ctx.restore();

      // 지금 이 순간: 초마다 한 번 번지는 머리
      const sec = now().getSeconds();
      if (sec !== head.lastSec) {
        head.lastSec = sec;
        head.pulse = still ? 0 : 1;
      }
      head.pulse = Math.max(0, head.pulse - dt * 1.25);
      const pulse = head.pulse;
      const hx = Math.min(W - 1, fillW);
      const halo = ctx.createRadialGradient(hx, r, 0, hx, r, barH * (1.1 + (1 - pulse) * 1.6));
      halo.addColorStop(0, rgba(ink, 0.28 * pulse + 0.08));
      halo.addColorStop(1, rgba(ink, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(hx - barH * 3, -barH, barH * 6, barH * 3);
      ctx.fillStyle = rgba(ink, 1);
      ctx.fillRect(hx - 1, -3, 2, barH + 6);
    }

    if (months) {
      // 월 눈금: 실제 일수 비율대로 나눈다
      const y = months.year;
      const start = new Date(y, 0, 1).getTime();
      const total = new Date(y + 1, 0, 1).getTime() - start;
      const cur = now();
      ctx.font = `600 ${fs}px Paperlogy, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const ty = barH + 5;
      for (let m = 0; m < 12; m++) {
        const a = ((new Date(y, m, 1).getTime() - start) / total) * W;
        const b = ((new Date(y, m + 1, 1).getTime() - start) / total) * W;
        const isCur = cur.getFullYear() === y && cur.getMonth() === m;
        const past = cur.getTime() >= new Date(y, m + 1, 1).getTime();
        ctx.fillStyle = rgba(ink, 0.3);
        if (m > 0) ctx.fillRect(Math.round(a), ty, 1, 5);
        ctx.fillStyle = rgba(ink, isCur ? 1 : past ? 0.62 : 0.34);
        ctx.fillText(String(m + 1), (a + b) / 2, ty + 7);
      }
    }
  });

  return <canvas ref={ref} aria-hidden {...stylex.props(s.canvas)} />;
}
