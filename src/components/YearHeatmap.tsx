import * as stylex from '@stylexjs/stylex';
import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useDB, type DayEntry } from '../lib/store';
import { dayKey, daysInMonth, useSlowNow, WEEKDAYS } from '../lib/time';
import { color, ease, type } from '../tokens.stylex';
import { ui } from './ui';

/*
 * 365일 할 일 히트맵: 가로 31일 × 세로 12개월.
 *  - 칸의 바탕 진하기 = 그날 적은 할 일 개수
 *  - 칸 아래에서 차오른 잉크 = 그중 완료한 비율 (다 하면 칸이 꽉 찬다)
 * 손가락이나 마우스로 훑으면 아래 줄에 그날의 숫자가 바뀌어 보인다. 날짜를 눌러도 다른 화면으로 넘어가지 않는다.
 */

const appear = stylex.keyframes({
  from: { opacity: 0, transform: 'scale(0.2)' },
  to: { opacity: 1, transform: 'scale(1)' },
});
const swap = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(5px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

const s = stylex.create({
  root: { display: 'flex', flexDirection: 'column', gap: 14 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 },
  stat: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  statNum: { fontSize: 'clamp(20px, 5.4vw, 26px)', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  statUnit: { fontSize: type.small, fontWeight: 600, color: color.inkSoft, marginLeft: 2 },
  map: {
    display: 'grid',
    gridTemplateColumns: {
      default: '20px repeat(31, minmax(0, 1fr)) 38px',
      '@media (max-width: 560px)': '16px repeat(31, minmax(0, 1fr))',
    },
    columnGap: { default: 3, '@media (max-width: 560px)': 2 },
    rowGap: { default: 3, '@media (max-width: 560px)': 3 },
    alignItems: 'center',
    touchAction: 'pan-y',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: 6,
    borderRadius: 4,
  },
  dayHead: { fontSize: 9.5, fontWeight: 600, color: color.inkFaint, textAlign: 'center', fontVariantNumeric: 'tabular-nums', height: 12 },
  month: { fontSize: { default: 11, '@media (max-width: 560px)': 10 }, fontWeight: 700, color: color.inkSoft, fontVariantNumeric: 'tabular-nums' },
  monthNow: { color: color.ink },
  monthRate: {
    display: { default: 'block', '@media (max-width: 560px)': 'none' },
    fontSize: 10.5,
    fontWeight: 700,
    color: color.inkSoft,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  cell: {
    position: 'relative',
    aspectRatio: '1',
    borderRadius: { default: 3, '@media (max-width: 560px)': 2 },
    overflow: 'hidden',
    animationName: appear,
    animationDuration: '460ms',
    animationTimingFunction: ease.spring,
    animationFillMode: 'both',
    // 등장 애니메이션이 transform 을 쥐고 있으므로 고른 칸 확대는 scale 로 따로 한다
    transitionProperty: 'scale, box-shadow',
    transitionDuration: '220ms',
    transitionTimingFunction: ease.spring,
  },
  gone: { visibility: 'hidden' },
  // 할 일이 없는 날: 가운데 작은 점만
  blank: {
    '::after': {
      content: '""',
      position: 'absolute',
      inset: '38%',
      borderRadius: '50%',
      backgroundColor: color.line,
    },
  },
  future: { opacity: 0.45 },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.ink,
    transitionProperty: 'height',
    transitionDuration: '600ms',
    transitionTimingFunction: ease.out,
  },
  today: { boxShadow: `0 0 0 1.5px ${color.surface}, 0 0 0 3px ${color.ink}` },
  picked: { scale: '1.45', zIndex: 1, boxShadow: `0 0 0 1.5px ${color.surface}, 0 0 0 3px ${color.ink}, 0 6px 14px -4px rgb(0 0 0 / 0.35)` },
  detail: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
    paddingBlock: 10,
    paddingInline: 14,
    borderRadius: 14,
    backgroundColor: color.wash,
  },
  detailIn: { animationName: swap, animationDuration: '260ms', animationTimingFunction: ease.out },
  detailDate: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 92 },
  detailDay: { fontSize: type.body, fontWeight: 800, whiteSpace: 'nowrap' },
  detailWd: { fontSize: type.small, color: color.inkSoft },
  detailMain: { display: 'flex', flexDirection: 'column', gap: 6, flexGrow: 1, minWidth: 0 },
  detailText: { fontSize: type.small, color: color.inkSoft, fontVariantNumeric: 'tabular-nums' },
  strong: { color: color.ink, fontWeight: 800 },
  bar: { position: 'relative', height: 5, borderRadius: 999, backgroundColor: color.washStrong, overflow: 'hidden' },
  barFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
    backgroundColor: color.ink,
    transitionProperty: 'width',
    transitionDuration: '520ms',
    transitionTimingFunction: ease.out,
  },
  pct: { fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign: 'right' },
  legend: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  keys: { display: 'flex', alignItems: 'center', gap: 4 },
  keyCell: { position: 'relative', width: 12, height: 12, borderRadius: 3, overflow: 'hidden' },
  keyText: { fontSize: 11, color: color.inkSoft, marginInline: 4 },
});

