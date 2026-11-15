import * as stylex from '@stylexjs/stylex';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { color, ease, type } from '../tokens.stylex';
import { NO_SWIPE, ui, usePresence } from './ui';

/*
 * 바텀시트 / 드로어.
 * 알림(alert)이나 단순 확인(confirm)이 아닌 떠 있는 UI 는 모두 이것으로 띄운다.
 *  - 휴대폰(≤560px): 아래에서 올라오는 바텀시트. 손잡이나 머리를 끌어 내리면 닫힌다.
 *  - 넓은 화면: 오른쪽에서 밀려 들어오는 드로어.
 * 열고 닫을 때 모두 움직임이 있고, Esc·바깥 누르기로 닫히며, 닫히면 열었던 버튼으로 초점이 돌아간다.
 */

const PHONE = '@media (max-width: 560px)';
const EXIT_MS = 300;
const CLOSE_DRAG = 90;

const scrimIn = stylex.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const scrimOut = stylex.keyframes({ from: { opacity: 1 }, to: { opacity: 0 } });
const sheetIn = stylex.keyframes({ from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } });
const sheetOut = stylex.keyframes({ from: { transform: 'translateY(0)' }, to: { transform: 'translateY(100%)' } });
const drawerIn = stylex.keyframes({ from: { transform: 'translateX(104%)' }, to: { transform: 'translateX(0)' } });
const drawerOut = stylex.keyframes({ from: { transform: 'translateX(0)' }, to: { transform: 'translateX(104%)' } });
const itemIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(10px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

const s = stylex.create({
  scrim: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    backgroundColor: 'rgb(0 0 0 / 0.38)',
    animationName: scrimIn,
    animationDuration: '280ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
  },
  scrimOut: { animationName: scrimOut, animationDuration: `${EXIT_MS}ms` },
  panel: {
    position: 'fixed',
    zIndex: 61,
    display: 'flex',
    flexDirection: 'column',
    top: { default: 0, [PHONE]: 'auto' },
    right: 0,
    bottom: 0,
    left: { default: 'auto', [PHONE]: 0 },
    width: { default: 'min(400px, 92vw)', [PHONE]: '100%' },
    maxHeight: { default: 'none', [PHONE]: 'calc(100dvh - 48px - env(safe-area-inset-top))' },
    backgroundColor: color.surface,
    borderColor: color.line,
    borderStyle: 'solid',
    borderWidth: { default: '0 0 0 1px', [PHONE]: '1px 0 0' },
    borderRadius: { default: '18px 0 0 18px', [PHONE]: '22px 22px 0 0' },
    boxShadow: { default: '-30px 0 70px -40px rgb(0 0 0 / 0.55)', [PHONE]: '0 -20px 60px -30px rgb(0 0 0 / 0.5)' },
    animationName: { default: drawerIn, [PHONE]: sheetIn },
    animationDuration: '460ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
    willChange: 'transform',
  },
  panelOut: {
    animationName: { default: drawerOut, [PHONE]: sheetOut },
    animationDuration: `${EXIT_MS}ms`,
    animationTimingFunction: ease.inOut,
  },
  // 끌기는 transform(등장 애니메이션)과 겹치지 않게 translate 로 따로 움직인다
  settle: { transitionProperty: 'translate', transitionDuration: '360ms', transitionTimingFunction: ease.spring },
  grip: {
    display: { default: 'none', [PHONE]: 'flex' },
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    height: 22,
    '::before': { content: '""', width: 40, height: 4, borderRadius: 2, backgroundColor: color.line },
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    paddingTop: { default: 'calc(14px + env(safe-area-inset-top))', [PHONE]: 2 },
    paddingBottom: 6,
    paddingInline: '22px 10px',
    touchAction: { default: 'auto', [PHONE]: 'none' },
  },
  titles: { display: 'flex', flexDirection: 'column', gap: 3, flexGrow: 1, minWidth: 0 },
  title: { fontSize: 19, fontWeight: 800 },
  sub: { fontSize: type.small, color: color.inkSoft },
  body: {
    flexGrow: 1,
    minHeight: 0,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    paddingInline: { default: 14, [PHONE]: 12 },
    paddingTop: 6,
    paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
  },
});

/** 시트 안의 목록 항목이 차례로 떠오르게 할 때 쓰는 스타일 */
export const sheetItem = stylex.create({
  enter: {
    animationName: itemIn,
    animationDuration: '420ms',
    animationTimingFunction: ease.out,
    animationFillMode: 'both',
  },
});

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function Sheet({ open, onClose, title, subtitle, children }: Props) {
  const { mounted, leaving } = usePresence(open, EXIT_MS);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const drag = useRef<null | { id: number; y0: number; dy: number }>(null);
  const [dy, setDy] = useState(0);
  const [settling, setSettling] = useState(false);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    setDy(0);
    setSettling(false);
    opener.current = document.activeElement;
    const id = requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>('[data-autofocus], button, [href], input');
      first?.focus({ preventScroll: true });
    });
    // 가장 먼저 받아서 삼킨다: 시트를 닫는 Esc 가 화면의 "한 단계 뒤로"까지 일으키지 않게
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      close.current();
    };
    window.addEventListener('keydown', key, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('keydown', key, true);
      if (opener.current instanceof HTMLElement) opener.current.focus({ preventScroll: true });
    };
  }, [open]);

  if (!mounted) return null;

  // 휴대폰: 머리 부분을 끌어 내리면 손가락을 따라오고, 충분히 내리면 닫힌다
  const dragHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!window.matchMedia('(max-width: 560px)').matches || (e.target as Element).closest('button')) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id: e.pointerId, y0: e.clientY, dy: 0 };
      setSettling(false);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      // 위로 당기면 살짝만 늘어난다
      const raw = e.clientY - d.y0;
      d.dy = raw > 0 ? raw : raw * 0.2;
      setDy(d.dy);
    },
    onPointerUp: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      drag.current = null;
      if (d.dy > CLOSE_DRAG) {
        onClose();
        return;
      }
      setSettling(true);
      setDy(0);
    },
    onPointerCancel: () => {
      drag.current = null;
      setSettling(true);
      setDy(0);
    },
  };

  return createPortal(
    <>
      {/* 포털이어도 React 이벤트는 여는 쪽으로 거슬러 오르므로, 시트 안의 손짓이 화면 넘기기가 되지 않게 막는다 */}
      <div aria-hidden {...NO_SWIPE} onClick={onClose} {...stylex.props(s.scrim, leaving && s.scrimOut)} />
      <div
        ref={panel}
        {...NO_SWIPE}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...stylex.props(s.panel, leaving && s.panelOut, settling && s.settle)}
        style={{ translate: `0 ${dy}px` }}
      >
        <div aria-hidden {...stylex.props(s.grip)} {...dragHandlers} />
        <div {...stylex.props(s.head)} {...dragHandlers}>
          <div {...stylex.props(s.titles)}>
            <span id={titleId} {...stylex.props(s.title)}>
              {title}
            </span>
            {subtitle && <span {...stylex.props(s.sub)}>{subtitle}</span>}
          </div>
          <button type="button" aria-label="닫기" onClick={onClose} {...stylex.props(ui.iconButton)}>
            ×
          </button>
        </div>
        <div {...stylex.props(s.body)}>{children}</div>
      </div>
    </>,
    document.body,
  );
}
