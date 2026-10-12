import * as stylex from '@stylexjs/stylex';
import { useRef } from 'react';
import { atmosphere } from '../lib/atmosphere';
import { reducedMotion, rgba, roundRectPath, useCanvas } from '../lib/canvas';
import { now } from '../lib/time';

const s = stylex.create({
  canvas: { display: 'block', width: '100%', height: '100%' },
});

type Props = {
  /** 0..1 을 돌려주는 함수. 매 프레임 호출된다. */
  progress: () => number;
  /** 연간 게이지: 아래에 12개월 눈금을 그린다 */
  months?: { year: number };
};

/**
 * 시간이 흐르고 있음을 보여주는 게이지. 채워진 부분 안에서 농담이 오른쪽으로 흐르고,
 * 지금을 가리키는 실선 앞까지 빈틈없이 채운다. (원래 디자인에서 물결 줄·입자를 뺀 것. ?bar=clean, 기본)
 */
export function FlowBarClean({ progress, months }: Props) {
  const head = useRef({ pulse: 0, lastSec: -1 }).current;
  const { ref } = useCanvas((ctx, W, H, t, dt) => {
    const still = reducedMotion();
    if (still) t = 0;
    const { ink } = atmosphere;
    const p = Math.max(0, Math.min(1, progress()));
    const fs = Math.max(9, Math.min(13, W * 0.016));
    // 연간 게이지는 아래쪽에 월 눈금과 숫자가 들어갈 자리를 남긴다
    const barH = months ? Math.min(H - fs - 14, 46) : H;
    const r = barH / 2;
    // 채움은 실선까지 반듯하게 잘린다 (오른쪽 끝을 둥글리지 않는다)
    const fillW = Math.min(W - 1, Math.max(barH, W * p));
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
      roundRectPath(ctx, 0, 0, W, barH, r);
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

      ctx.restore();

      // 지금 이 순간: 초마다 한 번 번지는 머리
      const sec = now().getSeconds();
      if (sec !== head.lastSec) {
        head.lastSec = sec;
        head.pulse = still ? 0 : 1;
      }
      head.pulse = Math.max(0, head.pulse - dt * 1.25);
      const pulse = head.pulse;
      const hx = fillW;
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
