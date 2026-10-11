import { useSyncExternalStore } from 'react';
import { applyRemote, emptyMeta, mergeGuest, type Items, type Meta, type RemoteRow } from './merge';
import { supabase } from './supabase';
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
const GUEST_KEY = demo ? 'heureum:demo' : 'heureum:v1';
const userKey = (id: string) => `heureum:u:${id}`;

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

type Saved = DB & { meta?: Meta };

function load(key: string): { db: DB; meta: Meta } {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Saved;
      if (parsed && parsed.v === 1 && parsed.years && parsed.days) {
        const { meta: m, ...rest } = parsed;
        return { db: rest, meta: { ts: m?.ts ?? {}, dirty: m?.dirty ?? [] } };
      }
    }
  } catch {
    /* 저장소를 못 읽으면 빈 상태로 시작 */
  }
  return { db: demo && key === GUEST_KEY ? seedDemo() : { v: 1, years: {}, days: {} }, meta: emptyMeta() };
}

// ── 현재 상태 ────────────────────────────────────────────────────────────────
// scope: 지금 보고 있는 저장 공간. 로그인 전에는 이 기기의 게스트 공간, 로그인 후에는 계정별 공간.
let scope = GUEST_KEY;
let { db, meta } = load(scope);
const listeners = new Set<() => void>();
let saveTimer = 0;

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline';
type Account = { id: string; email: string };
let sync: { user: Account | null; status: SyncStatus; error: string | null } = { user: null, status: 'local', error: null };

const emit = () => listeners.forEach((l) => l());
const setSync = (patch: Partial<typeof sync>) => {
  sync = { ...sync, ...patch };
  emit();
};

function flush() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(scope, JSON.stringify({ ...db, meta } satisfies Saved));
  } catch {
    /* 용량 초과 등 — 화면의 값은 유지된다 */
  }
}
window.addEventListener('pagehide', flush);

/** 한 항목이 바뀌었을 때: 화면 갱신 → 기기에 저장 → (로그인 상태면) 서버로 */
function commit(next: DB, id: string) {
  db = next;
  meta = {
    ts: { ...meta.ts, [id]: Date.now() },
    dirty: sync.user && !meta.dirty.includes(id) ? [...meta.dirty, id] : meta.dirty,
  };
  emit();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, 250);
  if (sync.user) schedulePush();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => db);
}
export function useSync() {
  return useSyncExternalStore(subscribe, () => sync);
}
export const accountsAvailable = !!supabase && !demo;

// ── 항목 단위 변환 (id: 'day:2026-10-11' | 'year:2026') ─────────────────────
const toItems = (d: DB): Items => {
  const items: Items = {};
  for (const k in d.days) items[`day:${k}`] = d.days[k];
  for (const k in d.years) items[`year:${k}`] = d.years[k];
  return items;
};
const fromItems = (items: Items): DB => {
  const next: DB = { v: 1, years: {}, days: {} };
  for (const id in items) {
    const [kind, key] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
    if (kind === 'day') next.days[key] = items[id] as DayEntry;
    else if (kind === 'year') next.years[key] = items[id] as YearPlan;
  }
  return next;
};
const splitId = (id: string) => ({ kind: id.slice(0, id.indexOf(':')), key: id.slice(id.indexOf(':') + 1) });

// ── 계정 동기화 ──────────────────────────────────────────────────────────────
let pushTimer = 0;
let pushing = false;

function schedulePush(delay = 900) {
  clearTimeout(pushTimer);
  pushTimer = window.setTimeout(push, delay);
}

async function push() {
  const user = sync.user;
  if (!supabase || !user || pushing) return;
  if (meta.dirty.length === 0) {
    if (sync.status !== 'synced') setSync({ status: 'synced', error: null });
    return;
  }
  pushing = true;
  setSync({ status: 'syncing' });
  const items = toItems(db);
  const batch = meta.dirty.map((id) => ({ id, ts: meta.ts[id] ?? Date.now() }));
  const rows = batch.map(({ id, ts }) => ({
    user_id: user.id,
    ...splitId(id),
    data: items[id] ?? null,
    updated_at: new Date(ts).toISOString(),
  }));
  const { error } = await supabase.from('entries').upsert(rows, { onConflict: 'user_id,kind,key' });
  pushing = false;
  if (sync.user?.id !== user.id) return; // 올리는 사이에 계정이 바뀌었다
  if (error) {
    setSync({ status: 'offline', error: error.message });
    schedulePush(15000);
    return;
  }
  // 올리는 사이에 또 고친 항목은 다음 차례에 다시 올린다
  const sent = new Map(batch.map((b) => [b.id, b.ts]));
  meta = { ...meta, dirty: meta.dirty.filter((id) => !sent.has(id) || meta.ts[id] !== sent.get(id)) };
  flush();
  if (meta.dirty.length) schedulePush(300);
  else setSync({ status: 'synced', error: null });
}

