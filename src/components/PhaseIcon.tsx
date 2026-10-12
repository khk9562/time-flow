import * as stylex from '@stylexjs/stylex';
import type { PhaseId } from '../lib/atmosphere';

const s = stylex.create({
  icon: { display: 'block', width: 18, height: 18, flexShrink: 0 },
});

// 해의 빛살: 가운데에서 r0 부터 r1 까지 n 줄
const rays = (n: number, r0: number, r1: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return `M${(9 + c * r0).toFixed(2)} ${(9 + s * r0).toFixed(2)}L${(9 + c * r1).toFixed(2)} ${(9 + s * r1).toFixed(2)}`;
  }).join('');

/** 시간대마다 하나의 그림: 새벽=별, 아침=해, 낮=쨍쨍한 해, 오후=기우는 해, 저녁=초승달, 밤=달과 별 */
export function PhaseIcon({ id }: { id: PhaseId }) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...stylex.props(s.icon)}
    >
      {id === 'dawn' && <path d="M9 2.2C9.5 6.4 11.6 8.5 15.8 9 11.6 9.5 9.5 11.6 9 15.8 8.5 11.6 6.4 9.5 2.2 9 6.4 8.5 8.5 6.4 9 2.2Z" />}
      {id === 'morning' && (
        <>
          <circle cx="9" cy="9" r="3.3" />
          <path d={rays(8, 5.6, 7.2)} />
        </>
      )}
      {id === 'day' && (
        <>
          <circle cx="9" cy="9" r="3.6" fill="currentColor" />
          <path d={rays(8, 5.4, 8.4)} />
        </>
      )}
      {id === 'afternoon' && <path d="M2 13.2h14M5 13.2a4 4 0 0 1 8 0M9 4.4v1.6M3.9 7.4l1.1 1.1M14.1 7.4 13 8.5" />}
      {id === 'evening' && <path d="M11.6 2.8a6.4 6.4 0 1 0 3.9 9.4 5 5 0 0 1-3.9-9.4Z" />}
      {id === 'night' && (
        <>
          <path d="M10.4 3.4a5.9 5.9 0 1 0 4.3 8.4 4.6 4.6 0 0 1-4.3-8.4Z" fill="currentColor" />
          <path d="M14.2 2.4c.15 1.15.65 1.65 1.8 1.8-1.15.15-1.65.65-1.8 1.8-.15-1.15-.65-1.65-1.8-1.8 1.15-.15 1.65-.65 1.8-1.8Z" strokeWidth="1" />
        </>
      )}
    </svg>
  );
}
