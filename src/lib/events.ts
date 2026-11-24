import type { DayEntry, DayEvent } from './store';
import { parseDayKey } from './time';

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
