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
 * 채워진 면은 지금을 가리키는 실선 쪽으로 물처럼 흘러든다. (?bar=aurora 로 볼 수 있다)
 */
export function FlowBarAurora({ progress, months }: Props) {
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
      // 앞쪽 물살이 흐르는 구간: 실선에서 이만큼 뒤부터
      const reach = Math.min(span, Math.max(barH * 5, 140));
      const fillPath = () => {
        ctx.beginPath();
        ctx.rect(x0, y0, span, barH);
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

      // 오로라 커튼: 막대 위로 세로 빛줄기가 늘어져 일렁인다
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

      // 흩날림: 윗면에서 빛 안개가 피어올라 비스듬히 흩어진다
      for (const w of WISPS) {
        const k = (t / w.life + w.phase) % 1;
        const fade = Math.sin(k * Math.PI);
        const wx = x0 + span * ((w.x + t * w.drift) % 1) + k * barH * 1.5;
        if (wx > fx) continue;
        const wy = y0 - k * (GY + barH * 0.3);
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
      ctx.fillRect(x0, y0, span, barH);

      // 윗면의 윤기와 바닥의 깊이
      const gloss = ctx.createLinearGradient(0, y0, 0, y0 + barH);
      gloss.addColorStop(0, rgba(paper, 0));
      gloss.addColorStop(0.18, rgba(dark ? [255, 255, 255] : paper, dark ? 0.22 : 0.18));
      gloss.addColorStop(0.5, rgba(paper, 0));
      gloss.addColorStop(1, rgba(paper, dark ? 0.1 : 0.18));
      ctx.fillStyle = gloss;
      ctx.fillRect(x0, y0, span, barH);

      // 물살: 앞쪽 면의 결이 실선에 가까울수록 빨라지며 흘러들고, 실선 앞에 빛이 고인다
      const pool = ctx.createLinearGradient(fx - reach, 0, fx, 0);
      pool.addColorStop(0, rgba(ink, 0));
      pool.addColorStop(1, rgba(ink, dark ? 0.35 : 0.3));
      ctx.fillStyle = pool;
      ctx.fillRect(fx - reach, y0, reach, barH);
      const glint = dark ? ink : paper;
      const trough = dark ? paper : ink;
      const STREAMS = 6;
      for (let i = 0; i < STREAMS; i++) {
        const k = (t * 0.32 + i / STREAMS) % 1; // 0 → 1: 멀리서 실선까지
        const e = k * k; // 실선에 가까울수록 빨라진다
        const cx = fx - reach * (1 - e);
        const w = reach * (0.22 - 0.15 * e); // 다가갈수록 좁아지고
        const a = Math.sin(k * Math.PI * 0.5) ** 2 * Math.min(1, (1 - k) * 12) * (dark ? 0.7 : 0.45); // 밝아지다가 닿으면 스민다
        const g = ctx.createLinearGradient(cx - w, 0, cx + w * 0.35, 0);
        // 물마루 뒤에 옅은 골이 따라와 결이 보인다
        g.addColorStop(0, rgba(trough, 0));
        g.addColorStop(0.4, rgba(trough, a * 0.45));
        g.addColorStop(0.78, rgba(glint, a));
        g.addColorStop(1, rgba(glint, 0));
        ctx.fillStyle = g;
        // 가운데가 조금 앞서 나가는 물머리. 앞뒤 가장자리가 잔물결로 흔들린다
        const curve = (v: number, back: number) =>
          cx + back + Math.sin(v * Math.PI) * w * 0.12 + Math.sin(v * 5 + t * 2.6 + i * 1.7) * barH * 0.05;
        const SEG = 12;
        ctx.beginPath();
        for (let j = 0; j <= SEG; j++) ctx.lineTo(curve(j / SEG, w * 0.35), y0 + (j / SEG) * barH);
        for (let j = SEG; j >= 0; j--) ctx.lineTo(curve(j / SEG, -w), y0 + (j / SEG) * barH);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // 지금 이 순간: 실선은 가만히 서 있고, 초마다 한 번 그 둘레가 환하게 번진다
      const sec = now().getSeconds();
      if (sec !== head.lastSec) {
        head.lastSec = sec;
        head.pulse = still ? 0 : 1;
      }
      head.pulse = Math.max(0, head.pulse - dt * 1.25);
      const pulse = head.pulse;
      const hx = Math.min(W - GX - 1, fx);
      const hy = y0 + barH / 2;
      const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, barH * 0.6 + GY * (0.7 + (1 - pulse) * 0.5));
      halo.addColorStop(0, rgba(ink, (dark ? 0.2 : 0.1) + (dark ? 0.3 : 0.15) * pulse));
      halo.addColorStop(1, rgba(ink, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(hx - GY * 2 - barH, 0, GY * 4 + barH * 2, H);

      ctx.fillStyle = rgba(ink, 1);
      ctx.fillRect(hx - 1, y0 - 3, 2, barH + 6);
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
