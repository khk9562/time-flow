import { now } from './time';

export type RGB = [number, number, number];

export type Sky = {
  top: RGB;
  bottom: RGB;
  glow: RGB;
  glowA: number;
  stars: number;
  mist: number;
  rays: number;
  horizon: number;
};

type Key = Sky & { h: number };

const hex = (s: string): RGB => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
];

const k = (
  h: number, top: string, bottom: string, glow: string,
  glowA: number, stars: number, mist: number, rays: number, horizon: number,
): Key => ({ h, top: hex(top), bottom: hex(bottom), glow: hex(glow), glowA, stars, mist, rays, horizon });

// 하루의 밝기 곡선. 무채색을 유지하되 새벽은 차갑게, 오후·저녁은 아주 약하게 따뜻하게 기운다.
const KEYS: Key[] = [
  k(0.0, '#070708', '#141416', '#d8dbe6', 0.42, 1.0, 0.0, 0.0, 0.0),
  k(4.0, '#070708', '#141416', '#d8dbe6', 0.42, 1.0, 0.0, 0.0, 0.0),
  k(5.0, '#111216', '#3c3f48', '#e6e9f2', 0.5, 0.4, 1.0, 0.0, 0.8),
  k(6.2, '#2c2f35', '#6f737c', '#f2f4f8', 0.6, 0.0, 0.9, 0.0, 1.0),
  k(6.8, '#c2c4c7', '#e6e5e1', '#ffffff', 0.8, 0.0, 0.5, 0.7, 0.3),
  k(9.0, '#dbdcdb', '#f0efec', '#ffffff', 0.85, 0.0, 0.0, 1.0, 0.0),
  k(11.5, '#f2f2f0', '#fbfbf9', '#ffffff', 0.9, 0.0, 0.0, 0.15, 0.0),
  k(14.5, '#f2f2f0', '#fbfbf9', '#ffffff', 0.9, 0.0, 0.0, 0.15, 0.0),
  k(16.0, '#e8e5df', '#d8d3ca', '#fffaf0', 0.85, 0.0, 0.0, 0.9, 0.0),
  k(17.6, '#cfcac1', '#b7b0a4', '#fff6e6', 0.8, 0.0, 0.0, 0.6, 0.5),
  k(18.3, '#34322f', '#5e574e', '#f1e7d6', 0.5, 0.0, 0.0, 0.0, 1.0),
  k(19.6, '#171616', '#3a3531', '#e6dccb', 0.36, 0.3, 0.0, 0.0, 0.8),
  k(21.0, '#070708', '#141416', '#d8dbe6', 0.42, 1.0, 0.0, 0.0, 0.0),
  k(24.0, '#070708', '#141416', '#d8dbe6', 0.42, 1.0, 0.0, 0.0, 0.0),
];

export const PHASES = [
  { id: 'dawn', ko: '새벽', en: 'DAWN', from: 4, to: 6.5, show: 5.4 },
  { id: 'morning', ko: '아침', en: 'MORNING', from: 6.5, to: 11, show: 8.6 },
  { id: 'day', ko: '낮', en: 'DAY', from: 11, to: 15, show: 13 },
  { id: 'afternoon', ko: '오후', en: 'AFTERNOON', from: 15, to: 18, show: 16.4 },
  { id: 'evening', ko: '저녁', en: 'EVENING', from: 18, to: 21, show: 19.3 },
  { id: 'night', ko: '밤', en: 'NIGHT', from: 21, to: 28, show: 23.2 },
] as const;

export type PhaseId = (typeof PHASES)[number]['id'];

export function phaseOf(hour: number): (typeof PHASES)[number] {
  const h = ((hour % 24) + 24) % 24;
  return PHASES.find((p) => (h >= p.from && h < p.to) || (h + 24 >= p.from && h + 24 < p.to)) ?? PHASES[5];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function sampleSky(hour: number): Sky {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  return {
    top: lerp3(a.top, b.top, t),
    bottom: lerp3(a.bottom, b.bottom, t),
    glow: lerp3(a.glow, b.glow, t),
    glowA: lerp(a.glowA, b.glowA, t),
    stars: lerp(a.stars, b.stars, t),
    mist: lerp(a.mist, b.mist, t),
    rays: lerp(a.rays, b.rays, t),
    horizon: lerp(a.horizon, b.horizon, t),
  };
}

const lum = (c: RGB) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};

const INK_DARK: RGB = [17, 17, 18];
const INK_LIGHT: RGB = [240, 239, 235];
const WHITE: RGB = [255, 255, 255];

const realHour = () => {
  const d = now();
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
};

/** 화면 전체가 공유하는 현재 분위기. 캔버스 루프가 매 프레임 갱신한다. */
export const atmosphere = {
  hour: realHour(),
  preview: null as number | null,
  sky: sampleSky(realHour()),
  ink: INK_LIGHT as RGB,
  paper: [12, 12, 13] as RGB,
  dark: true,
};

const listeners = new Set<() => void>();
let snapshot = '';

function computeSnapshot() {
  return `${phaseOf(atmosphere.hour).id}|${atmosphere.preview === null ? 'live' : 'preview'}|${atmosphere.dark ? 'd' : 'l'}`;
}

export function subscribeAtmosphere(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export const atmosphereSnapshot = () => snapshot;

let lastApplied = -99;

function apply(force = false) {
  const sky = sampleSky(atmosphere.hour);
  atmosphere.sky = sky;
  const paper = lerp3(sky.top, sky.bottom, 0.5);
  const L = lum(paper);
  const dark = (L + 0.05) / (lum(INK_DARK) + 0.05) < (lum(INK_LIGHT) + 0.05) / (L + 0.05);
  atmosphere.paper = paper;
  atmosphere.dark = dark;
  atmosphere.ink = dark ? INK_LIGHT : INK_DARK;

  if (force || Math.abs(atmosphere.hour - lastApplied) > 0.003) {
    lastApplied = atmosphere.hour;
    const surface = dark ? lerp3(paper, WHITE, 0.055) : lerp3(paper, WHITE, 0.62);
    const css = (c: RGB) => c.map((v) => Math.round(v)).join(' ');
    const root = document.documentElement;
    root.style.setProperty('--paper-rgb', css(paper));
    root.style.setProperty('--surface-rgb', css(surface));
    root.style.setProperty('--ink-rgb', css(atmosphere.ink));
    root.style.colorScheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${css(sky.top).replace(/ /g, ',')})`);
  }
  const s = computeSnapshot();
  if (s !== snapshot) {
    snapshot = s;
    listeners.forEach((l) => l());
  }
}

/** 한 프레임 진행. 미리보기 시각으로는 하루를 빠르게 감듯 이동한다. 값이 움직이는 중이면 true. */
export function stepAtmosphere(dt: number): boolean {
  const target = atmosphere.preview ?? realHour();
  let d = target - atmosphere.hour;
  d = ((((d + 12) % 24) + 24) % 24) - 12;
  const moving = Math.abs(d) > 0.004;
  if (moving) atmosphere.hour = (atmosphere.hour + d * (1 - Math.exp(-dt * 2.6)) + 24) % 24;
  else atmosphere.hour = target;
  apply();
  return moving;
}

let previewTimer = 0;
export function setPreview(hour: number | null) {
  clearTimeout(previewTimer);
  atmosphere.preview = hour;
  if (hour !== null) previewTimer = window.setTimeout(() => setPreview(null), 24000);
  apply(true);
}

apply(true);
