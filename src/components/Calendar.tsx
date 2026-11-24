import * as stylex from '@stylexjs/stylex';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { atmosphere, atmosphereSnapshot, subscribeAtmosphere } from '../lib/atmosphere';
import { dayHasContent, PEN_COLORS, useDB, type DayEntry } from '../lib/store';
import { dayKey, daysInMonth, monthProgress, MONTHS_EN, now, useSlowNow, WEEKDAYS, WEEKDAYS_SHORT } from '../lib/time';
import { color, dur, ease, radius, type } from '../tokens.stylex';
import { DayEvents } from './DayEvents';
import { FlowBar } from './FlowBar';
import { MonthMotto } from './MonthMotto';
import { ui, useSwipe } from './ui';

const riseIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(14px) scale(0.92)' },
  to: { opacity: 1, transform: 'translateY(0) scale(1)' },
});
const slideIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translateX(40px)' },
  to: { opacity: 1, transform: 'translateX(0)' },
});

/** 같은 날을 이 시간 안에 두 번 누르면 플래너를 연다 */
const DOUBLE_MS = 400;

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
    height: 64,
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
    // 일정이 늘어나면 아래로 스크롤된다
    overflowX: 'hidden',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    scrollbarWidth: 'none',
    paddingBottom: 8,
    animationName: slideIn,
    animationDuration: '700ms',
    animationDelay: '220ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
  },
  // 큰 숫자의 윗부분이 스크롤 영역에 잘리지 않게 위를 조금 비운다
  head: { display: 'flex', alignItems: 'flex-end', gap: 16, paddingTop: 10, marginBottom: 24 },
  num: { fontSize: 'clamp(72px, 15svh, 132px)', fontWeight: 200, lineHeight: 0.82, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' },
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
    height: 'clamp(46px, 8.4svh, 68px)',
    borderRadius: radius.control,
    fontSize: 'clamp(15px, 2.3svh, 19px)',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
    color: color.ink,
    backgroundColor: { default: 'transparent', ':hover': { default: null, '@media (hover: hover)': color.wash }, ':active': color.washStrong },
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
  picked: { backgroundColor: color.washStrong, fontWeight: 800, color: color.ink },
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
  motto: { marginBottom: 14 },
  marks: { position: 'absolute', bottom: 5, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 2, height: 4 },
  mark: { width: 9, height: 4, borderRadius: 2 },
  markInk: { backgroundColor: color.inkSoft },
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
  /** 고른 날 ('YYYY-MM-DD'). 이 달이 아니면 고르지 않은 것으로 본다 */
  selected: string | null;
  onSelect: (key: string) => void;
  /** 플래너 열기 */
  onPick: (day: number) => void;
  onClose: () => void;
  onStep: (delta: number) => void;
};

