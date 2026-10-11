import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { atmosphere, atmosphereSnapshot, phaseOf, subscribeAtmosphere } from '../lib/atmosphere';
import { daysLeftInYear, now, pad2, useSecond, WEEKDAYS, yearProgress } from '../lib/time';
import { color } from '../tokens.stylex';
import { FlowBar } from './FlowBar';
import { RollChar, RollText } from './Roll';

const s = stylex.create({
  area: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 0,
    containerType: 'size',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 2026 · 게이지 · 시계가 같은 폭을 공유하는 한 덩어리. 안쪽 치수는 전부 이 폭의 비율(cqi)이다.
  block: {
    width: 'min(88cqi, 110cqb, 1080px)',
    containerType: 'inline-size',
    display: 'flex',
    flexDirection: 'column',
  },
  year: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '37.5cqi',
    fontWeight: 900,
    lineHeight: 0.8,
    letterSpacing: '-0.02em',
    marginBottom: '4.4cqi',
  },
  gauge: { height: 'max(44px, 8.4cqi)' },
  meta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 'max(4px, 0.8cqi)',
    fontSize: 'max(11px, 2.45cqi)',
    fontWeight: 500,
    color: color.inkSoft,
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },
  pct: { color: color.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  pctCh: { display: 'inline-block', width: '0.66em', textAlign: 'center' },
  pctDot: { display: 'inline-block', width: '0.3em', textAlign: 'center' },
  date: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: '4.2cqi',
    fontSize: '6.6cqi',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
  },
  dateGap: { display: 'inline-block', width: '0.32em' },
  phase: {
    fontSize: 'max(11px, 2.45cqi)',
    fontWeight: 600,
    letterSpacing: '0.2em',
    color: color.inkSoft,
  },
  clock: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: '1.6cqi',
    fontSize: '21.5cqi',
    fontWeight: 200,
    lineHeight: 0.92,
    fontVariantNumeric: 'tabular-nums',
  },
  group: { display: 'inline-flex' },
  sec: { color: color.inkSoft },
  colon: { color: color.inkFaint, fontWeight: 100 },
});

/** 올해 진행률. 소수 여섯째 자리까지 보여줘서 숫자가 계속 흘러간다. */
function LivePercent() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = '';
    const tick = () => {
      const text = (yearProgress(now()) * 100).toFixed(6).padStart(9, '0');
      if (text !== last && ref.current) {
        const spans = ref.current.children;
        for (let i = 0; i < text.length; i++) {
          if (text[i] !== last[i] && spans[i]) spans[i].textContent = text[i];
        }
        last = text;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span ref={ref} {...stylex.props(s.pct)}>
      {'00.000000'.split('').map((c, i) => (
        <span key={i} {...stylex.props(c === '.' ? s.pctDot : s.pctCh)}>
          {c}
        </span>
      ))}
    </span>
  );
}

export function Hero() {
  const d = useSecond();
  useSyncExternalStore(subscribeAtmosphere, atmosphereSnapshot);
  const phase = phaseOf(atmosphere.hour);
  const year = d.getFullYear();
  const left = daysLeftInYear(d);

  return (
    <section {...stylex.props(s.area)}>
      <div {...stylex.props(s.block)}>
        <h1 {...stylex.props(s.year)} aria-label={`${year}년`}>
          <RollText text={String(year)} width="auto" />
        </h1>

        <div
          {...stylex.props(s.gauge)}
          role="img"
          aria-label={`올해의 ${(yearProgress(d) * 100).toFixed(1)}퍼센트가 지났습니다`}
        >
          <FlowBar progress={() => yearProgress(now())} months={{ year }} />
        </div>
        <div {...stylex.props(s.meta)}>
          <span>
            <LivePercent />% 흘러감
          </span>
          <span>{left === 0 ? '올해의 마지막 날' : `${left}일 남음`}</span>
        </div>

        <div {...stylex.props(s.date)}>
          <time dateTime={d.toISOString().slice(0, 10)}>
            <RollText text={String(d.getMonth() + 1)} width="auto" />월
            <span {...stylex.props(s.dateGap)} />
            <RollText text={String(d.getDate())} width="auto" />일
            <span {...stylex.props(s.dateGap)} />
            {WEEKDAYS[d.getDay()]}
          </time>
          <span {...stylex.props(s.phase)}>
            {phase.ko} · {phase.en}
          </span>
        </div>

        <div {...stylex.props(s.clock)} role="timer" aria-label={`${d.getHours()}시 ${d.getMinutes()}분`}>
          <span {...stylex.props(s.group)}>
            <RollText text={pad2(d.getHours())} />
          </span>
          <span {...stylex.props(s.colon)}>
            <RollChar ch=":" width="narrow" />
          </span>
          <span {...stylex.props(s.group)}>
            <RollText text={pad2(d.getMinutes())} />
          </span>
          <span {...stylex.props(s.colon)}>
            <RollChar ch=":" width="narrow" />
          </span>
          <span {...stylex.props(s.group, s.sec)}>
            <RollText text={pad2(d.getSeconds())} />
          </span>
        </div>
      </div>
    </section>
  );
}
