import * as stylex from '@stylexjs/stylex';
import { useRef, useState, type FormEvent } from 'react';
import { addEvent, getDay, removeEvent, updateEvent, useDB } from '../lib/store';
import { parseDayKey, WEEKDAYS } from '../lib/time';
import { color, dur, ease, radius, type } from '../tokens.stylex';
import { Sheet } from './Sheet';
import { ui } from './ui';

/** 접지 않고 바로 보여 주는 일정 수. 그 뒤는 더보기를 눌러야 펼쳐진다 */
const SHOWN = 3;

const riseIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(10px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

const s = stylex.create({
  root: {
    marginTop: 14,
    animationName: riseIn,
    animationDuration: '460ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
  },
  // 세 칸으로 나눠 왼쪽 두 칸은 일정 추가, 오른쪽 한 칸은 플래너로 이동
  actions: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 },
  btn: {
    height: 48,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingInline: 8,
    borderRadius: radius.control,
    fontSize: type.body,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    color: color.ink,
    transitionProperty: 'background-color, transform',
    transitionDuration: dur.tap,
    transform: { default: 'none', ':active': 'scale(0.97)' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: 2,
  },
  add: { backgroundColor: { default: color.washStrong, ':active': color.wash } },
  go: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.lineStrong,
    backgroundColor: { default: 'transparent', ':hover': { default: null, '@media (hover: hover)': color.wash }, ':active': color.washStrong },
  },
  list: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 },
  // 왼쪽에만 진한 선이 그어진 쪽지 한 장
  item: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: 46,
    paddingInline: 14,
    borderRadius: `0 ${radius.control} ${radius.control} 0`,
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: color.lineStrong,
    textAlign: 'left',
    fontSize: type.body,
    fontWeight: 600,
    color: color.ink,
    backgroundColor: { default: color.wash, ':hover': { default: null, '@media (hover: hover)': color.washStrong }, ':active': color.washStrong },
    transitionProperty: 'background-color, scale',
    transitionDuration: dur.tap,
    // 등장 애니메이션이 transform 을 쥐고 있어 누름 반응은 scale 로 한다
    scale: { default: '1', ':active': '0.98' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: 2,
    animationName: riseIn,
    animationDuration: '420ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
  },
  itemText: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  // 네 번째부터는 접혀 있다가 높이가 자라며 펼쳐진다
  fold: {
    display: 'grid',
    gridTemplateRows: '0fr',
    marginTop: -6,
    transitionProperty: 'grid-template-rows, margin-top',
    transitionDuration: '420ms',
    transitionTimingFunction: ease.out,
  },
  foldOpen: { gridTemplateRows: '1fr', marginTop: 0 },
  foldInner: { display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0, overflow: 'hidden' },
  more: { alignSelf: 'flex-start', marginLeft: -10, fontSize: type.small, color: color.inkSoft },
  chevron: { transitionProperty: 'rotate', transitionDuration: dur.quick, transitionTimingFunction: ease.out },
  chevronOpen: { rotate: '180deg' },
  empty: { marginTop: 12, paddingInline: 4, fontSize: type.small, color: color.inkSoft, wordBreak: 'keep-all', overflowWrap: 'break-word' },
  form: { display: 'flex', flexDirection: 'column', gap: 14, paddingInline: 10, paddingTop: 4 },
  input: {
    width: '100%',
    height: 52,
    fontSize: 17,
    fontWeight: 600,
    color: color.ink,
    borderBottomWidth: 1.5,
    borderBottomStyle: 'solid',
    borderBottomColor: { default: color.lineStrong, ':focus': color.ink },
    transitionProperty: 'border-color',
    transitionDuration: dur.quick,
    '::placeholder': { color: color.inkFaint },
  },
  submit: { backgroundColor: { default: color.ink, ':active': color.lineStrong }, color: color.inverse },
  submitOff: { opacity: 0.4 },
  remove: { alignSelf: 'center', color: color.inkSoft },
});

type Props = {
  /** 선택한 날 ('YYYY-MM-DD') */
  dateKey: string;
  onOpenPlanner: () => void;
};

