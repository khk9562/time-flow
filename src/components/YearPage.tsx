import * as stylex from '@stylexjs/stylex';
import { useMemo, useState } from 'react';
import { emptyYear, getYearPlan, newGoal, updateYearPlan, useDB, type Goal } from '../lib/store';
import { now } from '../lib/time';
import { color, dur, ease, type } from '../tokens.stylex';
import { FlowBar } from './FlowBar';
import { AutoTextarea, Check, ui, useMedia } from './ui';
import { YearMap } from './YearMap';

const MAX_GOALS = 5;

const rise = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(28px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});
const wave = stylex.keyframes({
  from: { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0.7 },
  to: { transform: 'translate(-50%, -50%) scale(16)', opacity: 0 },
});

const s = stylex.create({
  root: {
    position: 'fixed',
    inset: 0,
    zIndex: 5,
    paddingTop: 'env(safe-area-inset-top)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    transitionProperty: 'opacity, transform',
    transitionDuration: dur.quick,
    transitionTimingFunction: ease.out,
  },
  leaving: { opacity: 0, transform: 'translateY(16px)', pointerEvents: 'none' },
  wave: {
    position: 'fixed',
    width: 200,
    height: 200,
    borderRadius: '50%',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.ink,
    pointerEvents: 'none',
    animationName: wave,
    animationDuration: '1100ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
  },
  top: { display: 'flex', alignItems: 'center', height: 64, paddingTop: 12, paddingInline: 10 },
  grid: {
    display: 'grid',
    gridTemplateColumns: { default: 'minmax(0, 5fr) minmax(0, 6fr)', '@media (max-width: 860px)': 'minmax(0, 1fr)' },
    columnGap: 'clamp(28px, 5vw, 80px)',
    rowGap: 40,
    maxWidth: 1280,
    marginInline: 'auto',
    paddingInline: 'clamp(20px, 4vw, 56px)',
    paddingTop: 8,
    paddingBottom: 'max(40px, env(safe-area-inset-bottom))',
  },
  col: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  enter: { animationName: rise, animationDuration: '760ms', animationTimingFunction: ease.out, animationFillMode: 'both' },
  year: {
    fontSize: 'clamp(88px, 15vw, 210px)',
    fontWeight: 900,
    lineHeight: 0.8,
    letterSpacing: '-0.03em',
    marginLeft: '-0.04em',
  },
  bar: { height: 10, marginTop: 22, marginBottom: 30 },
  motto: {
    fontSize: 'clamp(20px, 2.4vw, 30px)',
    fontWeight: 700,
    lineHeight: 1.4,
    paddingBlock: 6,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: { default: color.line, ':focus': color.ink },
    '::placeholder': { color: color.inkFaint },
  },
  section: { marginTop: 34 },
  goalsHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, marginTop: 8 },
  count: { fontSize: type.small, color: color.inkSoft, fontVariantNumeric: 'tabular-nums' },
  goal: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    columnGap: 14,
    paddingBlock: 16,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: color.line,
  },
  goalNo: { fontSize: 34, fontWeight: 200, lineHeight: '44px', fontVariantNumeric: 'tabular-nums', color: color.inkSoft, minWidth: 44 },
  goalMain: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  title: {
    width: '100%',
    height: 44,
    fontSize: type.title,
    fontWeight: 700,
    '::placeholder': { color: color.inkFaint },
  },
  titleDone: { color: color.inkSoft, textDecorationLine: 'line-through' },
  stepRow: { display: 'flex', alignItems: 'center', gap: 10 },
  step: {
    flexGrow: 1,
    minWidth: 0,
    height: 32,
    fontSize: type.body,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: { default: color.line, ':focus': color.ink },
    '::placeholder': { color: color.inkFaint },
  },
  months: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  month: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    fontSize: 11.5,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    color: color.inkSoft,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    backgroundColor: { default: 'transparent', ':hover': color.wash },
    transitionProperty: 'background-color, color, transform, border-color',
    transitionDuration: dur.quick,
    transitionTimingFunction: ease.spring,
    transform: { default: 'none', ':active': 'scale(0.86)' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: 2,
  },
  monthOn: { backgroundColor: { default: color.ink, ':hover': color.ink }, borderColor: color.ink, color: color.inverse },
  side: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  remove: { fontSize: 18, color: color.inkSoft },
  confirm: { fontSize: type.small, fontWeight: 700, width: 'auto', paddingInline: 12 },
  add: { alignSelf: 'flex-start', marginTop: 8, marginLeft: -14 },
  note: { fontSize: type.small, color: color.inkSoft, marginTop: 10 },
});

type Props = {
  year: number;
  origin: { x: number; y: number } | null;
  leaving: boolean;
  onClose: () => void;
  onOpenDay: (month: number, day: number) => void;
};

