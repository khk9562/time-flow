import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { getMonthMotto, updateMonthMotto, useDB } from '../lib/store';
import { color, dur, ease, radius } from '../tokens.stylex';

/**
 * 달력 위, 흐름 막대 아래에 적는 이달의 한 문장 (두 줄).
 * 시안 비교용: 주소에 ?memo=1..4 를 붙이면 생김새가 바뀐다 (1 줄 노트 / 2 인용 막대 / 3 쪽지 / 4 가운데 따옴표).
 */
export type MottoLook = 1 | 2 | 3 | 4;
const LINE = 28;

const s = stylex.create({
  wrap: { position: 'relative', marginBottom: 16 },
  field: {
    display: 'block',
    width: '100%',
    height: LINE * 2,
    fontSize: 16,
    lineHeight: `${LINE}px`,
    overflow: 'hidden',
    '::placeholder': { color: color.inkFaint },
  },

  // 1. 줄 노트 — 공책처럼 두 줄이 그어져 있고, 쓰는 동안 아랫줄이 진하게 그어진다
  ruled: {
    fontWeight: 600,
    backgroundImage: `linear-gradient(to bottom, transparent ${LINE - 1}px, ${color.line} ${LINE - 1}px)`,
    backgroundSize: `100% ${LINE}px`,
  },
  stroke: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1.5,
    backgroundColor: color.ink,
    transformOrigin: 'left',
    transform: 'scaleX(0)',
    transitionProperty: 'transform',
    transitionDuration: dur.move,
    transitionTimingFunction: ease.out,
    pointerEvents: 'none',
  },
  strokeOn: { transform: 'scaleX(1)' },

  // 2. 인용 막대 — 왼쪽에 굵은 잉크 막대, 글자는 굵게
  quoteWrap: { paddingLeft: 14 },
  quote: { fontSize: 17, fontWeight: 700 },
  rod: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 2.5,
    borderRadius: 2,
    backgroundColor: color.inkFaint,
    transformOrigin: 'center',
    transitionProperty: 'background-color, transform',
    transitionDuration: dur.quick,
    transitionTimingFunction: ease.out,
  },
  rodOn: { backgroundColor: color.ink, transform: 'scaleY(1.14)' },

  // 3. 쪽지 — 옅은 잉크가 깔린 종이 조각
  slipWrap: {
    paddingBlock: 8,
    paddingInline: 14,
    borderRadius: radius.control,
    backgroundColor: color.wash,
    boxShadow: `inset 0 0 0 1px transparent`,
    transitionProperty: 'background-color, box-shadow',
    transitionDuration: dur.quick,
    transitionTimingFunction: ease.out,
  },
  slipOn: { backgroundColor: 'transparent', boxShadow: `inset 0 0 0 1.5px ${color.ink}` },
  slip: { fontWeight: 500 },

  // 4. 가운데 따옴표 — 큰 따옴표 사이에 가운데로 놓인 문장
  centerWrap: { paddingInline: 30 },
  center: { textAlign: 'center', fontWeight: 600 },
  mark: {
    position: 'absolute',
    fontSize: 40,
    fontWeight: 900,
    lineHeight: 1,
    color: color.inkFaint,
    transitionProperty: 'color, transform',
    transitionDuration: dur.quick,
    transitionTimingFunction: ease.spring,
    pointerEvents: 'none',
  },
  markOpen: { left: 0, top: -2 },
  markClose: { right: 0, bottom: -22 },
  markOn: { color: color.ink, transform: 'scale(1.12)' },
});

export function MonthMotto({ year, month, look }: { year: number; month: number; look: MottoLook }) {
  const db = useDB();
  const [on, setOn] = useState(false);
  const value = getMonthMotto(db, year, month);

  return (
    <div {...stylex.props(s.wrap, look === 2 && s.quoteWrap, look === 3 && s.slipWrap, look === 3 && on && s.slipOn, look === 4 && s.centerWrap)}>
      {look === 2 && <span aria-hidden {...stylex.props(s.rod, on && s.rodOn)} />}
      {look === 4 && (
        <span aria-hidden {...stylex.props(s.mark, s.markOpen, on && s.markOn)}>
          “
        </span>
      )}
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
        {...stylex.props(s.field, look === 1 && s.ruled, look === 2 && s.quote, look === 3 && s.slip, look === 4 && s.center)}
      />
      {look === 1 && <span aria-hidden {...stylex.props(s.stroke, on && s.strokeOn)} />}
      {look === 4 && (
        <span aria-hidden {...stylex.props(s.mark, s.markClose, on && s.markOn)}>
          ”
        </span>
      )}
    </div>
  );
}
