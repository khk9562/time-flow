// 기기 간·게스트→계정 병합 규칙. 항목(하루 / 한 해 계획) 단위로 "나중에 고친 쪽이 이긴다".
// id 는 'day:2026-10-11' 또는 'year:2026'.

export type Items = Record<string, unknown>;
export type Meta = {
  /** 항목별 마지막 수정 시각(ms). 지운 항목도 시각은 남는다. */
  ts: Record<string, number>;
  /** 아직 서버에 올리지 못한 항목 */
  dirty: string[];
};
export type State = { items: Items; meta: Meta };
export type RemoteRow = { id: string; data: unknown | null; ts: number };

export const emptyMeta = (): Meta => ({ ts: {}, dirty: [] });

/** 로그인 전에 쓴 기록을 계정 쪽으로 옮긴다. 같은 항목이 양쪽에 있으면 더 최근에 고친 쪽을 남긴다. */
export function mergeGuest(account: State, guest: State): State {
  const items = { ...account.items };
  const ts = { ...account.meta.ts };
  const dirty = new Set(account.meta.dirty);
  for (const id of Object.keys(guest.items)) {
    const g = guest.meta.ts[id] ?? 1;
    if (g >= (ts[id] ?? 0)) {
      items[id] = guest.items[id];
      ts[id] = g;
      dirty.add(id);
    }
  }
  return { items, meta: { ts, dirty: [...dirty] } };
}

/** 서버에서 받은 행을 반영한다. 로컬이 더 최근이면 그대로 두고(곧 올라간다), 서버가 더 최근이면 덮는다. */
export function applyRemote(local: State, rows: RemoteRow[]): State & { changed: boolean } {
  const items = { ...local.items };
  const ts = { ...local.meta.ts };
  const dirty = new Set(local.meta.dirty);
  let changed = false;
  for (const r of rows) {
    if (r.ts <= (ts[r.id] ?? 0)) continue;
    if (r.data === null) delete items[r.id];
    else items[r.id] = r.data;
    ts[r.id] = r.ts;
    dirty.delete(r.id);
    changed = true;
  }
  return { items, meta: { ts, dirty: [...dirty] }, changed };
}