type DayStat = { written: number; done: number };

const statOf = (e: DayEntry | undefined): DayStat => {
  let written = 0;
  let done = 0;
  if (e)
    for (const t of e.tasks) {
      if (!t.text.trim()) continue;
      written++;
      if (t.done) done++;
    }
  return { written, done };
};

/** 적은 개수에 따른 바탕 진하기 */
const tint = (n: number) => (n === 0 ? 0 : n <= 2 ? 0.1 : n <= 4 ? 0.17 : n <= 7 ? 0.25 : 0.34);
const bg = (n: number) => ({ backgroundColor: `rgb(var(--ink-rgb) / ${tint(n)})` });

type Props = { year: number };

export function YearHeatmap({ year }: Props) {
  const db = useDB();
  const now = useSlowNow();
  const todayKey = dayKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const inYear = now.getFullYear() === year;

  const { days, months, total } = useMemo(() => {
    const days: Record<string, DayStat> = {};
    const months = Array.from({ length: 12 }, () => ({ written: 0, done: 0 }));
    const total = { written: 0, done: 0, active: 0 };
    for (let m = 1; m <= 12; m++)
      for (let d = 1; d <= daysInMonth(year, m); d++) {
        const k = dayKey(year, m, d);
        const st = statOf(db.days[k]);
        days[k] = st;
        months[m - 1].written += st.written;
        months[m - 1].done += st.done;
        total.written += st.written;
        total.done += st.done;
        if (st.written) total.active++;
      }
    return { days, months, total };
  }, [db, year]);

  const [picked, setPicked] = useState<{ m: number; d: number }>(() =>
    inYear ? { m: now.getMonth() + 1, d: now.getDate() } : { m: 1, d: 1 },
  );
  const pk = dayKey(year, picked.m, picked.d);
  const ps = days[pk] ?? { written: 0, done: 0 };
  const pRate = ps.written ? ps.done / ps.written : 0;

  const pickAt = (e: PointerEvent) => {
    const el = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest<HTMLElement>('[data-m]');
    if (!el) return;
    const m = Number(el.dataset.m);
    const d = Number(el.dataset.d);
    if (m !== picked.m || d !== picked.d) setPicked({ m, d });
  };
  const onKey = (e: KeyboardEvent) => {
    const move = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key];
    if (!move) return;
    e.preventDefault();
    const m = Math.min(12, Math.max(1, picked.m + move[0]));
    const d = Math.min(daysInMonth(year, m), Math.max(1, picked.d + move[1]));
    setPicked({ m, d });
  };

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const cells = [];
  cells.push(<span key="corner" />);
  for (let d = 1; d <= 31; d++)
    cells.push(
      <span key={`h${d}`} aria-hidden {...stylex.props(s.dayHead)}>
        {d === 1 || d % 5 === 0 ? d : ''}
      </span>,
    );
  cells.push(<span key="hr" {...stylex.props(s.monthRate)} />);
  for (let m = 1; m <= 12; m++) {
    const isNow = inYear && now.getMonth() + 1 === m;
    cells.push(
      <span key={`m${m}`} aria-hidden {...stylex.props(s.month, isNow && s.monthNow)}>
        {m}
      </span>,
    );
    const n = daysInMonth(year, m);
    for (let d = 1; d <= 31; d++) {
      if (d > n) {
        cells.push(<span key={`${m}-${d}`} {...stylex.props(s.cell, s.gone)} />);
        continue;
      }
      const k = dayKey(year, m, d);
      const st = days[k];
      const isPicked = picked.m === m && picked.d === d;
      cells.push(
        <span
          key={k}
          data-m={m}
          data-d={d}
          {...stylex.props(s.cell, !st.written && s.blank, k > todayKey && s.future, k === todayKey && s.today, isPicked && s.picked)}
          style={{ ...bg(st.written), animationDelay: `${m * 40 + d * 9}ms` }}
        >
          {st.written > 0 && <span {...stylex.props(s.fill)} style={{ height: `${(st.done / st.written) * 100}%` }} />}
        </span>,
      );
    }
    const mo = months[m - 1];
    cells.push(
      <span key={`r${m}`} aria-hidden {...stylex.props(s.monthRate)}>
        {mo.written ? `${pct(mo.done, mo.written)}%` : ''}
      </span>,
    );
  }

  const date = new Date(year, picked.m - 1, picked.d);
  return (
    <div {...stylex.props(s.root)}>
      <div {...stylex.props(s.stats)}>
        {[
          ['적은 날', total.active, '일'],
          ['할 일', total.written, '개'],
          ['완료', total.done, '개'],
          ['완료율', pct(total.done, total.written), '%'],
        ].map(([label, n, unit]) => (
          <div key={label} {...stylex.props(s.stat)}>
            <span {...stylex.props(ui.label)}>{label}</span>
            <span {...stylex.props(s.statNum)}>
              {n}
              <span {...stylex.props(s.statUnit)}>{unit}</span>
            </span>
          </div>
        ))}
      </div>

      <div
        role="application"
        tabIndex={0}
        aria-roledescription="할 일 히트맵"
        aria-label={`${year}년 날짜별 할 일. 화살표로 날짜를 옮기면 아래에 그날의 할 일 수와 완료 수가 보입니다`}
        onKeyDown={onKey}
        onPointerDown={pickAt}
        onPointerMove={(e) => {
          // 마우스는 올리기만 해도, 손가락은 누른 채로 훑으면 바뀐다
          if (e.pointerType === 'mouse' || e.buttons) pickAt(e);
        }}
        {...stylex.props(s.map)}
      >
        {cells}
      </div>

      <div aria-live="polite" key={pk} {...stylex.props(s.detail, s.detailIn)}>
        <div {...stylex.props(s.detailDate)}>
          <span {...stylex.props(s.detailDay)}>
            {picked.m}월 {picked.d}일
          </span>
          <span {...stylex.props(s.detailWd)}>
            {WEEKDAYS[date.getDay()]}
            {pk === todayKey ? ' · 오늘' : ''}
          </span>
        </div>
        <div {...stylex.props(s.detailMain)}>
          <span {...stylex.props(s.detailText)}>
            {ps.written ? (
              <>
                할 일 <span {...stylex.props(s.strong)}>{ps.written}개</span> 중 <span {...stylex.props(s.strong)}>{ps.done}개</span> 완료
              </>
            ) : pk > todayKey ? (
              '아직 오지 않은 날'
            ) : (
              '적은 할 일이 없는 날'
            )}
          </span>
          <span aria-hidden {...stylex.props(s.bar)}>
            <span {...stylex.props(s.barFill)} style={{ width: `${pRate * 100}%` }} />
          </span>
        </div>
        <span aria-hidden {...stylex.props(s.pct)}>{ps.written ? `${Math.round(pRate * 100)}%` : '–'}</span>
      </div>

      <div aria-hidden {...stylex.props(s.legend)}>
        <span {...stylex.props(s.keys)}>
          <span {...stylex.props(s.keyText)}>적은 개수</span>
          {[1, 3, 5, 8].map((n) => (
            <span key={n} {...stylex.props(s.keyCell)} style={bg(n)} />
          ))}
        </span>
        <span {...stylex.props(s.keys)}>
          <span {...stylex.props(s.keyText)}>완료 비율</span>
          {[0.25, 0.5, 0.75, 1].map((r) => (
            <span key={r} {...stylex.props(s.keyCell)} style={bg(3)}>
              <span {...stylex.props(s.fill)} style={{ height: `${r * 100}%` }} />
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
