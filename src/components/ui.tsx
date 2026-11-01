import * as stylex from '@stylexjs/stylex';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type TextareaHTMLAttributes, type TouchEvent } from 'react';
import { color, dur, ease, radius, type } from '../tokens.stylex';

export const ui = stylex.create({
  iconButton: {
    flexShrink: 0,
    width: 44,
    height: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    color: color.ink,
    fontSize: 20,
    lineHeight: 1,
    backgroundColor: { default: 'transparent', ':hover': { default: null, '@media (hover: hover)': color.wash }, ':active': color.washStrong },
    transitionProperty: 'background-color, transform',
    transitionDuration: dur.tap,
    transform: { default: 'none', ':active': 'scale(0.92)' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: -2,
  },
  // 화면 맨 위 이동 버튼(뒤로·이전·다음). 눈에 잘 띄고 누르기 쉽게 크게
  navButton: { width: 52, height: 52, fontSize: 30 },
  textButton: {
    flexShrink: 0,
    height: 44,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    paddingInline: 14,
    borderRadius: radius.pill,
    fontSize: type.body,
    fontWeight: 600,
    color: color.ink,
    whiteSpace: 'nowrap',
    backgroundColor: { default: 'transparent', ':hover': { default: null, '@media (hover: hover)': color.wash }, ':active': color.washStrong },
    transitionProperty: 'background-color, transform',
    transitionDuration: dur.tap,
    transform: { default: 'none', ':active': 'scale(0.96)' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: -2,
  },
  label: {
    fontSize: type.label,
    fontWeight: 600,
    letterSpacing: type.labelTracking,
    color: color.inkSoft,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  },
});

/** 미디어 쿼리가 지금 맞는지. 화면 크기가 바뀌면 다시 그린다 */
export function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
  );
}

/**
 * 화면 키보드가 가린 높이(px). 키보드가 없거나 active 가 아니면 0.
 * iOS 는 키보드가 올라와도 레이아웃 높이를 줄이지 않으므로, 이 값만큼 아래를 비워야 입력칸이 키보드 위로 올라온다.
 */
export function useKeyboardInset(active = true) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setInset(0);
    };
  }, [active]);
  return inset;
}

/** 키보드가 올라와 화면이 줄면, 글을 쓰고 있는 칸을 보이는 곳으로 다시 데려온다 */
export function useKeepFocusVisible(inset: number) {
  useEffect(() => {
    if (!inset) return;
    const el = document.activeElement;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    // 레이아웃(아래 여백)이 반영된 다음에 옮긴다
    const id = requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    return () => cancelAnimationFrame(id);
  }, [inset]);
}

/** 이 표시가 붙은 곳(형광펜을 긋는 칸, 다이얼 등)에서 시작한 손짓은 넘기기로 보지 않는다 */
export const NO_SWIPE = { 'data-noswipe': '' } as const;
const SWIPE_MIN = 56;
const SWIPE_MAX_MS = 700;
const EDGE = 28;

/**
 * 손가락으로 좌우로 밀어 넘기기. 왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전,
 * 화면 왼쪽 끝에서 오른쪽으로 밀면 뒤로. 세로 스크롤과 헷갈리지 않게 가로로 분명히 민 것만 받는다.
 */
export function useSwipe(h: { onNext: () => void; onPrev: () => void; onBack?: () => void }) {
  const st = useRef<null | { x: number; y: number; t: number; edge: boolean }>(null);
  const H = useRef(h);
  H.current = h;
  return {
    onTouchStart: (e: TouchEvent) => {
      st.current = null;
      if (e.touches.length !== 1) return;
      const target = e.target as Element;
      if (target.closest('[data-noswipe]')) return;
      // 글을 쓰는 중인 칸 안에서는 커서 옮기기·글자 고르기를 그대로 둔다
      const el = document.activeElement;
      if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.contains(target)) return;
      const t = e.touches[0];
      st.current = { x: t.clientX, y: t.clientY, t: performance.now(), edge: t.clientX < EDGE };
    },
    onTouchEnd: (e: TouchEvent) => {
      const s = st.current;
      st.current = null;
      if (!s || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (performance.now() - s.t > SWIPE_MAX_MS) return;
      if (Math.abs(dx) < SWIPE_MIN || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      if (dx > 0 && s.edge && H.current.onBack) H.current.onBack();
      else if (dx > 0) H.current.onPrev();
      else H.current.onNext();
    },
    onTouchCancel: () => {
      st.current = null;
    },
  };
}

/** 나타남/사라짐 전환을 위해 사라지는 동안에도 잠시 남겨둔다 */
export function usePresence(show: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(show);
  if (show && !mounted) setMounted(true);
  useEffect(() => {
    if (show || !mounted) return;
    const t = window.setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [show, mounted, exitMs]);
  return { mounted: mounted || show, leaving: mounted && !show };
}

/** null 이 되기 직전의 값을 기억한다 (사라지는 화면이 내용을 유지하도록) */
export function useLast<T>(v: T | null): T | null {
  const r = useRef(v);
  if (v !== null) r.current = v;
  return r.current;
}

const ta = stylex.create({
  base: { display: 'block', width: '100%', overflow: 'hidden' },
});

/** 내용 길이에 맞춰 높이가 늘어나는 textarea */
export function AutoTextarea({
  value,
  minRows = 1,
  xstyle,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'style' | 'className'> & {
  value: string;
  minRows?: number;
  xstyle?: stylex.StyleXStyles;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(fit, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <textarea ref={ref} rows={minRows} value={value} {...rest} {...stylex.props(ta.base, xstyle)} />;
}

const ck = stylex.create({
  box: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: { default: 'transparent', ':hover': { default: null, '@media (hover: hover)': color.wash } },
    transitionProperty: 'background-color',
    transitionDuration: dur.tap,
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: -3,
  },
  round: { width: 44, height: 44, borderRadius: radius.pill, flexShrink: 0 },
  frame: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: color.lineStrong,
    borderRadius: 4,
    transitionProperty: 'background-color, border-color, transform',
    transitionDuration: dur.quick,
    transitionTimingFunction: ease.spring,
  },
  frameBare: { borderColor: 'transparent' },
  frameOn: { backgroundColor: color.ink, borderColor: color.ink, transform: 'scale(1.06)' },
  svg: { display: 'block', width: '100%', height: '100%' },
  path: {
    fill: 'none',
    stroke: color.inverse,
    strokeWidth: 2.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeDasharray: 20,
    strokeDashoffset: 20,
    transitionProperty: 'stroke-dashoffset',
    transitionDuration: '320ms',
    transitionTimingFunction: ease.out,
  },
  pathOn: { strokeDashoffset: 0 },
});

/** 체크가 그어지듯 나타나는 체크박스. bare = 칸 자체가 테두리 역할을 하는 표 안에서 사용 */
export function Check({
  checked,
  onChange,
  label,
  variant = 'cell',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  variant?: 'cell' | 'round';
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      {...stylex.props(ck.box, variant === 'round' && ck.round)}
    >
      <span {...stylex.props(ck.frame, variant === 'cell' && !checked && ck.frameBare, checked && ck.frameOn)}>
        <svg viewBox="0 0 18 18" aria-hidden {...stylex.props(ck.svg)}>
          <path d="M4 9.4l3.3 3.3L14 5.6" {...stylex.props(ck.path, checked && ck.pathOn)} />
        </svg>
      </span>
    </button>
  );
}
