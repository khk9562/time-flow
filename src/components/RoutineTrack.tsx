import * as stylex from '@stylexjs/stylex';
import type { Goal, RoutineStats } from '../lib/store';
import { dayKey, WEEKDAYS_SHORT } from '../lib/time';
import { color, ease, type } from '../tokens.stylex';
import { ui } from './ui';

/*
 * 목표 루틴 시각화
 *  - RoutineOverview: 모든 루틴을 같은 날짜 축(최근 4주)에 겹쳐, 언제 무엇을 했는지 한눈에 본다.
 *  - RoutineTrack: 루틴 하나의 "지금" — 마지막으로 한 지 며칠인지, 이번 주 7일, 시작부터의 합계.
 */

const pop = stylex.keyframes({
  from: { opacity: 0, transform: 'scale(0.2)' },
  to: { opacity: 1, transform: 'scale(1)' },
});
const fade = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(6px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});
const pulse = stylex.keyframes({
  '0%': { boxShadow: '0 0 0 0 rgb(var(--ink-rgb) / 0.35)' },
  '70%': { boxShadow: '0 0 0 7px rgb(var(--ink-rgb) / 0)' },
  '100%': { boxShadow: '0 0 0 0 rgb(var(--ink-rgb) / 0)' },
});

const PHONE = '@media (max-width: 560px)';
const WEEKS = 4;

const DAY = 86400000;
const parse = (k: string) => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
const keyOf = (d: Date) => dayKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
const no = (i: number) => String(i + 1).padStart(2, '0');

// ── 모든 루틴, 최근 4주 ─────────────────────────────────────────────────────

