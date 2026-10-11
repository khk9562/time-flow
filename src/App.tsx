import * as stylex from '@stylexjs/stylex';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Account } from './components/Account';
import { AtmosphereCanvas } from './components/AtmosphereCanvas';
import { Calendar } from './components/Calendar';
import { DialZone, type YearOption } from './components/DialZone';
import { Hero } from './components/Hero';
import { PhaseBar } from './components/PhaseBar';
import { Planner } from './components/Planner';
import { useLast, usePresence } from './components/ui';
import { YearPage } from './components/YearPage';
import { useDB, yearHasData } from './lib/store';
import { isAuthHash } from './lib/supabase';
import { daysInMonth, now, useSlowNow } from './lib/time';
import { color, dur, ease } from './tokens.stylex';

const IDLE_MS = 45000;

const s = stylex.create({
  app: { position: 'relative', display: 'flex', height: '100dvh', overflow: 'hidden', color: color.ink },
  stage: {
    position: 'relative',
    zIndex: 1,
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    transitionProperty: 'opacity, transform',
    transitionDuration: dur.move,
    transitionTimingFunction: ease.out,
  },
  away: { opacity: 0, transform: 'scale(0.96)', pointerEvents: 'none' },
  top: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingTop: 12,
    paddingInline: 'clamp(12px, 2vw, 22px)',
  },
  topRight: { display: 'flex', alignItems: 'center', minWidth: 0 },
  brand: { fontWeight: 800, fontSize: 15, letterSpacing: '0.04em', paddingLeft: 8 },
  // 오른쪽 패널: 넓은 화면에서는 폭이 열리며 메인을 왼쪽으로 밀고, 좁은 화면에서는 위를 덮는다.
  panel: {
    zIndex: 2,
    flexShrink: 0,
    height: '100%',
    overflow: 'hidden',
    position: { default: 'relative', '@media (max-width: 860px)': 'fixed' },
    top: 0,
    right: 0,
    width: { default: 0, '@media (max-width: 860px)': '100vw' },
    transform: { default: 'none', '@media (max-width: 860px)': 'translateX(100%)' },
    backgroundColor: { default: 'transparent', '@media (max-width: 860px)': color.bg },
    transitionProperty: 'width, transform, opacity',
    transitionDuration: dur.stage,
    transitionTimingFunction: ease.inOut,
  },
  panelCalendar: {
    width: { default: '50vw', '@media (max-width: 860px)': '100vw' },
    transform: { default: 'none', '@media (max-width: 860px)': 'translateX(0)' },
  },
  panelPlanner: {
    width: { default: '63vw', '@media (max-width: 860px)': '100vw' },
    transform: { default: 'none', '@media (max-width: 860px)': 'translateX(0)' },
  },
  inner: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderLeftWidth: { default: 1, '@media (max-width: 860px)': 0 },
    borderLeftStyle: 'solid',
    borderLeftColor: color.line,
    transitionProperty: 'width',
    transitionDuration: dur.stage,
    transitionTimingFunction: ease.inOut,
  },
  innerCalendar: { width: { default: '50vw', '@media (max-width: 860px)': '100vw' } },
  innerPlanner: { width: { default: '63vw', '@media (max-width: 860px)': '100vw' } },
});

type View = {
  year: number;
  /** 다이얼을 만져 계획 버튼과 월 다이얼이 드러난 상태 */
  engaged: boolean;
  month: number | null;
  day: number | null;
  page: boolean;
};

