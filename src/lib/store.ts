import { useSyncExternalStore } from 'react';
import { dayKey, now } from './time';

export const TASK_ROWS = 12;
export const TIME_ROWS = 24; // 6시 → 다음날 5시
export const TIME_COLS = 6; // 10분 단위
export const FIRST_HOUR = 6;

export type Task = { tag: string; text: string; done: boolean; hl: number };
export type DayEntry = {
  dday: string;
  comment: string;
  total: string;
  tasks: Task[];
  cells: number[]; // 0 = 비어 있음, 1..5 = 형광펜 색
  memo: string;
};
export type Goal = { id: string; title: string; step: string; months: boolean[]; done: boolean };
export type YearPlan = { motto: string; goals: Goal[] };
type DB = { v: 1; years: Record<string, YearPlan>; days: Record<string, DayEntry> };

export const emptyTask = (): Task => ({ tag: '', text: '', done: false, hl: 0 });
export const emptyDay = (): DayEntry => ({
  dday: '',
  comment: '',
  total: '',
  tasks: Array.from({ length: TASK_ROWS }, emptyTask),
  cells: new Array(TIME_ROWS * TIME_COLS).fill(0),
  memo: '',
});
export const newGoal = (): Goal => ({
  id: Math.random().toString(36).slice(2, 9),
  title: '',
  step: '',
  months: new Array(12).fill(false),
  done: false,
});
export const emptyYear = (): YearPlan => ({ motto: '', goals: [newGoal()] });

const EMPTY_DAY = emptyDay();

export const dayHasContent = (d: DayEntry | undefined) =>
  !!d &&
  (!!d.dday.trim() || !!d.comment.trim() || !!d.total.trim() || !!d.memo.trim() ||
    d.cells.some((c) => c > 0) ||
    d.tasks.some((t) => t.tag.trim() || t.text.trim() || t.done || t.hl > 0));

export const yearPlanHasContent = (p: YearPlan | undefined) =>
  !!p && (!!p.motto.trim() || p.goals.some((g) => g.title.trim() || g.step.trim()));

const demo = new URLSearchParams(location.search).has('demo');
const STORAGE_KEY = demo ? 'heureum:demo' : 'heureum:v1';

function seedDemo(): DB {
  const d = now();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const today = d.getDate();
  const db: DB = { v: 1, years: {}, days: {} };
  db.years[y - 1] = {
    motto: '덜 하고, 끝까지 하기',
    goals: [
      { ...newGoal(), title: '아침 10분 스트레칭', step: '요가 매트를 침대 옆에 펴 두기', done: true, months: new Array(12).fill(true) },
      { ...newGoal(), title: '책 12권 읽기', step: '가방에 책 한 권 넣기', months: new Array(12).fill(false).map((_, i) => i % 2 === 0) },
    ],
  };
  db.years[y] = {
    motto: '작게 시작해서 매일 닿기',
    goals: [
      { ...newGoal(), title: '포트폴리오 사이트 공개', step: '첫 화면 스케치 한 장 그리기', months: new Array(12).fill(false).map((_, i) => i >= 8) },
      { ...newGoal(), title: '주 3회 달리기', step: '운동화를 현관에 꺼내 두기', months: new Array(12).fill(true) },
      { ...newGoal(), title: '일본어 회화 입문', step: '히라가나 5글자 따라 쓰기', months: new Array(12).fill(false).map((_, i) => i >= 9) },
    ],
  };
  const paint = (cells: number[], color: number, fromHour: number, fromMin: number, toHour: number, toMin: number) => {
    const idx = (h: number, mm: number) => ((h - FIRST_HOUR + 24) % 24) * TIME_COLS + Math.floor(mm / 10);
    for (let i = idx(fromHour, fromMin); i < idx(toHour, toMin); i++) cells[i] = color;
  };
  const mk = (variant: number): DayEntry => {
    const e = emptyDay();
    e.dday = variant % 2 ? 'D-20 포트폴리오 공개' : '';
    e.comment = ['한 번에 하나만. 시작만 하면 된다.', '어제보다 10분만 더.', '완벽보다 완료.'][variant % 3];
    e.tasks[0] = { tag: '작업', text: '포트폴리오 첫 화면 레이아웃', done: variant % 2 === 0, hl: 1 };
    e.tasks[1] = { tag: '운동', text: '한강 달리기 3km', done: true, hl: 3 };
    e.tasks[2] = { tag: '공부', text: '일본어 히라가나 か행', done: false, hl: 4 };
    if (variant % 3 === 0) e.tasks[3] = { tag: '집', text: '빨래 개기', done: false, hl: 0 };
    paint(e.cells, 3, 7, 0, 7, 40);
    paint(e.cells, 1, 9, 30, 11 + (variant % 2), 20);
    paint(e.cells, 4, 14, 0, 14, 50);
    if (variant % 2) paint(e.cells, 1, 16, 10, 17, 30);
    e.memo = variant % 2 ? '오후엔 집중이 잘 안 됨 → 내일은 오전에 작업 몰기' : '';
    return e;
  };
  [today, today - 1, today - 2, today - 4, today - 7, today - 8].forEach((dd, i) => {
    if (dd >= 1) db.days[dayKey(y, m, dd)] = mk(i);
  });
  return db;
}