const o = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: { default: '16px 16px 14px', [PHONE]: '14px 12px 12px' },
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: color.wash,
  },
  top: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4, columnGap: 10 },
  hint: { fontSize: { default: 11, [PHONE]: 10.5 }, color: color.inkSoft },
  grid: {
    display: 'grid',
    gridTemplateColumns: {
      default: `minmax(70px, 120px) repeat(${WEEKS * 7}, minmax(0, 1fr)) 30px`,
      [PHONE]: `22px repeat(${WEEKS * 7}, minmax(0, 1fr)) 22px`,
    },
    columnGap: 2,
    rowGap: 6,
    alignItems: 'center',
  },
  weekHead: { fontSize: 9.5, fontWeight: 700, color: color.inkFaint, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'visible' },
  todayHead: { fontSize: 9.5, fontWeight: 800, color: color.ink, textAlign: 'center', whiteSpace: 'nowrap', justifySelf: 'center' },
  name: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: type.small, fontWeight: 600 },
  nameNo: { fontSize: 11, fontWeight: 300, color: color.inkSoft, fontVariantNumeric: 'tabular-nums' },
  nameText: { display: { default: 'block', [PHONE]: 'none' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sum: { fontSize: 11, fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  slot: { position: 'relative', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  weekStart: { marginLeft: { default: 4, [PHONE]: 3 } },
  todayCol: { '::before': { content: '""', position: 'absolute', inset: '-4px -1px', borderRadius: 4, backgroundColor: color.washStrong } },
  mark: {
    position: 'relative',
    width: '100%',
    height: '100%',
    borderRadius: 3,
    animationName: pop,
    animationDuration: '420ms',
    animationTimingFunction: ease.spring,
    animationFillMode: 'both',
  },
  done: { backgroundColor: color.ink },
  planned: { boxShadow: `inset 0 0 0 1.5px ${color.lineStrong}` },
  rest: { width: '26%', height: '26%', borderRadius: '50%', backgroundColor: color.lineStrong, opacity: 0.5 },
  future: { width: '18%', height: '18%', borderRadius: '50%', backgroundColor: color.line },
});

/** index: 아래 목록에 붙은 번호와 맞추기 위한 원래 순서 */
export function RoutineOverview({ rows, today }: { rows: { goal: Goal; index: number; stats: RoutineStats }[]; today: string }) {
  const t = parse(today);
  // 이번 주 토요일에서 끝나는 4주 (일요일 시작, 달력과 같은 기준)
  const end = addDays(t, 6 - t.getDay());
  const start = addDays(end, -(WEEKS * 7 - 1));
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(start, i));

  const head = [<span key="corner" />];
  days.forEach((d, i) => {
    const k = keyOf(d);
    head.push(
      k === today ? (
        <span key={k} {...stylex.props(o.todayHead, d.getDay() === 0 && o.weekStart)}>오늘</span>
      ) : (
        <span key={k} {...stylex.props(o.weekHead, d.getDay() === 0 && o.weekStart)}>
          {d.getDay() === 0 && (i === 0 || d.getDate() <= 7) ? `${d.getMonth() + 1}.${d.getDate()}` : d.getDay() === 0 ? d.getDate() : ''}
        </span>
      ),
    );
  });
  head.push(<span key="sumHead" {...stylex.props(o.weekHead)} />);

  return (
    <div {...stylex.props(o.root)}>
      <div {...stylex.props(o.top)}>
        <span {...stylex.props(ui.label)}>최근 4주 한눈에</span>
        <span {...stylex.props(o.hint)}>칸 = 하루 · 채움 = 했음 · 테두리 = 계획만</span>
      </div>
      <div {...stylex.props(o.grid)}>
        {head}
        {rows.map(({ goal: g, index, stats: st }, gi) => {
          let inRange = 0;
          const row = days.map((d, di) => {
            const k = keyOf(d);
            const did = st.done.has(k);
            if (did) inRange++;
            const kind = k > today ? o.future : did ? o.done : st.planned.has(k) ? o.planned : o.rest;
            return (
              <span key={k} {...stylex.props(o.slot, d.getDay() === 0 && o.weekStart, k === today && o.todayCol)}>
                <span {...stylex.props(o.mark, kind)} style={{ animationDelay: `${200 + gi * 70 + di * 16}ms` }} />
              </span>
            );
          });
          return [
            <span key={`n${g.id}`} title={g.title} {...stylex.props(o.name)}>
              <span {...stylex.props(o.nameNo)}>{no(index)}</span>
              <span {...stylex.props(o.nameText)}>{g.title}</span>
            </span>,
            ...row,
            <span key={`s${g.id}`} aria-label={`최근 4주 ${inRange}번`} {...stylex.props(o.sum)}>
              {inRange}
            </span>,
          ];
        })}
      </div>
    </div>
  );
}

// ── 루틴 하나 ───────────────────────────────────────────────────────────────

const s = stylex.create({
  root: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 2 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', rowGap: 8 },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: type.body,
    fontWeight: 800,
    animationName: fade,
    animationDuration: '520ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
    animationDelay: '120ms',
  },
  statusSoft: { color: color.inkSoft, fontWeight: 700 },
  lamp: { width: 9, height: 9, borderRadius: '50%', backgroundColor: color.ink, flexShrink: 0 },
  lampWait: { backgroundColor: 'transparent', boxShadow: `inset 0 0 0 1.5px ${color.ink}`, animationName: pulse, animationDuration: '1.8s', animationIterationCount: 'infinite' },
  lampOff: { backgroundColor: color.line },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingInline: 10,
    borderRadius: 999,
    fontSize: type.small,
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    backgroundColor: color.ink,
    color: color.inverse,
    animationName: fade,
    animationDuration: '520ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
    animationDelay: '260ms',
  },
  week: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: { default: 8, [PHONE]: 6 }, maxWidth: 360 },
  wd: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 },
  dot: {
    width: { default: 30, [PHONE]: 32 },
    height: { default: 30, [PHONE]: 32 },
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: color.inverse,
    animationName: pop,
    animationDuration: '460ms',
    animationTimingFunction: ease.spring,
    animationFillMode: 'both',
  },
  dotDone: { backgroundColor: color.ink },
  dotPlanned: { boxShadow: `inset 0 0 0 1.5px ${color.lineStrong}` },
  dotMiss: { backgroundColor: color.wash },
  dotFuture: { boxShadow: `inset 0 0 0 1px ${color.line}`, opacity: 0.6 },
  dotToday: { outlineWidth: 1.5, outlineStyle: 'solid', outlineColor: color.ink, outlineOffset: 2.5 },
  wdLabel: { fontSize: 10.5, fontWeight: 600, color: color.inkFaint },
  wdToday: { color: color.ink, fontWeight: 800 },
  facts: { fontSize: type.small, color: color.inkSoft, fontVariantNumeric: 'tabular-nums', lineHeight: 1.6 },
  strong: { color: color.ink, fontWeight: 800 },
  empty: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
    paddingBlock: 10,
    paddingInline: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.line,
    fontSize: type.small,
    lineHeight: 1.5,
    color: color.inkSoft,
  },
  plus: {
    flexShrink: 0,
    width: 18,
    height: 18,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.lineStrong,
    color: color.ink,
  },
});

