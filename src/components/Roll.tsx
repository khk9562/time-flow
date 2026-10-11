import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { ease } from '../tokens.stylex';

const rollIn = stylex.keyframes({
  from: { transform: 'translateY(0.4em)', opacity: 0, filter: 'blur(0.08em)' },
  to: { transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' },
});
const rollOut = stylex.keyframes({
  from: { transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' },
  to: { transform: 'translateY(-0.4em)', opacity: 0, filter: 'blur(0.08em)' },
});

const s = stylex.create({
  slot: { position: 'relative', display: 'inline-block', textAlign: 'center' },
  fixed: { width: '0.66em' },
  narrow: { width: '0.3em' },
  in: {
    display: 'block',
    animationName: rollIn,
    animationDuration: '560ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
  },
  out: {
    position: 'absolute',
    inset: 0,
    animationName: rollOut,
    animationDuration: '420ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
  },
});

/** 값이 바뀌면 이전 글자가 위로 빠지고 새 글자가 아래에서 올라온다. */
export function RollChar({ ch, width = 'fixed' }: { ch: string; width?: 'fixed' | 'narrow' | 'auto' }) {
  const [st, setSt] = useState({ cur: ch, prev: null as string | null, n: 0 });
  if (ch !== st.cur) setSt({ cur: ch, prev: st.cur, n: st.n + 1 });
  return (
    <span {...stylex.props(s.slot, width === 'fixed' && s.fixed, width === 'narrow' && s.narrow)}>
      {st.prev !== null && (
        <span key={`o${st.n}`} aria-hidden {...stylex.props(s.out)}>
          {st.prev}
        </span>
      )}
      <span key={`i${st.n}`} {...stylex.props(s.in)}>
        {st.cur}
      </span>
    </span>
  );
}

export function RollText({ text, width }: { text: string; width?: 'fixed' | 'narrow' | 'auto' }) {
  return (
    <>
      {text.split('').map((c, i) => (
        <RollChar key={i} ch={c} width={width} />
      ))}
    </>
  );
}
