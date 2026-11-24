import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { getMonthMotto, updateMonthMotto, useDB } from '../lib/store';
import { color, dur, ease, radius } from '../tokens.stylex';

const LINE = 25;

const s = stylex.create({
  // 큰 숫자 바로 아래에 놓이는 그 달의 제목. 테두리도 바탕도 없고, 쓰는 동안에만 옅은 잉크가 깔린다
  wrap: {
    marginInline: -4,
    paddingBlock: 4,
    paddingInline: 10,
    borderRadius: radius.control,
    backgroundColor: 'transparent',
    transitionProperty: 'background-color',
    transitionDuration: dur.quick,
    transitionTimingFunction: ease.out,
  },
  wrapOn: { backgroundColor: color.wash },
  field: {
    display: 'block',
    width: '100%',
    height: LINE * 2,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    lineHeight: `${LINE}px`,
    overflow: 'hidden',
    '::placeholder': { color: color.inkFaint },
  },
});

/** 달력 위쪽, 큰 숫자 아래에 적는 이달의 한 문장 (두 줄) */
export function MonthMotto({ year, month }: { year: number; month: number }) {
  const db = useDB();
  const [on, setOn] = useState(false);
  const value = getMonthMotto(db, year, month);

  return (
    <div {...stylex.props(s.wrap, on && s.wrapOn)}>
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
