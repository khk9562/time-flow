import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import { accountsAvailable, pendingCount, sendLoginLink, signOut, useDB, useSync } from '../lib/store';
import { authReturnError, supabase } from '../lib/supabase';
import { color, dur, ease, radius, type } from '../tokens.stylex';
import { ui } from './ui';

const cardIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(-8px) scale(0.96)' },
  to: { opacity: 1, transform: 'translateY(0) scale(1)' },
});
const breathe = stylex.keyframes({
  '0%': { opacity: 1 },
  '50%': { opacity: 0.3 },
  '100%': { opacity: 1 },
});

const s = stylex.create({
  trigger: { height: 32, paddingInline: 10, fontSize: type.small, gap: 7, marginLeft: 4 },
  dot: { width: 7, height: 7, borderRadius: '50%', backgroundColor: color.ink, flexShrink: 0 },
  dotBusy: { animationName: breathe, animationDuration: '1.2s', animationIterationCount: 'infinite' },
  dotOff: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'solid', borderColor: color.ink },
  email: { maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis' },
  scrim: { position: 'fixed', inset: 0, zIndex: 20 },
  card: {
    position: 'fixed',
    zIndex: 21,
    top: 54,
    width: 'min(340px, calc(100vw - 24px))',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 20,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    borderRadius: radius.control,
    boxShadow: '0 30px 70px -30px rgb(0 0 0 / 0.6)',
    transformOrigin: '80% 0',
    animationName: cardIn,
    animationDuration: dur.quick,
    animationTimingFunction: ease.out,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  title: { fontSize: type.body, fontWeight: 800 },
  text: { fontSize: type.small, lineHeight: 1.6, color: color.inkSoft },
  strong: { color: color.ink, fontWeight: 700 },
  input: {
    height: 44,
    paddingInline: 12,
    fontSize: type.body,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.line, ':focus': color.ink },
    backgroundColor: color.wash,
    '::placeholder': { color: color.inkFaint },
  },
  primary: {
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: color.ink,
    color: color.inverse,
    fontSize: type.body,
    fontWeight: 700,
    opacity: { default: 1, ':disabled': 0.45 },
    cursor: { default: 'pointer', ':disabled': 'default' },
    transitionProperty: 'transform, opacity',
    transitionDuration: dur.tap,
    transform: { default: 'none', ':active': 'scale(0.97)' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: color.ink,
    outlineOffset: 3,
  },
  secondary: { alignSelf: 'flex-start', marginLeft: -14 },
  error: { fontSize: type.small, lineHeight: 1.5, color: color.ink, fontWeight: 600 },
});

const STATUS: Record<string, string> = {
  syncing: '저장하는 중',
  synced: '모든 기록이 계정에 저장됨',
  offline: '연결이 끊겼어요. 이 기기에 보관했다가 연결되면 올립니다',
  local: '',
};

/** 계정: 로그인 없이 쓰다가 로그인하면 그동안의 기록이 그대로 계정으로 옮겨진다. */
export function Account() {
  const sync = useSync();
  const db = useDB();
  const [open, setOpen] = useState(!!authReturnError);
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(authReturnError ? '로그인 링크가 만료됐거나 이미 사용됐어요. 새 링크를 받아 주세요.' : null);
  const [right, setRight] = useState(12);
  const btn = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const r = btn.current?.getBoundingClientRect();
    if (r) setRight(Math.max(12, window.innerWidth - r.right));
    input.current?.focus();
  }, [open]);
  // 로그인이 끝나면 '메일 보냄' 상태를 정리한다
  useEffect(() => {
    if (sync.user) {
      setPhase('idle');
      setError(null);
    }
  }, [sync.user]);

  if (!accountsAvailable && !(import.meta.env.DEV && !supabase)) return null;

  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };
  const localCount = Object.keys(db.days).length + Object.keys(db.years).length;

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        {...stylex.props(ui.textButton, s.trigger)}
      >
        {sync.user ? (
          <>
            <span aria-hidden {...stylex.props(s.dot, sync.status === 'syncing' && s.dotBusy, sync.status === 'offline' && s.dotOff)} />
            <span {...stylex.props(s.email)}>{sync.user.email.split('@')[0]}</span>
          </>
        ) : (
          '로그인'
        )}
      </button>

      {open && (
        <>
          <div {...stylex.props(s.scrim)} onClick={close} />
          <div
            role="dialog"
            aria-label="계정"
            {...stylex.props(s.card)}
            style={{ right }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                close();
              }
            }}
          >
            {!supabase ? (
              <>
                <p {...stylex.props(s.title)}>계정 연결이 필요해요</p>
                <p {...stylex.props(s.text)}>
                  .env.local 에 Supabase 주소와 공개 키를 넣으면 로그인이 켜집니다. 지금은 이 기기에만 저장돼요. (README 참고)
                </p>
              </>
            ) : sync.user ? (
              <>
                <p {...stylex.props(s.title)}>{sync.user.email}</p>
                <p {...stylex.props(s.text)} role="status">
                  {STATUS[sync.status]}
                </p>
                <button
                  type="button"
                  {...stylex.props(ui.textButton, s.secondary)}
                  onClick={async () => {
                    await signOut();
                    if (pendingCount() > 0) setError('아직 올리지 못한 기록이 있어 이 기기에 남겨 뒀어요. 다시 로그인하면 이어서 올라갑니다.');
                    else close();
                  }}
                >
                  로그아웃
                </button>
                {error && <p {...stylex.props(s.error)}>{error}</p>}
              </>
            ) : phase === 'sent' ? (
              <>
                <p {...stylex.props(s.title)}>메일함을 확인해 주세요</p>
                <p {...stylex.props(s.text)}>
                  <span {...stylex.props(s.strong)}>{email}</span> 으로 로그인 링크를 보냈어요. 링크를 누르면 바로 로그인되고,
                  지금까지 쓴 기록은 그대로 계정에 담깁니다.
                </p>
                <button type="button" {...stylex.props(ui.textButton, s.secondary)} onClick={() => setPhase('idle')}>
                  다른 이메일로 받기
                </button>
              </>
            ) : (
              <form
                {...stylex.props(s.form)}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setPhase('sending');
                  setError(null);
                  const err = await sendLoginLink(email.trim());
                  if (err) {
                    setError(
                      /rate|seconds/i.test(err)
                        ? '방금 보냈어요. 잠시 후에 다시 시도해 주세요.'
                        : /fetch|network/i.test(err)
                          ? '연결이 안 돼요. 인터넷을 확인하고 다시 눌러 주세요.'
                          : `링크를 보내지 못했어요. (${err})`,
                    );
                    setPhase('idle');
                  } else setPhase('sent');
                }}
              >
                <p {...stylex.props(s.title)}>로그인 · 가입</p>
                <p {...stylex.props(s.text)}>
                  {localCount > 0
                    ? '지금까지 쓴 기록은 이 기기에만 있어요. 로그인하면 그대로 계정으로 옮겨져 다른 기기에서도 이어집니다.'
                    : '로그인하면 기록이 계정에 저장돼 다른 기기에서도 이어집니다.'}{' '}
                  비밀번호 없이 이메일로 받은 링크만 누르면 돼요.
                </p>
                <input
                  ref={input}
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="이메일 주소"
                  aria-label="이메일 주소"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  {...stylex.props(s.input)}
                />
                <button type="submit" disabled={phase === 'sending'} {...stylex.props(s.primary)}>
                  {phase === 'sending' ? '보내는 중…' : '로그인 링크 받기'}
                </button>
                {error && (
                  <p role="alert" {...stylex.props(s.error)}>
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </>
      )}
    </>
  );
}