async function pull() {
  const user = sync.user;
  if (!supabase || !user) return;
  setSync({ status: 'syncing' });
  const rows: RemoteRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('entries')
      .select('kind,key,data,updated_at')
      .order('key')
      .range(from, from + 999);
    if (sync.user?.id !== user.id) return;
    if (error) {
      setSync({ status: 'offline', error: error.message });
      return;
    }
    for (const r of data) rows.push({ id: `${r.kind}:${r.key}`, data: r.data, ts: Date.parse(r.updated_at) });
    if (data.length < 1000) break;
  }
  const merged = applyRemote({ items: toItems(db), meta }, rows);
  meta = merged.meta;
  if (merged.changed) {
    db = fromItems(merged.items);
    emit();
  }
  flush();
  await push();
}

/** 로그인/로그아웃에 따라 저장 공간을 바꾼다. 로그인 전에 쓴 기록은 계정으로 옮겨진다. */
function setAccount(user: Account | null) {
  if ((sync.user?.id ?? null) === (user?.id ?? null)) return;
  clearTimeout(pushTimer);
  if (!user && discardCache) {
    clearTimeout(saveTimer);
    try {
      localStorage.removeItem(scope);
    } catch {
      /* 무시 */
    }
  } else flush();
  discardCache = false;
  if (user) {
    const guest = scope === GUEST_KEY ? { db, meta } : load(GUEST_KEY);
    const cached = load(userKey(user.id));
    const merged = mergeGuest(
      { items: toItems(cached.db), meta: cached.meta },
      { items: toItems(guest.db), meta: guest.meta },
    );
    scope = userKey(user.id);
    db = fromItems(merged.items);
    meta = merged.meta;
    flush();
    // 계정 공간에 안전하게 적힌 뒤에 게스트 공간을 비운다
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {
      /* 무시 */
    }
    sync = { user, status: 'syncing', error: null };
    emit();
    void pull();
  } else {
    scope = GUEST_KEY;
    ({ db, meta } = load(scope));
    sync = { user: null, status: 'local', error: null };
    emit();
  }
}

if (supabase && !demo) {
  const client = supabase;
  client.auth.onAuthStateChange((_event, session) => {
    const u = session?.user;
    // 콜백 안에서 바로 다른 Supabase 호출을 하면 잠길 수 있어 한 박자 늦춘다
    window.setTimeout(() => setAccount(u ? { id: u.id, email: u.email ?? '' } : null), 0);
  });
  window.addEventListener('online', () => void pull());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && sync.user) void pull();
  });
}

export async function sendLoginLink(email: string): Promise<string | null> {
  if (!supabase) return '계정 기능이 아직 연결되지 않았습니다';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  return error ? error.message : null;
}

export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  if (!supabase) return '계정 기능이 아직 연결되지 않았습니다';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

/** 가입. 'confirm' 은 Supabase 가 메일 확인을 요구하는 설정일 때 (바로 로그인되지 않는다) */
export async function signUpWithPassword(email: string, password: string): Promise<{ error: string | null; confirm: boolean }> {
  if (!supabase) return { error: '계정 기능이 아직 연결되지 않았습니다', confirm: false };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) return { error: error.message, confirm: false };
  // 메일 확인이 켜져 있으면, 이미 있는 주소로 가입해도 오류 없이 빈 사용자가 돌아온다
  if (!data.session && data.user && data.user.identities?.length === 0) return { error: 'already registered', confirm: false };
  return { error: null, confirm: !data.session };
}

/** 로그인한 상태에서 비밀번호를 정하거나 바꾼다 (메일로 로그인한 계정, 비밀번호를 잊은 경우) */
export async function setPassword(password: string): Promise<string | null> {
  if (!supabase) return '계정 기능이 아직 연결되지 않았습니다';
  const { error } = await supabase.auth.updateUser({ password });
  return error ? error.message : null;
}

/** 메일에 적힌 코드로 로그인한다 (링크를 누를 수 없는 환경: 홈 화면 앱, 다른 기기의 메일함 등) */
export async function verifyLoginCode(email: string, code: string): Promise<string | null> {
  if (!supabase) return '계정 기능이 아직 연결되지 않았습니다';
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  return error ? error.message : null;
}

/** 아직 올리지 못한 기록 수 (로그아웃 전에 알려주기 위해) */
export const pendingCount = () => meta.dirty.length;

let discardCache = false;

export async function signOut() {
  if (!supabase) return;
  await push();
  // 모두 올라갔다면 이 기기에 남은 계정 사본은 지운다 (함께 쓰는 기기 대비). 못 올린 게 있으면 남겨 둔다.
  discardCache = meta.dirty.length === 0;
  await supabase.auth.signOut();
}

export function getDay(d: DB, key: string): DayEntry {
  return d.days[key] ?? EMPTY_DAY;
}

export function updateDay(key: string, patch: Partial<DayEntry>) {
  const next = { ...(db.days[key] ?? emptyDay()), ...patch };
  const days = { ...db.days };
  if (dayHasContent(next)) days[key] = next;
  else delete days[key];
  commit({ ...db, days }, `day:${key}`);
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
  commit({ ...db, years }, `year:${year}`);
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