function parseHash(): Partial<View> | null {
  const m = location.hash.match(/^#\/(\d{4})(?:\/(plan|\d{1,2})(?:\/(\d{1,2}))?)?$/);
  if (!m) return null;
  const year = Number(m[1]);
  if (m[2] === 'plan') return { year, page: true, month: null, day: null, engaged: true };
  const month = m[2] ? Number(m[2]) : null;
  if (month !== null && (month < 1 || month > 12)) return null;
  const day = month && m[3] ? Number(m[3]) : null;
  if (day !== null && month !== null && (day < 1 || day > daysInMonth(year, month))) return null;
  return { year, month, day, page: false, engaged: true };
}

const toHash = (v: View) =>
  v.page ? `#/${v.year}/plan` : v.month ? `#/${v.year}/${v.month}${v.day ? `/${v.day}` : ''}` : '';

export function App() {
  const db = useDB();
  const slow = useSlowNow();
  const thisYear = slow.getFullYear();

  const [view, setView] = useState<View>(() => ({
    year: now().getFullYear(),
    engaged: false,
    month: null,
    day: null,
    page: false,
    ...parseHash(),
  }));
  const [monthCursor, setMonthCursor] = useState(() => view.month ?? now().getMonth() + 1);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const activity = useRef(Date.now());

  // 올해와 내년은 언제나 쓸 수 있고, 지난 해는 기록이 있을 때만 열린다.
  const years: YearOption[] = useMemo(() => {
    const list: YearOption[] = [];
    for (let y = thisYear - 6; y <= thisYear + 3; y++) {
      const hasData = yearHasData(db, y);
      list.push({ year: y, hasData, enabled: hasData || y === thisYear || y === thisYear + 1 });
    }
    return list;
  }, [db, thisYear]);

  // 주소(#/2026/10/11) 와 화면 상태를 맞춘다: 새로고침·뒤로 가기에도 보던 곳이 유지된다.
  useEffect(() => {
    const h = toHash(view);
    // 로그인 링크로 돌아온 직후에는 해시에 토큰이 실려 있다. Supabase 가 읽고 지울 때까지 건드리지 않는다.
    if (isAuthHash(location.hash)) return;
    if (h !== location.hash) history.pushState(null, '', h || location.pathname + location.search);
  }, [view]);
  useEffect(() => {
    const onPop = () => {
      const p = parseHash();
      setView((v) => (p ? { ...v, ...p } : { ...v, month: null, day: null, page: false }));
      if (p?.month) setMonthCursor(p.month);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // 아무것도 고르지 않고 한동안 두면 다시 시계만 남는다.
  useEffect(() => {
    if (!view.engaged || view.month !== null || view.page) return;
    activity.current = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - activity.current > IDLE_MS) setView((v) => ({ ...v, engaged: false }));
    }, 2000);
    return () => clearInterval(id);
  }, [view.engaged, view.month, view.page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      // 글을 쓰던 중이라면 한 단계 뒤로 가지 않고 입력만 끝낸다
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.blur();
        return;
      }
      setView((v) => {
        if (v.page) return { ...v, page: false };
        if (v.day !== null) return { ...v, day: null };
        if (v.month !== null) return { ...v, month: null };
        return { ...v, engaged: false };
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const stepMonth = (delta: number) => {
    const d = new Date(view.year, (view.month ?? monthCursor) - 1 + delta, 1);
    const y = d.getFullYear();
    if (!years.find((o) => o.year === y)?.enabled) return;
    setMonthCursor(d.getMonth() + 1);
    setView((v) => ({ ...v, year: y, month: d.getMonth() + 1, day: null }));
  };
  const stepDay = (delta: number) => {
    if (view.month === null || view.day === null) return;
    const d = new Date(view.year, view.month - 1, view.day + delta);
    const y = d.getFullYear();
    if (!years.find((o) => o.year === y)?.enabled) return;
    setMonthCursor(d.getMonth() + 1);
    setView((v) => ({ ...v, year: y, month: d.getMonth() + 1, day: d.getDate() }));
  };

  const kind = view.day !== null && view.month !== null ? 'planner' : view.month !== null ? 'calendar' : null;
  const lastKind = useLast(kind);
  const panelOpen = kind !== null;
  const cal = usePresence(kind === 'calendar', 900);
  const plan = usePresence(kind === 'planner', 900);
  const page = usePresence(view.page, 320);
  const shownMonth = useLast(view.month) ?? monthCursor;
  const shownDay = useLast(view.day) ?? 1;

  return (
    <div {...stylex.props(s.app)}>
      <AtmosphereCanvas />

      <main {...stylex.props(s.stage, view.page && s.away)} inert={view.page}>
        <header {...stylex.props(s.top)}>
          <span {...stylex.props(s.brand)}>흐름</span>
          <div {...stylex.props(s.topRight)}>
            <PhaseBar />
            <Account />
          </div>
        </header>
        <Hero />
        <DialZone
          years={years}
          year={view.year}
          engaged={view.engaged}
          month={view.month}
          monthCursor={monthCursor}
          onActivity={() => {
            activity.current = Date.now();
          }}
          onYear={(year) => setView((v) => ({ ...v, year, engaged: true, day: null }))}
          onYearTap={() => setView((v) => (v.engaged && v.month === null ? { ...v, engaged: false } : { ...v, engaged: true }))}
          onMonth={(month) => {
            setMonthCursor(month);
            setView((v) => ({ ...v, month, day: null, engaged: true }));
          }}
          onOpenPlan={(o) => {
            setOrigin(o);
            setView((v) => ({ ...v, page: true }));
          }}
        />
      </main>

      <aside
        aria-label={kind === 'planner' ? '일일 플래너' : '달력'}
        inert={!panelOpen || view.page}
        {...stylex.props(
          s.panel,
          kind === 'calendar' && s.panelCalendar,
          kind === 'planner' && s.panelPlanner,
          view.page && s.away,
        )}
      >
        <div {...stylex.props(s.inner, lastKind === 'planner' ? s.innerPlanner : s.innerCalendar)}>
          {cal.mounted && (
            <Calendar
              year={view.year}
              month={shownMonth}
              leaving={cal.leaving && panelOpen}
              onPick={(day) => setView((v) => ({ ...v, day }))}
              onClose={() => setView((v) => ({ ...v, month: null, day: null }))}
              onStep={stepMonth}
            />
          )}
          {plan.mounted && (
            <Planner
              year={view.year}
              month={shownMonth}
              day={shownDay}
              leaving={plan.leaving && panelOpen}
              onBack={() => setView((v) => ({ ...v, day: null }))}
              onStep={stepDay}
            />
          )}
        </div>
      </aside>

      {page.mounted && (
        <YearPage
          year={view.year}
          origin={origin}
          leaving={page.leaving}
          onClose={() => setView((v) => ({ ...v, page: false }))}
          onOpenDay={(month, day) => {
            setMonthCursor(month);
            setView((v) => ({ ...v, page: false, engaged: true, month, day }));
          }}
        />
      )}
    </div>
  );
}
