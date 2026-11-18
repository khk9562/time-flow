import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { getMonthMotto, updateMonthMotto, useDB } from '../lib/store';
import { color, dur, ease, radius } from '../tokens.stylex';

const LINE = 28;

const s = stylex.create({
  // 옅은 잉크가 깔린 쪽지. 왼쪽에만 진한 선이 그어져 있다
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    paddingBlock: 8,
    paddingLeft: 17,
    paddingRight: 14,
    borderRadius: `0 ${radius.control} ${radius.control} 0`,
    backgroundColor: color.wash,
    transitionProperty: 'background-color',
    transitionDuration: dur.quick,
    transitionTimingFunction: ease.out,
  },
  wrapOn: { backgroundColor: color.washStrong },
  rod: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: color.lineStrong,
    transformOrigin: 'left',
    transitionProperty: 'background-color, transform',
    transitionDuration: dur.quick,
    transitionTimingFunction: ease.out,
  },
  rodOn: { backgroundColor: color.ink, transform: 'scaleX(1.5)' },
  field: {
    display: 'block',
    width: '100%',
    height: LINE * 2,
    fontSize: 16,
    fontWeight: 500,
    lineHeight: `${LINE}px`,
    overflow: 'hidden',
    '::placeholder': { color: color.inkFaint },
  },
});

/** 달력 아래에 적는 이달의 한 문장 (두 줄) */
export function MonthMotto({ year, month }: { year: number; month: number }) {
  const db = useDB();
  const [on, setOn] = useState(false);
  const value = getMonthMotto(db, year, month);

  return (
    <div {...stylex.props(s.wrap, on && s.wrapOn)}>
      <span aria-hidden {...stylex.props(s.rod, on && s.rodOn)} />
      <textarea
        rows={2}
        value={value}
        aria-label={`${month}월의 한 문장`}
        placeholder={'이번 달을 한 문장으로\n적는다면'}
        enterKeyHint="done"
        onFocus={() => setOn(true)}
        onBlur={() => setOn(false)}
        onChange={(e) => {
          const el = e.target;
          // 두 줄을 넘기는 입력은 받지 않는다 (지우는 것은 언제나 받는다)
          if (el.value.length > value.length && el.scrollHeight > el.clientHeight + 1) return;
          updateMonthMotto(year, month, el.value);
        }}
        {...stylex.props(s.field)}
      />
    </div>
  );
}