/** 달력에서 고른 날의 일정: 추가·플래너 이동 버튼과 그날의 일정 목록 */
export function DayEvents({ dateKey, onOpenPlanner }: Props) {
  const db = useDB();
  const events = getDay(db, dateKey).events ?? [];
  const date = parseDayKey(dateKey);
  const dayText = `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}`;

  // 펼침은 날짜마다 따로: 달력이 날짜를 key 로 이 컴포넌트를 새로 그려, 다른 날을 고르면 접힌 채로 시작한다
  const [more, setMore] = useState(false);
  const rest = events.slice(SHOWN);
  const expanded = more && rest.length > 0;
  const addRef = useRef<HTMLButtonElement>(null);

  // 시트가 닫히는 동안에도 내용이 바뀌지 않도록 열림과 대상(고칠 일정의 id, 새 일정이면 null)을 따로 둔다
  const [sheet, setSheet] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const openSheet = (id: string | null, title: string) => {
    setTarget(id);
    setDraft(title);
    setSheet(true);
  };
  const title = draft.trim();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // 닫히며 내려가는 동안 한 번 더 눌러도 같은 일정이 두 번 생기지 않게
    if (!sheet || !title) return;
    if (target) updateEvent(dateKey, target, title);
    else addEvent(dateKey, title);
    setSheet(false);
  };

  const item = (ev: { id: string; title: string }, i: number) => (
    <button
      key={ev.id}
      type="button"
      aria-haspopup="dialog"
      aria-label={`일정 "${ev.title}" 고치기`}
      title={ev.title}
      onClick={() => openSheet(ev.id, ev.title)}
      {...stylex.props(s.item)}
      style={{ animationDelay: `${80 + i * 60}ms` }}
    >
      <span {...stylex.props(s.itemText)}>{ev.title}</span>
    </button>
  );

  return (
    <section aria-label={`${dayText} 일정`} {...stylex.props(s.root)}>
      <div {...stylex.props(s.actions)}>
        <button
          ref={addRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={sheet && !target}
          onClick={() => openSheet(null, '')}
          {...stylex.props(s.btn, s.add)}
        >
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <path d="M5 1.5v7M1.5 5h7" />
          </svg>
          일정 추가
        </button>
        <button type="button" aria-label={`${dayText} 플래너로 이동`} onClick={onOpenPlanner} {...stylex.props(s.btn, s.go)}>
          플래너로 이동
        </button>
      </div>

      {events.length === 0 ? (
        <p key={dateKey} {...stylex.props(s.empty)}>
          {date.getDate()}일에는 아직 일정이 없어요.
        </p>
      ) : (
        <div key={dateKey} {...stylex.props(s.list)}>
          {events.slice(0, SHOWN).map(item)}
          {rest.length > 0 && (
            <>
              <div inert={!expanded} {...stylex.props(s.fold, expanded && s.foldOpen)}>
                <div {...stylex.props(s.foldInner)}>{rest.map(item)}</div>
              </div>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setMore(!expanded)}
                {...stylex.props(ui.textButton, s.more)}
              >
                {expanded ? '접기' : `더보기 ${rest.length}건`}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...stylex.props(s.chevron, expanded && s.chevronOpen)}>
                  <path d="M2 3.5l3 3 3-3" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title={target ? '일정 고치기' : '일정 추가'} subtitle={dayText}>
        <form onSubmit={submit} {...stylex.props(s.form)}>
          <input
            data-autofocus
            value={draft}
            maxLength={60}
            aria-label="일정 제목"
            placeholder="어떤 일정인가요"
            enterKeyHint="done"
            onChange={(e) => setDraft(e.target.value)}
            {...stylex.props(s.input)}
          />
          <button type="submit" aria-disabled={!title} {...stylex.props(s.btn, s.submit, !title && s.submitOff)}>
            {target ? '저장' : '추가'}
          </button>
          {target && (
            <button
              type="button"
              onClick={() => {
                if (!sheet) return;
                removeEvent(dateKey, target);
                setSheet(false);
                // 시트를 연 일정 쪽지가 사라졌으니, 시트가 초점을 돌려준 뒤 일정 추가 버튼으로 옮긴다
                window.setTimeout(() => addRef.current?.focus({ preventScroll: true }), 0);
              }}
              {...stylex.props(ui.textButton, s.remove)}
            >
              이 일정 지우기
            </button>
          )}
        </form>
      </Sheet>
    </section>
  );
}
