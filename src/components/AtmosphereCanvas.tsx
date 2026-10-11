import * as stylex from '@stylexjs/stylex';
import { useRef } from 'react';
import { atmosphere, stepAtmosphere } from '../lib/atmosphere';
import { reducedMotion, rgba, seeded, useCanvas } from '../lib/canvas';

const s = stylex.create({
  canvas: {
    position: 'fixed',
    inset: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
    pointerEvents: 'none',
  },
});

const rnd = seeded(20260101);
const STARS = Array.from({ length: 120 }, () => ({
  x: rnd(),
  y: rnd() * 0.78,
  r: 0.5 + rnd() * 1.1,
  tw: 0.4 + rnd() * 1.6,
  ph: rnd() * Math.PI * 2,
}));
const BLOBS = Array.from({ length: 5 }, (_, i) => ({
  ax: 0.05 + rnd() * 0.06,
  ay: 0.04 + rnd() * 0.05,
  px: rnd() * 6.28,
  py: rnd() * 6.28,
  r: 0.38 + rnd() * 0.22,
  light: i % 2 === 0,
}));

let grain: HTMLCanvasElement | null = null;
function grainTile() {
  if (grain) return grain;
  grain = document.createElement('canvas');
  grain.width = grain.height = 160;
  const g = grain.getContext('2d')!;
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 90 + Math.random() * 76;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return grain;
}

/** 해·달이 하루 동안 그리는 호 위의 위치 (0..1 좌표) */
function lightPos(hour: number) {
  const day = (hour - 5.5) / 13.5;
  if (day >= 0 && day <= 1) return { x: 0.06 + 0.88 * day, y: 1.02 - 0.9 * Math.sin(Math.PI * day), moon: false };
  const n = (((hour - 19) % 24) + 24) % 24 / 10.5;
  return { x: 0.07 + 0.86 * n, y: 0.2 - 0.13 * Math.sin(Math.PI * n), moon: true };
}

