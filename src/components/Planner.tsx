import * as stylex from '@stylexjs/stylex';
import { useRef, useState, useSyncExternalStore } from 'react';
import { atmosphere, atmosphereSnapshot, subscribeAtmosphere } from '../lib/atmosphere';
import {
  formatMinutes, getDay, getYearPlan, PEN_COLORS, penRGB, updateDay, updateTask, useDB, type Goal, type Task,
} from '../lib/store';
import { upcomingEvents } from '../lib/events';
import { dayKey, pad2, parseDayKey, useSlowNow, WEEKDAYS, WEEKDAYS_EN } from '../lib/time';
import { color, dur, ease, radius, type } from '../tokens.stylex';
import { Sheet, sheetItem } from './Sheet';
import { Timeline } from './Timeline';
import { AutoTextarea, Check, NO_SWIPE, ui, useKeepFocusVisible, useKeyboardInset, useSwipe } from './ui';

const sheetIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translateX(56px) rotate(0.5deg)' },
  to: { opacity: 1, transform: 'translateX(0) rotate(0)' },
});

const COLS = 'minmax(0, 1fr) clamp(150px, 33%, 250px)';
const LINE = 26;

const s = stylex.create({
  root: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    transitionProperty: 'opacity, transform',
    transitionDuration: dur.quick,
    transitionTimingFunction: ease.out,
  },
  leaving: { opacity: 0, transform: 'translateX(40px)', pointerEvents: 'none' },
  bar: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    // 좁은 화면에서는 날짜 줄과 펜 줄, 두 줄로 나뉜다
    flexWrap: { default: 'nowrap', '@media (max-width: 560px)': 'wrap' },
    rowGap: 0,
    height: { default: 68, '@media (max-width: 560px)': 'auto' },
    paddingTop: 12,
    paddingBottom: { default: 0, '@media (max-width: 560px)': 6 },
    paddingInline: 'clamp(10px, 2vw, 26px)',
  },
  barLeft: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    flexBasis: { default: 'auto', '@media (max-width: 560px)': '100%' },
  },
  trayWrap: { marginLeft: 'auto' },
  dateNav: { display: 'flex', alignItems: 'center' },
  dateText: { fontSize: type.body, fontWeight: 700, whiteSpace: 'nowrap', paddingInline: 2, fontVariantNumeric: 'tabular-nums' },
  scroll: {
    flexGrow: 1,
    minHeight: 0,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    paddingInline: 'clamp(12px, 2.2vw, 30px)',
    paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
    display: 'flex',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 780,
    minHeight: 'max(640px, 100%)',
    height: 'max-content',
    alignSelf: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 'clamp(16px, 2.4vw, 30px)',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    borderRadius: radius.paper,
    boxShadow: '0 30px 70px -40px rgb(0 0 0 / 0.55)',
    animationName: sheetIn,
    animationDuration: '640ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'backwards',
  },
  head: {
    display: 'grid',
    gridTemplateColumns: { default: COLS, '@media (max-width: 560px)': 'minmax(0, 1fr)' },
    columnGap: 22,
    rowGap: 6,
  },
  field: { display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 },
  thick: { paddingBottom: 7, borderBottomWidth: 1.5, borderBottomStyle: 'solid', borderBottomColor: color.lineStrong },
  // 입력칸 옆에 버튼이 붙는 칸: 이름표와 입력칸만 label 로 묶는다
  fieldMain: { display: 'flex', alignItems: 'flex-start', gap: 10, flexGrow: 1, minWidth: 0 },
  fieldLabel: { lineHeight: `${LINE}px`, flexShrink: 0 },
  // 줄마다 밑줄이 그어진 필기 칸
  ruled: {
    flexGrow: 1,
    minWidth: 0,
    fontSize: type.body,
    fontWeight: 500,
    lineHeight: `${LINE}px`,
    // 좁은 칸에서도 낱말 가운데에서 줄이 바뀌지 않게
    wordBreak: 'keep-all',
    overflowWrap: 'break-word',
    color: color.ink,
    backgroundImage: `linear-gradient(to bottom, transparent ${LINE - 1}px, ${color.line} ${LINE - 1}px)`,
    backgroundSize: `100% ${LINE}px`,
    '::placeholder': { color: color.inkFaint },
  },
  ymd: { fontWeight: 800, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  ymdDay: { marginLeft: 10, fontSize: type.label, letterSpacing: type.labelTracking, color: color.inkSoft, fontWeight: 600 },
  // 좁은 화면에서는 할 일 아래에 타임라인을 통째로 쌓는다
  body: {
    flexGrow: 1,
    display: 'grid',
    gridTemplateColumns: { default: COLS, '@media (max-width: 560px)': 'minmax(0, 1fr)' },
    columnGap: 22,
    rowGap: 18,
    minHeight: 404,
  },
  col: { display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 },
  timeCol: { minHeight: { default: 0, '@media (max-width: 560px)': 560 } },
  labelRow: { display: 'flex', alignItems: 'center', gap: 10, height: 24, flexShrink: 0 },
  rule: { flexGrow: 1, height: 1, backgroundColor: color.line },
  table: {
    flexGrow: 1,
    display: 'grid',
    gridTemplateRows: { default: 'repeat(12, minmax(31px, 1fr))', '@media (pointer: coarse)': 'repeat(12, minmax(40px, 1fr))' },
    borderTopWidth: 1.5,
    borderTopStyle: 'solid',
    borderTopColor: color.lineStrong,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: { default: 'clamp(44px, 15%, 68px) minmax(0, 1fr) 36px', '@media (pointer: coarse)': 'clamp(44px, 15%, 68px) minmax(0, 1fr) 44px' },
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.line,
  },
  rowStrong: { borderBottomColor: color.lineStrong },
  tagCell: { borderRightWidth: 1, borderRightStyle: 'solid', borderRightColor: color.line },
  tagInput: {
    width: '100%',
    height: '100%',
    paddingInline: 4,
    textAlign: 'center',
    fontSize: type.small,
    fontWeight: 600,
    color: color.inkSoft,
    backgroundColor: { default: 'transparent', ':focus': color.wash },
  },
  textCell: { position: 'relative', minWidth: 0 },
  hl: {
    position: 'absolute',
    top: '16%',
    bottom: '14%',
    left: 3,
    right: 3,
    borderRadius: '3px 7px 4px 8px / 6px 3px 7px 4px',
    transformOrigin: '0 50%',
    transitionProperty: 'transform',
    transitionDuration: '360ms',
    transitionTimingFunction: ease.out,
    pointerEvents: 'none',
  },
  hlOff: { transform: 'scaleX(0) rotate(-0.3deg)' },
  hlOn: { transform: 'scaleX(1) rotate(-0.3deg)' },
  preview: {
    position: 'absolute',
    top: '16%',
    bottom: '14%',
    borderRadius: '3px 7px 4px 8px / 6px 3px 7px 4px',
    pointerEvents: 'none',
  },
  textInput: {
    position: 'relative',
    width: '100%',
    height: '100%',
    paddingInline: 10,
    fontSize: type.body,
    fontWeight: 500,
    color: color.ink,
    backgroundColor: { default: 'transparent', ':focus': color.wash },
    '::placeholder': { color: color.inkFaint },
  },
  textDone: { color: color.inkSoft, textDecorationLine: 'line-through' },
  textWithPick: { paddingRight: { default: 34, '@media (pointer: coarse)': 40 } },
  // 펜을 든 동안: 가로로 그으면 형광펜, 톡 누르면 그대로 글쓰기
  penLayer: { position: 'absolute', inset: 0, cursor: 'crosshair', touchAction: 'pan-y' },
  checkCell: {
    borderLeftWidth: 1,
    borderLeftStyle: 'solid',
    borderLeftColor: color.line,
    borderRightWidth: 1,
    borderRightStyle: 'solid',
    borderRightColor: color.line,
  },
  memo: { display: 'flex', flexDirection: 'column', gap: 2 },
});

