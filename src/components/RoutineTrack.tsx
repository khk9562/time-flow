import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import type { RoutineStats } from '../lib/store';
import { dayKey } from '../lib/time';
import { color, ease, type } from '../tokens.stylex';
import { ui } from './ui';

const grow = stylex.keyframes({
  from: { opacity: 0, transform: 'scaleY(0)' },
  to: { opacity: 1, transform: 'scaleY(1)' },
});
const fill = stylex.keyframes({
  from: { transform: 'scaleX(0)' },
  to: { transform: 'scaleX(1)' },
});
const fade = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(6px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

const BAR_H = 40;

const s = stylex.create({
  root: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 },
  head: { display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', rowGap: 8 },
  big: { display: 'flex', alignItems: 'baseline', gap: 4, lineHeight: 0.9 },
  num: { fontSize: 46, fontWeight: 900, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' },
  unit: { fontSize: type.body, fontWeight: 700, color: color.inkSoft },
  facts: { display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 2, minWidth: 0 },
  fact: { fontSize: type.small, color: color.inkSoft, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  factStrong: { color: color.ink, fontWeight: 700 },
  streak: {
    marginLeft: 'auto',
    alignSelf: 'flex-end',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingInline: 12,
    borderRadius: 999,
    fontSize: type.small,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    backgroundColor: color.ink,
    color: color.inverse,
    animationName: fade,
    animationDuration: '600ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
    animationDelay: '500ms',
  },
  rate: { display: 'flex', alignItems: 'center', gap: 10 },
  track: { position: 'relative', flexGrow: 1, height: 4, borderRadius: 999, backgroundColor: color.wash, overflow: 'hidden' },
  trackFill: {
    position: 'absolute',
    inset: 0,
    borderRadius: 999,
    backgroundColor: color.ink,
    transformOrigin: '0 50%',
    animationName: fill,
    animationDuration: '1100ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
    animationDelay: '200ms',
  },
  pct: { fontSize: type.small, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' },
  // 시작한 날부터 오늘까지 하루 하나의 막대. 한 날은 높이 솟고, 쉰 날은 바닥에 짧은 눈금만 남는다
  strip: { position: 'relative', display: 'flex', alignItems: 'flex-end', height: BAR_H, width: '100%' },
  slot: { position: 'relative', flexGrow: 1, flexBasis: 0, minWidth: 0, maxWidth: 16, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  bar: {
    width: '100%',
    borderRadius: 2,
    transformOrigin: '50% 100%',
    animationName: grow,
    animationDuration: '520ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
  },
  done: { height: '100%', backgroundColor: color.ink },
  planned: { height: '38%', boxShadow: `inset 0 0 0 1px ${color.lineStrong}` },
  rest: { height: 3, backgroundColor: color.line },
  todayMark: {
    position: 'absolute',
    bottom: -9,
    left: '50%',
    width: 4,
    height: 4,
    marginLeft: -2,
    borderRadius: '50%',
    backgroundColor: color.ink,
  },
  months: { position: 'relative', height: 14, marginTop: 4 },
  monthTick: {
    position: 'absolute',
    top: 0,
    fontSize: 10.5,
    fontWeight: 600,
    color: color.inkFaint,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    paddingLeft: 4,
    borderLeftWidth: 1,
    borderLeftStyle: 'solid',
    borderLeftColor: color.line,
    lineHeight: '14px',
  },
  axis: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  legend: { display: 'flex', alignItems: 'center', gap: 12 },
  key: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: color.inkSoft },
  dot: { display: 'inline-block', width: 4, height: 11, borderRadius: 1.5 },
  dotPlanned: { height: 6 },
  empty: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
    paddingBlock: 10,
    paddingInline: 12,
    borderRadius: 10,
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

const parse = (k: string) => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
const keyOf = (d: Date) => dayKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
const DAY = 86400000;
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);

/** 0에서 목표 숫자까지 빠르게 세어 올라간다 */
function useCountUp(target: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const ms = Math.min(1200, 500 + target * 18);
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

type Props = { stats: RoutineStats; today: string; title: string };

export function RoutineTrack({ stats, today, title }: Props) {
  const shown = useCountUp(stats.count);

  if (!stats.first) {
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

  const start = parse(stats.first);
  const end = parse(today);
  const span = daysBetween(start, end) + 1; // 시작한 날부터 오늘까지, 오늘 포함
  const rate = stats.count / span;
  const thisYear = end.getFullYear();
  const fmt = (d: Date) =>
    `${d.getFullYear() !== thisYear ? `${d.getFullYear()}년 ` : ''}${d.getMonth() + 1}월 ${d.getDate()}일`;

  // 날이 많을수록 막대가 가늘어지고, 순서대로 솟아오르는 시간은 1초 안팎으로 맞춘다
  const step = Math.min(28, 900 / span);
  const gap = span > 160 ? 1 : span > 60 ? 2 : 3;
  const bars = [];
  const ticks = [];
  for (let i = 0; i < span; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const k = keyOf(d);
    const state = stats.done.has(k) ? s.done : stats.planned.has(k) ? s.planned : s.rest;
    bars.push(
      <span key={k} title={`${fmt(d)}${stats.done.has(k) ? ' · 했음' : stats.planned.has(k) ? ' · 계획만' : ''}`} {...stylex.props(s.slot)} style={{ marginRight: i < span - 1 ? gap : 0 }}>
        <span {...stylex.props(s.bar, state)} style={{ animationDelay: `${160 + i * step}ms` }} />
        {k === today && <span {...stylex.props(s.todayMark)} />}
      </span>,
    );
    // 달이 바뀌는 자리에 작은 눈금. 너무 붙으면 건너뛴다
    if ((i === 0 || d.getDate() === 1) && (i === 0 || i / span < 0.92)) {
      ticks.push(
        <span key={k} {...stylex.props(s.monthTick)} style={{ left: `${(i / span) * 100}%` }}>
          {i === 0 ? `${d.getMonth() + 1}.${d.getDate()}` : `${d.getMonth() + 1}월`}
        </span>,
      );
    }
  }
  // 막대 폭이 최대치에 걸리면 띠가 오른쪽에서 끝나므로, 눈금 위치도 실제 막대 길이에 맞춘다
  const stripWidth = span * 16 + (span - 1) * gap;

  return (
    <div
      role="group"
      aria-label={`${title}: ${fmt(start)}에 시작해 ${span}일 동안 ${stats.count}번 했습니다${stats.streak > 1 ? `, ${stats.streak}일 연속` : ''}`}
      {...stylex.props(s.root)}
    >
      <div {...stylex.props(s.head)}>
        <div aria-hidden {...stylex.props(s.big)}>
          <span {...stylex.props(s.num)}>{shown}</span>
          <span {...stylex.props(s.unit)}>번</span>
        </div>
        <div aria-hidden {...stylex.props(s.facts)}>
          <span {...stylex.props(s.fact)}>
            <span {...stylex.props(s.factStrong)}>{fmt(start)}</span> 처음 시작
          </span>
          <span {...stylex.props(s.fact)}>
            오늘로 <span {...stylex.props(s.factStrong)}>{span}일째</span>
          </span>
        </div>
        {stats.streak > 1 && (
          <span aria-hidden {...stylex.props(s.streak)}>
            <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
              <path d="M5 0c.6 2.2 4 3.6 4 7a4 4 0 01-8 0c0-1.6.9-2.6 1.6-3.2.1 1.2.7 1.9 1.4 2.2C3.6 4.3 4.3 2 5 0z" />
            </svg>
            {stats.streak}일 연속
          </span>
        )}
      </div>

      <div aria-hidden {...stylex.props(s.rate)}>
        <span {...stylex.props(s.track)}>
          <span {...stylex.props(s.trackFill)} style={{ right: `${(1 - Math.min(1, rate)) * 100}%` }} />
        </span>
        <span {...stylex.props(s.pct)}>{Math.round(rate * 100)}%</span>
      </div>

      <div aria-hidden style={{ maxWidth: stripWidth }}>
        <div {...stylex.props(s.strip)}>{bars}</div>
        <div {...stylex.props(s.months)}>{ticks}</div>
      </div>

      <div aria-hidden {...stylex.props(s.axis)}>
        <span {...stylex.props(ui.label)}>{span}일의 리듬</span>
        <span {...stylex.props(s.legend)}>
          <span {...stylex.props(s.key)}>
            <span {...stylex.props(s.done, s.dot)} />
            했음
          </span>
          <span {...stylex.props(s.key)}>
            <span {...stylex.props(s.planned, s.dot, s.dotPlanned)} />
            계획만
          </span>
        </span>
      </div>
    </div>
  );
}
