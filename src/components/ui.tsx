import * as stylex from '@stylexjs/stylex';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type TextareaHTMLAttributes } from 'react';
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
    backgroundColor: { default: 'transparent', ':hover': color.wash, ':active': color.washStrong },
    transitionProperty: 'background-color, transform',
    transitionDuration: dur.tap,
    transform: { default: 'none', ':active': 'scale(0.92)' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: -2,
  },
  // 화면 맨 위 이동 버튼(뒤로·이전·다음). 휴대폰에서는 손가락에 맞게 크게
  navButton: {
    width: { default: 44, '@media (max-width: 560px)': 52 },
    height: { default: 44, '@media (max-width: 560px)': 52 },
    fontSize: { default: 20, '@media (max-width: 560px)': 30 },
  },
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
    backgroundColor: { default: 'transparent', ':hover': color.wash, ':active': color.washStrong },
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
    backgroundColor: { default: 'transparent', ':hover': color.wash },
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