const pick = stylex.create({
  // 할 일 칸 오른쪽의 작은 + 네모. 누르면 목표 루틴 목록이 열린다
  wrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    paddingRight: { default: 6, '@media (pointer: coarse)': 4 },
  },
  btn: {
    width: { default: 20, '@media (pointer: coarse)': 30 },
    height: { default: 20, '@media (pointer: coarse)': 30 },
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.line, ':hover': color.lineStrong },
    color: color.inkSoft,
    backgroundColor: { default: color.surface, ':hover': { default: null, '@media (hover: hover)': color.wash } },
    opacity: { default: 0.75, ':hover': 1, ':focus-visible': 1 },
    transitionProperty: 'background-color, border-color, color, opacity, transform',
    transitionDuration: dur.tap,
    transform: { default: 'none', ':active': 'scale(0.88)' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: 1,
  },
  // 루틴과 이어진 줄: 네모가 채워진다
  btnLinked: { backgroundColor: color.ink, borderColor: color.ink, color: color.inverse, opacity: 1 },
  btnOpen: { borderColor: color.ink, color: color.ink, opacity: 1 },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    minHeight: 58,
    paddingInline: 14,
    borderRadius: 14,
    textAlign: 'left',
    fontSize: 16,
    fontWeight: 700,
    color: color.ink,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    backgroundColor: { default: 'transparent', ':hover': { default: null, '@media (hover: hover)': color.wash }, ':active': color.washStrong },
    transitionProperty: 'background-color, transform, border-color',
    transitionDuration: dur.tap,
    transform: { default: 'none', ':active': 'scale(0.98)' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: 2,
  },
  itemOn: { borderColor: color.ink, backgroundColor: color.wash },
  no: { fontSize: 22, fontWeight: 200, color: color.inkSoft, fontVariantNumeric: 'tabular-nums', minWidth: 28 },
  itemText: { flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mark: {
    flexShrink: 0,
    width: 22,
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    backgroundColor: color.ink,
    color: color.inverse,
  },
  unlink: { alignSelf: 'flex-start', marginTop: 8, marginLeft: -4, fontSize: type.small, color: color.inkSoft },
  empty: { paddingInline: 4, paddingBlock: 10, fontSize: type.body, lineHeight: 1.6, color: color.inkSoft },
});

