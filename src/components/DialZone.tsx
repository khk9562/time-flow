import * as stylex from '@stylexjs/stylex';
import { useEffect, useMemo, useRef, useState } from 'react';
import { color, dur, ease, radius, type } from '../tokens.stylex';
import { Dial, type DialItem } from './Dial';

const pop = stylex.keyframes({
  '0%': { transform: 'translateY(26px) scale(0.3)', opacity: 0 },
  '45%': { transform: 'translateY(-4px) scale(1.1)', opacity: 1 },
  '70%': { transform: 'translateY(1px) scale(0.97)' },
  '100%': { transform: 'translateY(0) scale(1)', opacity: 1 },
});
const ring = stylex.keyframes({
  '0%': { transform: 'scale(0.9)', opacity: 0.55 },
  '100%': { transform: 'scale(1.5, 2.1)', opacity: 0 },
});

const s = stylex.create({
  zone: {
    position: 'relative',
    flexShrink: 0,
    overflow: 'hidden',
    transitionProperty: 'height',
    transitionDuration: dur.stage,
    transitionTimingFunction: ease.inOut,
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    transitionProperty: 'top, opacity, transform',
    transitionDuration: dur.stage,
    transitionTimingFunction: ease.inOut,
  },
  hidden: { opacity: 0, pointerEvents: 'none', transform: 'translateY(36px)' },
  shown: { opacity: 1, transform: 'translateY(0)' },
  buttonRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  plan: {
    position: 'relative',
    pointerEvents: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingInline: 22,
    borderRadius: radius.pill,
    backgroundColor: color.ink,
    color: color.inverse,
    fontSize: type.body,
    fontWeight: 700,
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
    animationName: pop,
    animationDuration: '620ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'backwards',
    transitionProperty: 'transform',
    transitionDuration: dur.tap,
    transform: { default: 'none', ':active': 'scale(0.95)' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: 3,
    '::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderStyle: 'solid',
      borderColor: color.ink,
      pointerEvents: 'none',
      animationName: ring,
      animationDuration: '900ms',
      animationDelay: '160ms',
      animationTimingFunction: ease.out,
      animationFillMode: 'both',
    },
  },
  arrow: { fontWeight: 400, transform: 'translateY(-1px)' },
});

export type YearOption = { year: number; enabled: boolean; hasData: boolean };

type Props = {
  years: YearOption[];
  year: number;
  engaged: boolean;
  /** 확정된 월 (없으면 null) */
  month: number | null;
  /** 월 다이얼이 가리키는 월 */
  monthCursor: number;
  onYear: (year: number) => void;
  onYearTap: () => void;
  onMonth: (month: number) => void;
  onOpenPlan: (origin: { x: number; y: number }) => void;
  onActivity: () => void;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const deg = (rad: number) => (rad * 180) / Math.PI;

/** 화면 맨 아래의 다이얼 영역: 계획 버튼 → 연도 호 → 월 호 가 같은 중심을 공유한다. */
export function DialZone(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const g = useMemo(() => {
    const w = Math.max(W, 280);
    const yearFont = clamp(w * 0.052, 28, 58);
    const monthFont = clamp(w * 0.031, 17, 30);
    const Ry = w * 1.3;
    const yearRow = Math.round(yearFont * 1.1 + 30);
    const buttonRow = 58;
    const yearBase = yearFont * 1.1;
    const monthBase = monthFont * 1.1;
    const Rm = Ry - (yearRow + monthBase - yearBase);
    const stepY = deg(Math.asin(clamp((0.21 * w) / Ry, 0, 1)));
    const stepM = deg(Math.asin(clamp((0.36 * w) / Rm, 0, 1))) / 3;
    const drop = Rm * (1 - Math.cos(((stepM * Math.PI) / 180) * 3));
    const monthRow = Math.round(monthBase + 22 + drop * 0.9);
    return { yearFont, monthFont, Ry, Rm, yearRow, buttonRow, stepY, stepM, monthRow };
  }, [W]);

  const yearItems: DialItem[] = useMemo(
    () =>
      p.years.map((y) => ({
        key: y.year,
        label: String(y.year),
        disabled: !y.enabled,
        aria: `${y.year}년${y.enabled ? '' : ', 작성된 계획 없음'}`,
      })),
    [p.years],
  );
  const monthItems: DialItem[] = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ key: i, label: `${i + 1}월` })),
    [],
  );

  const yi = Math.max(0, p.years.findIndex((y) => y.year === p.year));
  const current = p.years[yi];
  const height = p.engaged ? g.buttonRow + g.yearRow + g.monthRow : g.yearRow + 10;

  return (
    <section
      ref={ref}
      aria-label="연도와 월 선택"
      {...stylex.props(s.zone)}
      style={{ height }}
      onPointerDownCapture={p.onActivity}
      onKeyDownCapture={p.onActivity}
      onWheelCapture={p.onActivity}
    >
      {W > 0 && (
        <>
          <div {...stylex.props(s.buttonRow)} style={{ height: g.buttonRow }}>
            {p.engaged && current?.enabled && (
              <button
                key={p.year}
                type="button"
                {...stylex.props(s.plan)}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  p.onOpenPlan({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
                }}
              >
                {p.year} 계획 {current.hasData ? '보기' : '쓰기'}
                <span aria-hidden {...stylex.props(s.arrow)}>
                  →
                </span>
              </button>
            )}
          </div>

          <div {...stylex.props(s.row)} style={{ top: p.engaged ? g.buttonRow : 6 }}>
            <Dial
              id="dial-year"
              ariaLabel="연도"
              items={yearItems}
              index={yi}
              onChange={(i) => p.onYear(p.years[i].year)}
              onCommit={p.onYearTap}
              radius={g.Ry}
              stepDeg={g.stepY}
              fontSize={g.yearFont}
              height={g.yearRow}
              visible={2}
              sideScale={0.56}
              sideOpacity={0.5}
              weight={800}
            />
          </div>

          <div
            {...stylex.props(s.row, p.engaged ? s.shown : s.hidden)}
            style={{ top: (p.engaged ? g.buttonRow : 6) + g.yearRow }}
            inert={!p.engaged}
          >
            <Dial
              id="dial-month"
              ariaLabel={`${p.year}년의 월`}
              items={monthItems}
              index={p.monthCursor - 1}
              onChange={(i) => p.onMonth(i + 1)}
              onCommit={(i) => p.onMonth(i + 1)}
              radius={g.Rm}
              stepDeg={g.stepM}
              fontSize={g.monthFont}
              height={g.monthRow}
              visible={3}
              sideScale={0.82}
              sideOpacity={0.62}
              weight={700}
              marked={p.month !== null}
            />
          </div>
        </>
      )}
    </section>
  );
}