export function Calendar({ year, month, leaving, selected, onSelect, onPick, onClose, onStep }: Props) {
  const db = useDB();
  const today = useSlowNow();
  useSyncExternalStore(subscribeAtmosphere, atmosphereSnapshot);
  const offset = new Date(year, month - 1, 1).getDay();
  const count = daysInMonth(year, month);
  const todayKey = dayKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const alpha = atmosphere.dark ? 0.85 : 1;
  // 왼쪽으로 밀면 다음 달, 오른쪽으로 밀면 지난달, 왼쪽 끝에서 밀면 달력을 닫는다
  const swipe = useSwipe({ onNext: () => onStep(1), onPrev: () => onStep(-1), onBack: onClose });

  // 달력은 가운데에 놓되, 일정 영역이 나타나도 날짜 칸이 움직이지 않도록 위쪽 여백을 직접 잰다
  // (CSS 가운데 정렬은 내용이 늘면 전체가 다시 자리를 잡아, 두 번 누르는 사이에 칸이 달아난다)
  const bodyRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef<HTMLDivElement>(null);
  const [pad, setPad] = useState(0);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const base = baseRef.current;
    if (!body || !base) return;
    const fit = () => setPad(Math.max(0, Math.floor((body.clientHeight - base.offsetHeight) / 2)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(body);
    ro.observe(base);
    return () => ro.disconnect();
  }, []);

  // 고른 날이 이 달에 있을 때만 일정 영역을 보여 준다
  const picked = selected?.startsWith(dayKey(year, month, 1).slice(0, 8)) ? selected : null;
  // 달이 바뀌면 처음 자리로
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [year, month]);
  // 일정 영역이 화면 아래로 넘치면 보이는 곳까지 올린다. 두 번 누르기가 끝난 뒤에 움직여야 칸이 달아나지 않는다
  useEffect(() => {
    if (!picked) return;
    // scrollIntoView 는 패널이 열리는 중에 바깥 패널까지 옆으로 밀 수 있어, 달력 본문만 직접 내린다
    const id = window.setTimeout(() => {
      const body = bodyRef.current;
      const box = eventsRef.current;
      if (!body || !box) return;
      const over = box.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom;
      if (over > 0) body.scrollBy({ top: over + 8, behavior: 'smooth' });
    }, DOUBLE_MS + 40);
    return () => clearTimeout(id);
  }, [picked]);

  // 한 번 누르면 고르고, 같은 날을 빠르게 두 번 누르면 플래너로 간다
  // 달을 넘긴 직후 같은 숫자의 날을 누른 것은 두 번 누르기가 아니므로, 날짜 전체(key)로 비교한다
  const lastTap = useRef<null | { key: string; t: number }>(null);
  const hold = useRef(0);
  const tap = (d: number) => {
    const t = performance.now();
    const key = dayKey(year, month, d);
    const last = lastTap.current;
    if (last && last.key === key && t - last.t < DOUBLE_MS) {
      lastTap.current = null;
      onPick(d);
      return;
    }
    lastTap.current = { key, t };
    // 일정이 적은 날로 바꾸면 내용이 줄어 스크롤이 당겨지고 날짜 칸이 내려앉는다.
    // 두 번째 누름이 같은 칸에 떨어지도록, 판정이 끝날 때까지 일정 영역의 높이를 잡아 둔다
    const box = eventsRef.current;
    if (box) {
      box.style.minHeight = `${box.offsetHeight}px`;
      clearTimeout(hold.current);
      hold.current = window.setTimeout(() => {
        box.style.minHeight = '';
      }, DOUBLE_MS);
    }
    onSelect(key);
  };
  useEffect(() => () => clearTimeout(hold.current), []);

  return (
    <div {...stylex.props(s.root, leaving && s.leaving)} {...swipe}>
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

      <div ref={bodyRef} {...stylex.props(s.body)} style={{ paddingTop: pad }}>
        <div ref={baseRef}>
        <div {...stylex.props(s.head)}>
          <h2 key={month} {...stylex.props(s.num)} aria-label={`${year}년 ${month}월`}>
            {month}
          </h2>
          <div {...stylex.props(s.headText)} aria-hidden>
            <span {...stylex.props(s.en)}>{MONTHS_EN[month - 1]}</span>
            <span {...stylex.props(s.yr)}>{year}</span>
          </div>
        </div>
        <div {...stylex.props(s.motto)}>
          <MonthMotto key={`${year}-${month}`} year={year} month={month} />
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
            const isPicked = key === picked;
            const plans = entry?.events?.length ?? 0;
            const idx = offset + i;
            const wd = WEEKDAYS[idx % 7];
            return (
              <button
                key={d}
                type="button"
                aria-label={`${month}월 ${d}일 ${wd}${isToday ? ', 오늘' : ''}${has ? ', 기록 있음' : ''}${plans ? `, 일정 ${plans}건` : ''}`}
                aria-current={isToday ? 'date' : undefined}
                aria-pressed={isPicked}
                onClick={() => tap(d)}
                {...stylex.props(s.cell, key < todayKey && s.past, isToday && s.today, isPicked && s.picked)}
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
        </div>
        {picked && (
          <div ref={eventsRef}>
            <DayEvents key={picked} dateKey={picked} onOpenPlanner={() => onPick(+picked.slice(8))} />
          </div>
        )}
      </div>
    </div>
  );
}