function RoutinePicker({
  routines, task, index, onPatch,
}: {
  routines: Goal[];
  task: Task;
  index: number;
  onPatch: (patch: Partial<Task>) => void;
}) {
  const [open, setOpen] = useState(false);
  const linked = routines.find((g) => g.id === task.goal);
  const choose = (g: Goal) => {
    onPatch({ text: g.title, goal: g.id });
    setOpen(false);
  };
  return (
    <div {...NO_SWIPE} {...stylex.props(pick.wrap)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={linked ? `${index + 1}번째 줄, 목표 루틴 "${linked.title}"와 이어짐. 바꾸기` : `${index + 1}번째 줄에 목표 루틴 채우기`}
        title={linked ? `목표 루틴: ${linked.title}` : '목표 루틴 채우기'}
        onClick={() => setOpen(true)}
        {...stylex.props(pick.btn, open && pick.btnOpen, !!linked && pick.btnLinked)}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M5 1.5v7M1.5 5h7" />
        </svg>
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="목표 루틴 채우기"
        subtitle={`${index + 1}번째 할 일에 넣을 루틴을 고르세요`}
      >
        {routines.length === 0 ? (
          <p {...stylex.props(pick.empty)}>아직 목표 루틴이 없습니다. 연도 화면의 "목표 루틴"에서 먼저 적어 주세요.</p>
        ) : (
          <div {...stylex.props(pick.list)}>
            {routines.map((g, i) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={g.id === task.goal}
                onClick={() => choose(g)}
                {...stylex.props(pick.item, sheetItem.enter, g.id === task.goal && pick.itemOn)}
                style={{ animationDelay: `${120 + i * 60}ms` }}
              >
                <span aria-hidden {...stylex.props(pick.no)}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span {...stylex.props(pick.itemText)}>{g.title}</span>
                {g.id === task.goal && (
                  <span aria-hidden {...stylex.props(pick.mark)}>
                    <svg width="11" height="11" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 9.4l3.3 3.3L14 5.6" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {task.goal && (
          <button
            type="button"
            onClick={() => {
              onPatch({ goal: undefined });
              setOpen(false);
            }}
            {...stylex.props(ui.textButton, pick.unlink)}
          >
            루틴 연결 끊기
          </button>
        )}
      </Sheet>
    </div>
  );
}

const dd = stylex.create({
  // 입력 한 줄과 같은 높이의 작은 + 네모. 누르는 범위는 보이는 것보다 넓다
  btn: {
    position: 'relative',
    flexShrink: 0,
    width: LINE,
    height: LINE,
    '::after': { content: '""', position: 'absolute', inset: -9 },
  },
  label: { flexShrink: 0, minWidth: 64, fontSize: 20, fontWeight: 200, color: color.ink, fontVariantNumeric: 'tabular-nums' },
  texts: { display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 0 },
  date: { fontSize: type.small, fontWeight: 500, color: color.inkSoft },
});

const dayText = (key: string) => {
  const d = parseDayKey(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}`;
};

/** D-Day 칸 옆의 + 네모: 다가오는 일정을 고르면 남은 날을 계산해 칸에 적는다 */
function DdayPicker({ dateKey, value, onChange }: { dateKey: string; value: string; onChange: (v: string) => void }) {
  const db = useDB();
  const [open, setOpen] = useState(false);
  const events = open ? upcomingEvents(db.days, dateKey) : [];
  const lines = value.split('\n').map((l) => l.trim());
  const choose = (line: string) => {
    // 이미 적힌 일정은 다시 적지 않는다
    if (!lines.includes(line)) onChange(value.trim() ? `${value.trimEnd()}\n${line}` : line);
    setOpen(false);
  };
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="일정에서 디데이 고르기"
        title="일정에서 디데이 고르기"
        onClick={() => setOpen(true)}
        {...stylex.props(pick.btn, dd.btn, open && pick.btnOpen)}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M5 1.5v7M1.5 5h7" />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="디데이 고르기" subtitle="고른 일정까지 남은 날을 적어 드려요">
        {events.length === 0 ? (
          <p {...stylex.props(pick.empty)}>이 날 이후로 등록된 일정이 없어요. 달력에서 날짜를 고르고 일정을 추가해 주세요.</p>
        ) : (
          <div {...stylex.props(pick.list)}>
            {events.map((ev, i) => {
              const line = `${ev.label} ${ev.title}`;
              const on = lines.includes(line);
              return (
                <button
                  key={`${ev.date}:${ev.id}`}
                  type="button"
                  aria-pressed={on}
                  onClick={() => choose(line)}
                  {...stylex.props(pick.item, sheetItem.enter, on && pick.itemOn)}
                  style={{ animationDelay: `${120 + Math.min(i, 8) * 60}ms` }}
                >
                  <span {...stylex.props(dd.label)}>{ev.label}</span>
                  <span {...stylex.props(dd.texts)}>
                    <span {...stylex.props(pick.itemText)}>{ev.title}</span>
                    <span {...stylex.props(dd.date)}>{dayText(ev.date)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Sheet>
    </>
  );
}

const tray = stylex.create({
  root: { display: 'flex', alignItems: 'flex-start', gap: 2 },
  tool: {
    position: 'relative',
    width: { default: 34, '@media (pointer: coarse)': 40 },
    height: 54,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    borderRadius: 8,
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: -1,
  },
  pen: {
    width: 20,
    height: 32,
    borderRadius: '5px 5px 3px 3px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    backgroundColor: color.washStrong,
    overflow: 'hidden',
    transitionProperty: 'transform, border-color',
    transitionDuration: dur.quick,
    transitionTimingFunction: ease.spring,
    transform: { default: 'translateY(0)', ':hover': { default: null, '@media (hover: hover)': 'translateY(3px)' } },
  },
  penOn: { transform: 'translateY(9px)', borderColor: color.ink },
  tip: { display: 'block', width: '100%', height: '58%', marginTop: '42%', clipPath: 'polygon(0 0, 100% 0, 100% 62%, 30% 100%, 0 100%)' },
  icon: { display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.ink },
  time: {
    position: 'absolute',
    bottom: 0,
    left: -4,
    right: -4,
    textAlign: 'center',
    fontSize: { default: 9.5, '@media (max-width: 560px)': 11 },
    fontWeight: 700,
    lineHeight: 1,
    color: color.inkSoft,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    transitionProperty: 'opacity',
    transitionDuration: dur.quick,
  },
  timeHidden: { opacity: 0 },
});

function PenTray({ tool, onTool, minutes }: { tool: number; onTool: (t: number) => void; minutes: number[] }) {
  const alpha = atmosphere.dark ? 0.9 : 1;
  const clock = (m: number) => `${Math.floor(m / 60)}:${pad2(m % 60)}`;
  return (
    <div role="radiogroup" aria-label="필기 도구" {...stylex.props(tray.root)}>
      <button type="button" role="radio" aria-checked={tool === 0} aria-label="쓰기" title="쓰기" onClick={() => onTool(0)} {...stylex.props(tray.tool)}>
        <span {...stylex.props(tray.pen, tray.icon, tool === 0 && tray.penOn)}>
          <svg width="12" height="16" viewBox="0 0 12 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <path d="M2 1.5h8M2 14.5h8M6 1.5v13" />
          </svg>
        </span>
      </button>
      {PEN_COLORS.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={tool === p.id}
          aria-label={`${p.name} 형광펜${minutes[p.id] ? `, ${formatMinutes(minutes[p.id])} 칠함` : ''}`}
          title={`${p.name} 형광펜`}
          onClick={() => onTool(p.id)}
          {...stylex.props(tray.tool)}
        >
          <span {...stylex.props(tray.pen, tool === p.id && tray.penOn)}>
            <span {...stylex.props(tray.tip)} style={{ backgroundColor: `rgb(${p.rgb.join(' ')} / ${alpha})` }} />
          </span>
          <span aria-hidden {...stylex.props(tray.time, (!minutes[p.id] || tool === p.id) && tray.timeHidden)}>
            {clock(minutes[p.id] || 0)}
          </span>
        </button>
      ))}
      <button type="button" role="radio" aria-checked={tool === -1} aria-label="지우개" title="지우개" onClick={() => onTool(-1)} {...stylex.props(tray.tool)}>
        <span {...stylex.props(tray.pen, tray.icon, tool === -1 && tray.penOn)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden>
            <path d="M8.6 1.6l3.8 3.8-6.2 6.2H3.4L1.6 9.8a1 1 0 010-1.4z" />
            <path d="M5 5.2l3.8 3.8" />
          </svg>
        </span>
      </button>
    </div>
  );
}

function TaskRow({
  task, index, tool, routines, onPatch,
}: {
  task: Task;
  index: number;
  tool: number;
  routines: Goal[];
  onPatch: (patch: Partial<Task>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastHl = useRef(task.hl || 1);
  if (task.hl) lastHl.current = task.hl;
  const [drag, setDrag] = useState<null | { x0: number; x1: number }>(null);
  const gesture = useRef<null | { id: number; x0: number; left: number }>(null);
  const alpha = atmosphere.dark ? 0.42 : 0.66;
  const penColor = (id: number, a: number) => `rgb(${penRGB(id).join(' ')} / ${a})`;

  return (
    <div {...stylex.props(s.row, (index + 1) % 4 === 0 && s.rowStrong)}>
      <div {...stylex.props(s.tagCell)}>
        <input
          value={task.tag}
          maxLength={8}
          aria-label={`${index + 1}번째 줄 분류`}
          onChange={(e) => onPatch({ tag: e.target.value })}
          {...stylex.props(s.tagInput)}
        />
      </div>
      <div {...stylex.props(s.textCell)}>
        <span
          aria-hidden
          {...stylex.props(s.hl, task.hl ? s.hlOn : s.hlOff)}
          style={{ backgroundColor: penColor(lastHl.current, alpha) }}
        />
        {drag && (
          <span
            aria-hidden
            {...stylex.props(s.preview)}
            style={{
              left: Math.min(drag.x0, drag.x1),
              width: Math.abs(drag.x1 - drag.x0),
              backgroundColor: tool === -1 ? 'rgb(var(--ink-rgb) / 0.16)' : penColor(tool, alpha * 0.8),
            }}
          />
        )}
        <input
          ref={inputRef}
          value={task.text}
          aria-label={`${index + 1}번째 할 일${task.hl ? `, ${PEN_COLORS[task.hl - 1].name} 형광펜` : ''}`}
          // 글을 다 지우면 루틴과의 연결도 함께 끊는다
          onChange={(e) => onPatch(e.target.value.trim() ? { text: e.target.value } : { text: e.target.value, goal: undefined })}
          {...stylex.props(s.textInput, s.textWithPick, task.done && s.textDone)}
        />
        {tool !== 0 && (
          <div
            {...NO_SWIPE}
            {...stylex.props(s.penLayer)}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              const r = e.currentTarget.getBoundingClientRect();
              gesture.current = { id: e.pointerId, x0: e.clientX - r.left, left: r.left };
            }}
            onPointerMove={(e) => {
              const g = gesture.current;
              if (!g || g.id !== e.pointerId) return;
              const x1 = e.clientX - g.left;
              if (drag || Math.abs(x1 - g.x0) > 6) setDrag({ x0: g.x0, x1 });
            }}
            onPointerUp={(e) => {
              const g = gesture.current;
              if (!g || g.id !== e.pointerId) return;
              gesture.current = null;
              const dist = Math.abs(e.clientX - g.left - g.x0);
              setDrag(null);
              if (dist < 14) {
                inputRef.current?.focus();
                return;
              }
              // 같은 색으로 다시 그으면 지워진다
              onPatch({ hl: tool === -1 || task.hl === tool ? 0 : tool });
            }}
            onPointerCancel={() => {
              gesture.current = null;
              setDrag(null);
            }}
          />
        )}
        <RoutinePicker routines={routines} task={task} index={index} onPatch={onPatch} />
      </div>
      <div {...stylex.props(s.checkCell)}>
        <Check checked={task.done} onChange={(v) => onPatch({ done: v })} label={`${index + 1}번째 할 일 완료`} />
      </div>
    </div>
  );
}

type Props = {
  year: number;
  month: number;
  day: number;
  leaving: boolean;
  onBack: () => void;
  onStep: (delta: number) => void;
};

export function Planner({ year, month, day, leaving, onBack, onStep }: Props) {
  const db = useDB();
  const today = useSlowNow();
  useSyncExternalStore(subscribeAtmosphere, atmosphereSnapshot);
  const key = dayKey(year, month, day);
  const entry = getDay(db, key);
  const routines = (getYearPlan(db, year)?.goals ?? []).filter((g) => g.title.trim());
  const [tool, setTool] = useState(0);
  const lastPen = useRef(1);
  const pickTool = (t: number) => {
    if (t > 0) lastPen.current = t;
    setTool(t);
  };

  const date = new Date(year, month - 1, day);
  const isToday = dayKey(today.getFullYear(), today.getMonth() + 1, today.getDate()) === key;
  const minutes = [0, 0, 0, 0, 0, 0];
  for (const c of entry.cells) if (c > 0) minutes[c] += 10;
  const totalMin = minutes.reduce((a, b) => a + b, 0);
  // 왼쪽으로 밀면 다음 날, 오른쪽으로 밀면 전날, 왼쪽 끝에서 밀면 달력으로. 형광펜을 긋는 곳은 제외된다
  const swipe = useSwipe({ onNext: () => onStep(1), onPrev: () => onStep(-1), onBack });
  // 키보드가 아래 칸(메모 등)을 가리지 않도록 그 높이만큼 스크롤 아래를 비운다
  const keyboard = useKeyboardInset(!leaving);
  useKeepFocusVisible(keyboard);

  return (
    <div {...stylex.props(s.root, leaving && s.leaving)} {...swipe}>
      <div {...stylex.props(s.bar)}>
        <div {...stylex.props(s.barLeft)}>
          <button type="button" onClick={onBack} aria-label="달력으로 돌아가기" {...stylex.props(ui.textButton)}>
            <span aria-hidden>←</span>
            <span>달력</span>
          </button>
          <div {...stylex.props(s.dateNav)}>
            <button type="button" aria-label="전날" onClick={() => onStep(-1)} {...stylex.props(ui.iconButton, ui.navButton)}>
              ‹
            </button>
            <span {...stylex.props(s.dateText)}>
              {month}월 {day}일 {WEEKDAYS[date.getDay()]}
            </span>
            <button type="button" aria-label="다음 날" onClick={() => onStep(1)} {...stylex.props(ui.iconButton, ui.navButton)}>
              ›
            </button>
          </div>
        </div>
        <div {...stylex.props(s.trayWrap)}>
          <PenTray tool={tool} onTool={pickTool} minutes={minutes} />
        </div>
      </div>

      <div {...stylex.props(s.scroll)} style={keyboard ? { paddingBottom: keyboard + 20 } : undefined}>
        <article key={key} {...stylex.props(s.sheet)} aria-label={`${year}년 ${month}월 ${day}일 플래너`}>
          <div {...stylex.props(s.head)}>
            <div {...stylex.props(s.field)}>
              <span {...stylex.props(ui.label, s.fieldLabel)}>Year/Month/Day</span>
              <span {...stylex.props(s.ruled, s.ymd)}>
                {year} / {pad2(month)} / {pad2(day)}
                <span {...stylex.props(s.ymdDay)}>{WEEKDAYS_EN[date.getDay()]}</span>
              </span>
            </div>
            <div {...stylex.props(s.field)}>
              <label {...stylex.props(s.fieldMain)}>
                <span {...stylex.props(ui.label, s.fieldLabel)}>D-Day</span>
                <AutoTextarea value={entry.dday} onChange={(e) => updateDay(key, { dday: e.target.value })} xstyle={s.ruled} />
              </label>
              <DdayPicker dateKey={key} value={entry.dday} onChange={(dday) => updateDay(key, { dday })} />
            </div>
            <label {...stylex.props(s.field, s.thick)}>
              <span {...stylex.props(ui.label, s.fieldLabel)}>Comment</span>
              <AutoTextarea
                value={entry.comment}
                minRows={2}
                onChange={(e) => updateDay(key, { comment: e.target.value })}
                xstyle={s.ruled}
              />
            </label>
            <label {...stylex.props(s.field, s.thick)}>
              <span {...stylex.props(ui.label, s.fieldLabel)}>Total time</span>
              <AutoTextarea
                value={entry.total}
                placeholder={totalMin ? formatMinutes(totalMin) : undefined}
                onChange={(e) => updateDay(key, { total: e.target.value })}
                xstyle={s.ruled}
              />
            </label>
          </div>

          <div {...stylex.props(s.body)}>
            <div {...stylex.props(s.col)}>
              <div {...stylex.props(s.labelRow)}>
                <span {...stylex.props(ui.label)}>Tasks</span>
                <span {...stylex.props(s.rule)} />
              </div>
              <div {...stylex.props(s.table)}>
                {entry.tasks.map((t, i) => (
                  <TaskRow key={i} task={t} index={i} tool={tool} routines={routines} onPatch={(patch) => updateTask(key, i, patch)} />
                ))}
              </div>
            </div>
            <div {...stylex.props(s.col, s.timeCol)}>
              <div {...stylex.props(s.labelRow)}>
                <span {...stylex.props(ui.label)}>Timeline</span>
                <span {...stylex.props(s.rule)} />
              </div>
              <Timeline
                cells={entry.cells}
                tool={tool}
                isToday={isToday}
                onChange={(cells) => updateDay(key, { cells })}
                requestPen={() => {
                  setTool(lastPen.current);
                  return lastPen.current;
                }}
              />
            </div>
          </div>

          <label {...stylex.props(s.memo)}>
            <span {...stylex.props(s.labelRow)}>
              <span {...stylex.props(ui.label)}>Memo</span>
              <span {...stylex.props(s.rule)} />
            </span>
            <AutoTextarea value={entry.memo} minRows={3} onChange={(e) => updateDay(key, { memo: e.target.value })} xstyle={s.ruled} />
          </label>
        </article>
      </div>
    </div>
  );
}