export function AtmosphereCanvas() {
  const st8 = useRef({ skip: 0, still: 0 }).current;
  const { ref } = useCanvas(
    (ctx, W, H, t, dt) => {
      const moving = stepAtmosphere(dt);
      // 배경은 30fps 면 충분하다. 시간대를 감는 중이거나 크기가 바뀐 직후(dt = 0)에는 반드시 그린다.
      if (dt > 0 && !moving) {
        st8.skip ^= 1;
        if (st8.skip) return;
        if (reducedMotion()) {
          st8.still += dt;
          if (st8.still < 2) return;
          st8.still = 0;
        }
      }
      if (reducedMotion()) t = 0;
      const { sky, hour, dark, ink } = atmosphere;
      const D = Math.max(W, H);

      const base = ctx.createLinearGradient(0, 0, 0, H);
      base.addColorStop(0, rgba(sky.top, 1));
      base.addColorStop(1, rgba(sky.bottom, 1));
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, W, H);

      const lp = lightPos(hour);
      const lx = lp.x * W;
      const ly = lp.y * H;

      // 흐르는 농담: 아주 느리게 떠다니는 빛과 그늘
      for (const b of BLOBS) {
        const x = W * (0.5 + 0.46 * Math.sin(t * b.ax + b.px));
        const y = H * (0.5 + 0.42 * Math.cos(t * b.ay + b.py));
        const r = D * b.r;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const c = b.light ? sky.glow : dark ? [0, 0, 0] : ink;
        const a = b.light ? (dark ? 0.07 : 0.34) : dark ? 0.3 : 0.06;
        g.addColorStop(0, rgba(c, a));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // 광원
      const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, D * 0.72);
      glow.addColorStop(0, rgba(sky.glow, sky.glowA * (dark ? 0.3 : 0.9)));
      glow.addColorStop(0.35, rgba(sky.glow, sky.glowA * (dark ? 0.1 : 0.4)));
      glow.addColorStop(1, rgba(sky.glow, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      if (!dark) {
        // 밝은 시간대는 빛 반대편에 옅은 그늘을 둬서 방향이 읽히게 한다
        const ox = W - lx;
        const oy = H * 1.05;
        const sh = ctx.createRadialGradient(ox, oy, 0, ox, oy, D * 0.9);
        sh.addColorStop(0, rgba(ink, 0.13));
        sh.addColorStop(1, rgba(ink, 0));
        ctx.fillStyle = sh;
        ctx.fillRect(0, 0, W, H);
      }

      // 빛줄기 (아침·오후)
      if (sky.rays > 0.01) {
        const len = D * 1.6;
        const toCenter = Math.atan2(H * 0.62 - ly, W * 0.5 - lx);
        for (let i = -3; i <= 3; i++) {
          const a = toCenter + i * 0.21 + Math.sin(t * 0.07 + i * 1.7) * 0.035;
          const half = 0.055 + 0.02 * Math.sin(t * 0.11 + i);
          const g = ctx.createLinearGradient(lx, ly, lx + Math.cos(a) * len, ly + Math.sin(a) * len);
          const lightBeam = i % 2 === 0;
          const c = lightBeam ? [255, 255, 255] : ink;
          const alpha = (lightBeam ? 0.42 : 0.05) * sky.rays;
          g.addColorStop(0, rgba(c, alpha));
          g.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + Math.cos(a - half) * len, ly + Math.sin(a - half) * len);
          ctx.lineTo(lx + Math.cos(a + half) * len, ly + Math.sin(a + half) * len);
          ctx.closePath();
          ctx.fill();
        }
      }

      // 지평선의 빛 (새벽·저녁)
      if (sky.horizon > 0.01) {
        ctx.save();
        ctx.translate(lx, H * 1.02);
        ctx.scale(1, 0.26);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.85);
        g.addColorStop(0, rgba(sky.glow, 0.55 * sky.horizon));
        g.addColorStop(0.5, rgba(sky.glow, 0.16 * sky.horizon));
        g.addColorStop(1, rgba(sky.glow, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-W * 2, -W * 2, W * 4, W * 4);
        ctx.restore();
      }

      // 안개 띠 (새벽)
      if (sky.mist > 0.01) {
        for (let i = 0; i < 4; i++) {
          const y0 = H * (0.56 + i * 0.11);
          const g = ctx.createLinearGradient(0, y0 - H * 0.05, 0, y0 + H * 0.2);
          g.addColorStop(0, rgba(sky.glow, 0));
          g.addColorStop(0.35, rgba(sky.glow, 0.085 * sky.mist));
          g.addColorStop(1, rgba(sky.glow, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(0, H);
          for (let x = 0; x <= W + 40; x += 40) {
            const y = y0 + Math.sin(x * 0.004 + t * (0.09 + i * 0.03) + i * 2.1) * H * 0.025
              + Math.sin(x * 0.0017 - t * 0.05 + i) * H * 0.03;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(W, H);
          ctx.closePath();
          ctx.fill();
        }
      }

      // 별과 달 (밤)
      if (sky.stars > 0.01) {
        for (const st of STARS) {
          const a = sky.stars * (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * st.tw + st.ph))) * 0.8;
          ctx.fillStyle = rgba(sky.glow, a);
          ctx.beginPath();
          ctx.arc(st.x * W, st.y * H, st.r, 0, 6.283);
          ctx.fill();
        }
      }
      if (lp.moon && dark) {
        const r = Math.min(W, H) * 0.03;
        const a = Math.min(1, sky.stars + 0.2);
        const halo = ctx.createRadialGradient(lx, ly, r * 0.6, lx, ly, r * 5);
        halo.addColorStop(0, rgba(sky.glow, 0.16 * a));
        halo.addColorStop(1, rgba(sky.glow, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(lx - r * 5, ly - r * 5, r * 10, r * 10);
        ctx.fillStyle = rgba(sky.glow, 0.26 * a);
        ctx.beginPath();
        ctx.arc(lx, ly, r, 0, 6.283);
        ctx.fill();
      }

      // 가장자리 어둠
      const vg = ctx.createRadialGradient(W / 2, H / 2, D * 0.3, W / 2, H / 2, D * 0.78);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(0,0,0,${dark ? 0.42 : 0.07})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // 필름 그레인
      const tile = grainTile();
      const pat = ctx.createPattern(tile, 'repeat');
      if (pat) {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = dark ? 0.16 : 0.11;
        const ox = reducedMotion() ? 0 : Math.floor(Math.random() * 160);
        const oy = reducedMotion() ? 0 : Math.floor(Math.random() * 160);
        ctx.translate(-ox, -oy);
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, W + 160, H + 160);
        ctx.restore();
      }
    },
    { maxDpr: 1 },
  );

  return <canvas ref={ref} aria-hidden {...stylex.props(s.canvas)} />;
}
