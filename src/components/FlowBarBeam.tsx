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

type Props = {
  /** 0..1 을 돌려주는 함수. 매 프레임 호출된다. */
  progress: () => number;
  /** 연간 게이지: 아래에 12개월 숫자를 그린다 */
  months?: { year: number };
};

/**
 * 빛줄기 게이지. 가는 선 위로 빛이 왼쪽에서 가늘게 시작해 지금 쪽으로 갈수록 굵고 밝아지고,
 * 빛의 결이 머리를 향해 흘러든다. 머리에는 가만히 선 빛의 심이 있다. (?bar=beam 으로 볼 수 있다)
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
      // 굵기: 왼쪽 끝은 실처럼 가늘고, 머리에 가까울수록 빠르게 굵어진다. 결이 지나갈 때 살짝 부푼다
      const thick = (x: number) => {
        const u = (x - x0) / span;
        const shimmer = 1 + 0.07 * Math.sin(x * 0.09 - t * 5.2) + 0.04 * Math.sin(x * 0.23 - t * 8.3);
        return maxT * (0.1 + 0.9 * Math.pow(u, 2.4)) * shimmer;
      };
      const beam = (scale: number) => {
        ctx.beginPath();
        ctx.moveTo(x0, cy);
        for (let x = x0; x <= fx; x += 3) ctx.lineTo(x, cy - (thick(x) * scale) / 2);
        ctx.lineTo(fx, cy - (thick(fx) * scale) / 2);
        ctx.lineTo(fx, cy + (thick(fx) * scale) / 2);
        for (let x = fx; x >= x0; x -= 3) ctx.lineTo(x, cy + (thick(x) * scale) / 2);
        ctx.closePath();
      };
      const ramp = (a0: number, a1: number, c: RGB) => {
        const g = ctx.createLinearGradient(x0, 0, fx, 0);
        g.addColorStop(0, rgba(c, a0));
        g.addColorStop(0.6, rgba(c, a0 + (a1 - a0) * 0.35));
        g.addColorStop(1, rgba(c, a1));
        return g;
      };

      ctx.save();
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';

      // 바깥 빛: 빛줄기는 화면 밖에 그리고 번짐(그림자)만 제자리로 옮겨, 경계 없이 둘레가 환하다
      ctx.save();
      ctx.translate(-10000, 0);
      beam(1.8);
      ctx.shadowOffsetX = 10000;
      ctx.fillStyle = '#000';
      // 가까운 번짐과 먼 번짐을 겹친다
      for (const [blur, a] of [[GY * 0.4, dark ? 0.9 : 0.35], [GY, dark ? 0.8 : 0.3]]) {
        ctx.shadowColor = rgba(ink, a);
        ctx.shadowBlur = blur;
        ctx.fill();
      }
      ctx.restore();

      // 몸통 → 안쪽 → 심. 안으로 갈수록 밝다
      beam(1);
      ctx.fillStyle = ramp(0.08, dark ? 0.5 : 0.55, ink);
      ctx.fill();
      beam(0.55);
      ctx.fillStyle = ramp(0.12, dark ? 0.75 : 0.75, core);
      ctx.fill();
      beam(0.2);
      ctx.fillStyle = ramp(0.2, 1, core);
      ctx.fill();

      // 빛의 결: 밝은 마디가 머리에 다가갈수록 빨라지며 흘러들어 스민다
      beam(1);
      ctx.clip();
      const PULSES = 7;
      for (let i = 0; i < PULSES; i++) {
        const k = (t * 0.28 + i / PULSES) % 1;
        const e = k * k;
        const cx = x0 + span * e;
        const w = Math.max(10, span * (0.16 - 0.12 * e));
        const a = Math.sin(k * Math.PI * 0.5) ** 2 * Math.min(1, (1 - k) * 14) * (dark ? 0.55 : 0.35);
        const g = ctx.createLinearGradient(cx - w, 0, cx + w * 0.3, 0);
        g.addColorStop(0, rgba(core, 0));
        g.addColorStop(0.8, rgba(core, a));
        g.addColorStop(1, rgba(core, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - w, cy - maxT, w * 1.3, maxT * 2);
      }
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
