import * as stylex from '@stylexjs/stylex';
import { useSyncExternalStore } from 'react';
import { atmosphere, atmosphereSnapshot, subscribeAtmosphere } from '../lib/atmosphere';
import { dayHasContent, PEN_COLORS, useDB, type DayEntry } from '../lib/store';
import { dayKey, daysInMonth, monthProgress, MONTHS_EN, now, useSlowNow, WEEKDAYS, WEEKDAYS_SHORT } from '../lib/time';
import { color, dur, ease, radius, type } from '../tokens.stylex';
import { FlowBar } from './FlowBar';
import { ui } from './ui';

const riseIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(14px) scale(0.92)' },
  to: { opacity: 1, transform: 'translateY(0) scale(1)' },
});
const slideIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translateX(40px)' },
  to: { opacity: 1, transform: 'translateX(0)' },
});

const s = stylex.create({
  root: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    paddingInline: 'clamp(20px, 4vw, 48px)',
    paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
    transitionProperty: 'opacity, transform',
    transitionDuration: dur.quick,
    transitionTimingFunction: ease.out,
  },
  leaving: { opacity: 0, transform: 'scale(0.97)', pointerEvents: 'none' },
  top: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: { default: 56, '@media (max-width: 560px)': 64 },
    paddingTop: 12,
    marginInline: -10,
    flexShrink: 0,
  },
  nav: { display: 'flex', alignItems: 'center' },
  body: {
    flexGrow: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: 600,
    marginInline: 'auto',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    animationName: slideIn,
    animationDuration: '700ms',
    animationDelay: '220ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
  },
  head: { display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 14 },
  num: { fontSize: 'clamp(72px, 15vh, 132px)', fontWeight: 200, lineHeight: 0.82, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' },
  headText: { display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 4 },
  en: { fontSize: type.small, fontWeight: 700, letterSpacing: '0.22em' },
  yr: { fontSize: type.small, fontWeight: 500, color: color.inkSoft, letterSpacing: '0.1em' },
  bar: { height: 8, marginBottom: 18 },
  week: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 },
  wd: { textAlign: 'center', fontSize: type.small, fontWeight: 600, color: color.inkSoft, paddingBlock: 6 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 2 },
  cell: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'clamp(46px, 8.4vh, 68px)',
    borderRadius: radius.control,
    fontSize: 'clamp(15px, 2.3vh, 19px)',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
    color: color.ink,
    backgroundColor: { default: 'transparent', ':hover': color.wash, ':active': color.washStrong },
    transitionProperty: 'background-color, transform',
    transitionDuration: dur.tap,
    transform: { default: 'none', ':active': 'scale(0.9)' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: -2,
    animationName: riseIn,
    animationDuration: '520ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'backwards',
  },
  past: { color: color.inkSoft },
  today: { fontWeight: 900 },
  ringWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 'min(78%, 46px)',
    aspectRatio: '1',
    transform: 'translate(-50%, -50%)',
    borderRadius: '50%',
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: color.ink,
    pointerEvents: 'none',
  },
  marks: { position: 'absolute', bottom: 5, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 2, height: 4 },
  mark: { width: 9, height: 4, borderRadius: 2 },
  markInk: { backgroundColor: color.inkSoft },
  hint: { marginTop: 18, fontSize: type.small, color: color.inkSoft, textAlign: 'center' },
});

function usedPens(e: DayEntry): number[] {
  const set = new Set<number>();
  for (const c of e.cells) if (c > 0) set.add(c);
  for (const t of e.tasks) if (t.hl > 0) set.add(t.hl);
  return [...set].sort().slice(0, 4);
}

type Props = {
  year: number;
  month: number;
  leaving: boolean;
  onPick: (day: number) => void;
  onClose: () => void;
  onStep: (delta: number) => void;
};

export function Calendar({ year, month, leaving, onPick, onClose, onStep }: Props) {
  const db = useDB();
  const today = useSlowNow();
  useSyncExternalStore(subscribeAtmosphere, atmosphereSnapshot);
  const offset = new Date(year, month - 1, 1).getDay();
  const count = daysInMonth(year, month);
  const todayKey = dayKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const alpha = atmosphere.dark ? 0.85 : 1;

  return (
    <div {...stylex.props(s.root, leaving && s.leaving)}>
      <div {...stylex.props(s.top)}>
        <button type="button" aria-label="달력 닫기" onClick={onClose} {...stylex.props(ui.iconButton, ui.navButton)}>
          ←
        </button>
        <div {...stylex.props(s.nav)}>
          <button type="button" aria-label="이전 달" onClick={() => onStep(-1)} {...stylex.props(ui.iconButton, ui.navButton)}>
            ‹
          </button>
          <button type="button" aria-label="다음 달" onClick={() => onStep(1)} {...stylex.props(ui.iconButton, ui.navButton)}>
            ›
          </button>
        </div>
      </div>

      <div {...stylex.props(s.body)}>
        <div {...stylex.props(s.head)}>
          <h2 key={month} {...stylex.props(s.num)} aria-label={`${year}년 ${month}월`}>
            {month}
          </h2>
          <div {...stylex.props(s.headText)} aria-hidden>
            <span {...stylex.props(s.en)}>{MONTHS_EN[month - 1]}</span>
            <span {...stylex.props(s.yr)}>{year}</span>
          </div>
        </div>
        <div {...stylex.props(s.bar)}>
          <FlowBar progress={() => monthProgress(year, month, now())} />
        </div>

        <div {...stylex.props(s.week)} aria-hidden>
          {WEEKDAYS_SHORT.map((w) => (
            <span key={w} {...stylex.props(s.wd)}>
              {w}
            </span>
          ))}
        </div>
        <div key={`${year}-${month}`} {...stylex.props(s.grid)}>
          {Array.from({ length: offset }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const d = i + 1;
            const key = dayKey(year, month, d);
            const entry = db.days[key];
            const has = dayHasContent(entry);
            const pens = has ? usedPens(entry) : [];
            const isToday = key === todayKey;
            const idx = offset + i;
            const wd = WEEKDAYS[idx % 7];
            return (
              <button
                key={d}
                type="button"
                aria-label={`${month}월 ${d}일 ${wd}${isToday ? ', 오늘' : ''}${has ? ', 기록 있음' : ''}`}
                aria-current={isToday ? 'date' : undefined}
                onClick={() => onPick(d)}
                {...stylex.props(s.cell, key < todayKey && s.past, isToday && s.today)}
                style={{ animationDelay: `${260 + Math.floor(idx / 7) * 45 + (idx % 7) * 16}ms` }}
              >
                {isToday && <span aria-hidden {...stylex.props(s.ringWrap)} />}
                {d}
                {has && (
                  <span aria-hidden {...stylex.props(s.marks)}>
                    {pens.length === 0 && <span {...stylex.props(s.mark, s.markInk)} />}
                    {pens.map((id) => (
                      <span
                        key={id}
                        {...stylex.props(s.mark)}
                        style={{ backgroundColor: `rgb(${PEN_COLORS[id - 1].rgb.join(' ')} / ${alpha})` }}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p {...stylex.props(s.hint)}>날짜를 고르면 그날의 플래너가 열립니다</p>
      </div>
    </div>
  );
}
