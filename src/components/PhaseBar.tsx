import * as stylex from '@stylexjs/stylex';
import { useSyncExternalStore } from 'react';
import { atmosphere, atmosphereSnapshot, PHASES, phaseOf, setPreview, subscribeAtmosphere } from '../lib/atmosphere';
import { now } from '../lib/time';
import { color, dur, ease, radius, type } from '../tokens.stylex';

const s = stylex.create({
  bar: { display: 'flex', alignItems: 'center', gap: 2 },
  item: {
    position: 'relative',
    height: 32,
    paddingInline: 8,
    borderRadius: radius.pill,
    fontSize: type.small,
    fontWeight: 500,
    color: color.inkSoft,
    transitionProperty: 'color, background-color',
    transitionDuration: dur.quick,
    transitionTimingFunction: ease.out,
    backgroundColor: { default: 'transparent', ':hover': color.wash },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: 1,
  },
  shown: { color: color.ink, fontWeight: 800 },
  // 실제 지금 시간대를 가리키는 점 (미리보기 중에도 남는다)
  nowDot: {
    position: 'absolute',
    left: '50%',
    bottom: 2,
    width: 4,
    height: 4,
    marginLeft: -2,
    borderRadius: '50%',
    backgroundColor: color.ink,
  },
});

/** 하루의 여섯 시간대. 누르면 그 시간대의 화면을 잠깐 미리 본다. */
export function PhaseBar() {
  useSyncExternalStore(subscribeAtmosphere, atmosphereSnapshot);
  const d = now();
  const real = phaseOf(d.getHours() + d.getMinutes() / 60).id;
  const shown = phaseOf(atmosphere.preview ?? atmosphere.hour).id;
  return (
    <nav aria-label="시간대 미리보기" {...stylex.props(s.bar)}>
      {PHASES.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={shown === p.id}
          title={p.id === real ? '지금 시간대' : `${p.ko} 화면 미리보기`}
          onClick={() => setPreview(p.id === real ? null : p.show)}
          {...stylex.props(s.item, shown === p.id && s.shown)}
        >
          {p.ko}
          {p.id === real && <span aria-hidden {...stylex.props(s.nowDot)} />}
        </button>
      ))}
    </nav>
  );
}
