import type { DayEntry, DayEvent } from '../lib/store';
import { parseDayKey } from '../lib/time';

/** from 에서 to 까지 남은 날 수 (지났으면 음수). 서머타임 경계에서도 하루 단위로 떨어지게 반올림한다 */
export const daysBetween = (from: string, to: string) =>
  Math.round((parseDayKey(to).getTime() - parseDayKey(from).getTime()) / 86400000);

/** 디데이 표기: 당일 'D-DAY', 남았으면 'D-20', 지났으면 'D+3' */
export function ddayLabel(from: string, to: string): string {
  const n = daysBetween(from, to);
  return n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : `D+${-n}`;
}

export type UpcomingEvent = DayEvent & { date: string; label: string };

/** from 당일을 포함해 그 뒤에 있는 일정을 가까운 날부터 */
export function upcomingEvents(days: Record<string, DayEntry>, from: string): UpcomingEvent[] {
  const out: UpcomingEvent[] = [];
  for (const date of Object.keys(days).filter((k) => k >= from).sort()) {
    for (const e of days[date].events ?? []) out.push({ ...e, date, label: ddayLabel(from, date) });
  }
  return out;
}

/** D-Day 칸에 적는 한 줄 */
export const ddayLine = (ev: UpcomingEvent) => `${ev.label} ${ev.title}`;

/** D-Day 칸에 이미 그 줄이 적혀 있는지 */
export const hasDdayLine = (value: string, line: string) => value.split('\n').some((l) => l.trim() === line);

/** D-Day 칸에 한 줄을 덧붙인다. 이미 있으면 그대로, 비어 있으면 그 줄만 */
export function appendDdayLine(value: string, line: string): string {
  if (hasDdayLine(value, line)) return value;
  return value.trim() ? `${value.trimEnd()}\n${line}` : line;
}