function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && parsed.v === 1 && parsed.years && parsed.days) return parsed;
    }
  } catch {
    /* 저장소를 못 읽으면 빈 상태로 시작 */
  }
  return demo ? seedDemo() : { v: 1, years: {}, days: {} };
}

let db: DB = load();
const listeners = new Set<() => void>();
let saveTimer = 0;

function commit(next: DB) {
  db = next;
  listeners.forEach((l) => l());
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, 250);
}
function flush() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* 용량 초과 등 — 화면의 값은 유지된다 */
  }
}
window.addEventListener('pagehide', flush);

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => db);
}

export function getDay(d: DB, key: string): DayEntry {
  return d.days[key] ?? EMPTY_DAY;
}

export function updateDay(key: string, patch: Partial<DayEntry>) {
  const next = { ...(db.days[key] ?? emptyDay()), ...patch };
  const days = { ...db.days };
  if (dayHasContent(next)) days[key] = next;
  else delete days[key];
  commit({ ...db, days });
}

export function updateTask(key: string, index: number, patch: Partial<Task>) {
  const cur = db.days[key] ?? emptyDay();
  const tasks = cur.tasks.map((t, i) => (i === index ? { ...t, ...patch } : t));
  updateDay(key, { tasks });
}

export function getYearPlan(d: DB, year: number): YearPlan | undefined {
  return d.years[year];
}

export function updateYearPlan(year: number, plan: YearPlan) {
  const years = { ...db.years };
  if (yearPlanHasContent(plan) || plan.goals.length > 1) years[year] = plan;
  else delete years[year];
  commit({ ...db, years });
}

/** 그 해에 계획이나 일별 기록이 하나라도 있는지 */
export function yearHasData(d: DB, year: number): boolean {
  if (yearPlanHasContent(d.years[year])) return true;
  const prefix = `${year}-`;
  for (const key in d.days) if (key.startsWith(prefix)) return true;
  return false;
}

export const PEN_COLORS: { id: number; name: string; rgb: [number, number, number] }[] = [
  { id: 1, name: '노랑', rgb: [255, 222, 60] },
  { id: 2, name: '분홍', rgb: [255, 138, 176] },
  { id: 3, name: '초록', rgb: [110, 222, 150] },
  { id: 4, name: '하늘', rgb: [110, 190, 255] },
  { id: 5, name: '보라', rgb: [178, 156, 255] },
];
export const penRGB = (id: number) => PEN_COLORS[id - 1]?.rgb ?? [128, 128, 128];

export function formatMinutes(min: number): string {
  if (min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