export function YearPage({ year, origin, leaving, onClose, onOpenDay }: Props) {
  const db = useDB();
  const draft = useMemo(emptyYear, [year]);
  const plan = getYearPlan(db, year) ?? draft;
  const [confirm, setConfirm] = useState<string | null>(null);
  // 휴대폰에서는 365개의 점이 너무 작아 누를 수 없다. 날짜는 메인 화면에서 달을 골라 들어간다
  const phone = useMedia('(max-width: 560px)');

  const patchGoal = (id: string, patch: Partial<Goal>) =>
    updateYearPlan(year, { ...plan, goals: plan.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  const removeGoal = (g: Goal) => {
    const hasText = g.title.trim() || g.step.trim();
    if (hasText && confirm !== g.id) {
      setConfirm(g.id);
      window.setTimeout(() => setConfirm((c) => (c === g.id ? null : c)), 3200);
      return;
    }
    setConfirm(null);
    const goals = plan.goals.filter((x) => x.id !== g.id);
    updateYearPlan(year, { ...plan, goals: goals.length ? goals : [newGoal()] });
  };
  const yearProg = () => {
    const a = new Date(year, 0, 1).getTime();
    const b = new Date(year + 1, 0, 1).getTime();
    return Math.max(0, Math.min(1, (now().getTime() - a) / (b - a)));
  };
  const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

  return (
    <div role="dialog" aria-modal="true" aria-label={`${year}년 계획`} {...stylex.props(s.root, leaving && s.leaving)}>
      {origin && !leaving && <span aria-hidden {...stylex.props(s.wave)} style={{ left: origin.x, top: origin.y }} />}
      <div {...stylex.props(s.top)}>
        <button type="button" onClick={onClose} aria-label="메인 화면으로 돌아가기" {...stylex.props(ui.iconButton, ui.navButton)}>
          ←
        </button>
      </div>

      <div {...stylex.props(s.grid)}>
        <div {...stylex.props(s.col)}>
          <h2 {...stylex.props(s.year, s.enter)} style={delay(80)}>
            {year}
          </h2>
          <div {...stylex.props(s.bar, s.enter)} style={delay(160)}>
            <FlowBar progress={yearProg} />
          </div>
          <label {...stylex.props(s.col, s.enter)} style={delay(240)}>
            <span {...stylex.props(ui.label)}>올해의 한 문장</span>
            <AutoTextarea
              value={plan.motto}
              placeholder="올해를 한 문장으로 적는다면"
              onChange={(e) => updateYearPlan(year, { ...plan, motto: e.target.value })}
              xstyle={s.motto}
            />
          </label>
          {!phone && (
            <div {...stylex.props(s.section, s.enter)} style={delay(340)}>
              <span {...stylex.props(ui.label)}>365일</span>
              <YearMap year={year} onOpenDay={onOpenDay} />
            </div>
          )}
        </div>

        <div {...stylex.props(s.col)}>
          <div {...stylex.props(s.goalsHead, s.enter)} style={delay(200)}>
            <span {...stylex.props(ui.label)}>목표</span>
            <span {...stylex.props(s.count)}>
              {plan.goals.length} / {MAX_GOALS}
            </span>
          </div>
          {plan.goals.map((g, i) => (
            <div key={g.id} {...stylex.props(s.goal, s.enter)} style={delay(260 + i * 70)}>
              <span aria-hidden {...stylex.props(s.goalNo)}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div {...stylex.props(s.goalMain)}>
                <input
                  value={g.title}
                  placeholder={i === 0 ? '올해 꼭 이루고 싶은 것 하나' : '목표'}
                  aria-label={`목표 ${i + 1}`}
                  onChange={(e) => patchGoal(g.id, { title: e.target.value })}
                  {...stylex.props(s.title, g.done && s.titleDone)}
                />
                <label {...stylex.props(s.stepRow)}>
                  <span {...stylex.props(ui.label)}>첫 걸음</span>
                  <input
                    value={g.step}
                    placeholder="5분 안에 시작할 수 있는 가장 작은 행동"
                    onChange={(e) => patchGoal(g.id, { step: e.target.value })}
                    {...stylex.props(s.step)}
                  />
                </label>
                <div role="group" aria-label="집중할 달" {...stylex.props(s.months)}>
                  {g.months.map((on, m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${m + 1}월`}
                      onClick={() => patchGoal(g.id, { months: g.months.map((v, k) => (k === m ? !v : v)) })}
                      {...stylex.props(s.month, on && s.monthOn)}
                    >
                      {m + 1}
                    </button>
                  ))}
                </div>
              </div>
              <div {...stylex.props(s.side)}>
                <Check checked={g.done} onChange={(v) => patchGoal(g.id, { done: v })} label={`목표 ${i + 1} 달성`} variant="round" />
                <button
                  type="button"
                  aria-label={confirm === g.id ? `목표 ${i + 1} 정말 지우기` : `목표 ${i + 1} 지우기`}
                  onClick={() => removeGoal(g)}
                  {...stylex.props(ui.iconButton, s.remove, confirm === g.id && s.confirm)}
                >
                  {confirm === g.id ? '지울까요?' : '×'}
                </button>
              </div>
            </div>
          ))}
          {plan.goals.length < MAX_GOALS ? (
            <button
              type="button"
              onClick={() => updateYearPlan(year, { ...plan, goals: [...plan.goals, newGoal()] })}
              {...stylex.props(ui.textButton, s.add)}
            >
              <span aria-hidden>+</span> 목표 추가
            </button>
          ) : (
            <p {...stylex.props(s.note)}>목표는 다섯 개까지. 적을수록 끝까지 갑니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