type Props = { stats: RoutineStats; today: string; title: string };

export function RoutineTrack({ stats, today, title }: Props) {
  if (!stats.first || !stats.last) {
    return (
      <div {...stylex.props(s.empty)}>
        <span aria-hidden {...stylex.props(s.plus)}>
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 1.5v7M1.5 5h7" />
          </svg>
        </span>
        <span>
          {stats.planned.size
            ? '할 일에 넣어 두었습니다. 체크하면 첫 기록이 여기에 남습니다.'
            : '하루 할 일 칸 오른쪽의 + 로 이 루틴을 채우고 체크하면 여기에 쌓입니다.'}
        </span>
      </div>
    );
  }

  const t = parse(today);
  const start = parse(stats.first);
  const span = daysBetween(start, t) + 1;
  const gap = daysBetween(parse(stats.last), t);
  const rate = Math.round((stats.count / span) * 100);
  const fmt = (d: Date) => `${d.getFullYear() !== t.getFullYear() ? `${d.getFullYear()}년 ` : ''}${d.getMonth() + 1}월 ${d.getDate()}일`;

  // 마지막으로 한 지 며칠인지가 가장 먼저 보인다: 쉬는 날이 길어질수록 다시 할 이유가 생긴다
  const status =
    gap === 0
      ? { text: '오늘 했어요', lamp: null, soft: false }
      : gap === 1
        ? { text: '어제 했어요 · 오늘도 이어 가요', lamp: s.lampWait, soft: false }
        : { text: `${gap}일째 쉬는 중`, lamp: s.lampWait, soft: false };

  const sunday = addDays(t, -t.getDay());
  const week = Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
  const weekCount = week.filter((d) => stats.done.has(keyOf(d))).length;

  return (
    <div
      role="group"
      aria-label={`${title}: ${status.text}. 이번 주 ${weekCount}번. ${fmt(start)}에 시작해 ${span}일 동안 ${stats.count}번`}
      {...stylex.props(s.root)}
    >
      <div aria-hidden {...stylex.props(s.statusRow)}>
        <span {...stylex.props(s.status, status.soft && s.statusSoft)}>
          <span {...stylex.props(s.lamp, status.lamp)} />
          {status.text}
        </span>
        {stats.streak > 1 && (
          <span {...stylex.props(s.chip)}>
            <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
              <path d="M5 0c.6 2.2 4 3.6 4 7a4 4 0 01-8 0c0-1.6.9-2.6 1.6-3.2.1 1.2.7 1.9 1.4 2.2C3.6 4.3 4.3 2 5 0z" />
            </svg>
            {stats.streak}일 연속
          </span>
        )}
      </div>

      <div aria-hidden {...stylex.props(s.week)}>
        {week.map((d, i) => {
          const k = keyOf(d);
          const kind = k > today ? s.dotFuture : stats.done.has(k) ? s.dotDone : stats.planned.has(k) ? s.dotPlanned : s.dotMiss;
          return (
            <span key={k} {...stylex.props(s.wd)}>
              <span {...stylex.props(s.dot, kind, k === today && s.dotToday)} style={{ animationDelay: `${180 + i * 50}ms` }}>
                {stats.done.has(k) && (
                  <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 9.4l3.3 3.3L14 5.6" />
                  </svg>
                )}
              </span>
              <span {...stylex.props(s.wdLabel, k === today && s.wdToday)}>{WEEKDAYS_SHORT[d.getDay()]}</span>
            </span>
          );
        })}
      </div>

      <p aria-hidden {...stylex.props(s.facts)}>
        이번 주 <span {...stylex.props(s.strong)}>{weekCount}번</span> · {fmt(start)} 시작 ·{' '}
        <span {...stylex.props(s.strong)}>{span}일</span> 동안 <span {...stylex.props(s.strong)}>{stats.count}번</span> ({rate}%)
      </p>
    </div>
  );
}
