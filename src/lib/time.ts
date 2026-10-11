import { useEffect, useState } from 'react';

// ?t=2026-12-31T23:59:50 처럼 주면 그 시각부터 흐르는 시계로 확인할 수 있다 (검증용).
const tParam = new URLSearchParams(location.search).get('t');
const parsed = tParam ? new Date(tParam).getTime() : NaN;
const offset = Number.isFinite(parsed) ? parsed - Date.now() : 0;

export const now = () => new Date(Date.now() + offset);

/** 초 경계에 맞춰 갱신되는 현재 시각 */
export function useSecond(): Date {
  const [d, setD] = useState(now);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      const n = now();
      setD(n);
      id = window.setTimeout(tick, 1000 - n.getMilliseconds() + 4);
    };
    id = window.setTimeout(tick, 1000 - now().getMilliseconds() + 4);
    return () => clearTimeout(id);
  }, []);
  return d;
}

/** 날짜·연도 경계를 따라가기 위한 느린 시계 (20초마다) */
export function useSlowNow(): Date {
  const [d, setD] = useState(now);
  useEffect(() => {
    const id = window.setInterval(() => setD(now()), 20000);
    return () => clearInterval(id);
  }, []);
  return d;
}

export function yearProgress(d: Date): number {
  const y = d.getFullYear();
  const a = new Date(y, 0, 1).getTime();
  const b = new Date(y + 1, 0, 1).getTime();
  return (d.getTime() - a) / (b - a);
}

export function daysLeftInYear(d: Date): number {
  const end = new Date(d.getFullYear() + 1, 0, 1).getTime();
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return Math.round((end - today) / 86400000);
}

export function monthProgress(year: number, month: number, d: Date): number {
  const a = new Date(year, month - 1, 1).getTime();
  const b = new Date(year, month, 1).getTime();
  return Math.min(1, Math.max(0, (d.getTime() - a) / (b - a)));
}

export const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
export const WEEKDAYS_SHORT = ['일', '월', '화', '수', '목', '금', '토'];
export const WEEKDAYS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const MONTHS_EN = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const dayKey = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
export const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
