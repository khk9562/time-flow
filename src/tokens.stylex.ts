import * as stylex from '@stylexjs/stylex';

// 색은 전부 --ink-rgb / --paper-rgb 두 축에서 파생된다 (시간대에 따라 값만 바뀐다).
export const color = stylex.defineVars({
  bg: 'rgb(var(--paper-rgb))',
  surface: 'rgb(var(--surface-rgb))',
  ink: 'rgb(var(--ink-rgb))',
  inkSoft: 'rgb(var(--ink-rgb) / 0.66)',
  inkFaint: 'rgb(var(--ink-rgb) / 0.44)',
  line: 'rgb(var(--ink-rgb) / 0.18)',
  lineStrong: 'rgb(var(--ink-rgb) / 0.62)',
  wash: 'rgb(var(--ink-rgb) / 0.07)',
  washStrong: 'rgb(var(--ink-rgb) / 0.13)',
  inverse: 'rgb(var(--paper-rgb))',
});

export const ease = stylex.defineVars({
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  inOut: 'cubic-bezier(0.72, 0, 0.18, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
});

export const dur = stylex.defineVars({
  tap: '140ms',
  quick: '260ms',
  move: '520ms',
  stage: '880ms',
});

export const type = stylex.defineVars({
  label: '10.5px',
  small: '12.5px',
  body: '15px',
  title: '22px',
  labelTracking: '0.16em',
});

export const radius = stylex.defineVars({
  paper: '3px',
  control: '10px',
  pill: '999px',
});
