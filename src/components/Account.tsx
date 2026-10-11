import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import {
  accountsAvailable, pendingCount, sendLoginLink, setPassword, signInWithPassword, signOut, signUpWithPassword,
  useDB, useSync, verifyLoginCode,
} from '../lib/store';
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
  code: { fontSize: 22, fontWeight: 700, letterSpacing: '0.3em', textAlign: 'center', fontVariantNumeric: 'tabular-nums' },
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
  secondary: { alignSelf: 'flex-start', marginLeft: -14, height: 36, fontSize: type.small },
  links: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  error: { fontSize: type.small, lineHeight: 1.5, color: color.ink, fontWeight: 600 },
});

const STATUS: Record<string, string> = {
  syncing: '저장하는 중',
  synced: '모든 기록이 계정에 저장됨',
  offline: '연결이 끊겼어요. 이 기기에 보관했다가 연결되면 올립니다',
  local: '',
};

const MIN_PASSWORD = 8;

/** 서버 오류를 사람이 읽을 말로 */
function explain(err: string, context: 'signin' | 'signup' | 'mail' | 'code' | 'password'): string {
  if (/fetch|network/i.test(err)) return '연결이 안 돼요. 인터넷을 확인하고 다시 눌러 주세요.';
  if (/rate|seconds|too many/i.test(err)) return '요청이 너무 잦아요. 잠시 후에 다시 시도해 주세요.';
  if (context === 'signin') {
    if (/not confirmed/i.test(err)) return '이메일 확인이 아직 안 됐어요. 아래 "메일로 로그인"으로 한 번 들어와 주세요.';
    return '이메일 또는 비밀번호가 맞지 않아요. 메일로 가입했다면 아래 "메일로 로그인"을 눌러 주세요.';
  }
  if (context === 'signup') {
    if (/already registered|already exists/i.test(err)) return '이미 가입된 이메일이에요. 로그인해 주세요.';
    if (/password/i.test(err)) return `비밀번호는 ${MIN_PASSWORD}자 이상으로 정해 주세요.`;
    if (/invalid/i.test(err)) return '이메일 주소를 다시 확인해 주세요.';
  }
  if (context === 'code') return '코드가 맞지 않거나 만료됐어요. 메일의 코드를 다시 확인해 주세요.';
  if (context === 'password' && /different|same/i.test(err)) return '지금 쓰는 것과 다른 비밀번호로 정해 주세요.';
  return `처리하지 못했어요. (${err})`;
}

type Mode = 'signin' | 'signup' | 'mail' | 'code' | 'confirm';

/** 계정: 로그인 없이 쓰다가 가입·로그인하면 그동안의 기록이 그대로 계정으로 옮겨진다. */
export function Account() {
  const sync = useSync();
  const db = useDB();
  const [open, setOpen] = useState(!!authReturnError);
  const [mode, setMode] = useState<Mode>(authReturnError ? 'mail' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPw] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(authReturnError ? '로그인 링크가 만료됐거나 이미 사용됐어요. 새 링크를 받아 주세요.' : null);
  const [right, setRight] = useState(12);
  const btn = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const r = btn.current?.getBoundingClientRect();
    if (r) setRight(Math.max(12, window.innerWidth - r.right));
    first.current?.focus();
  }, [open, mode, changing]);
  // 로그인이 끝나면 입력하던 것들을 정리한다 (비밀번호를 화면 상태에 남겨 두지 않는다)
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setPw('');
    setCode('');
    setError(null);
    setChanging(false);
    if (sync.user) setMode('signin');
  }, [sync.user]);

  if (!accountsAvailable && !(import.meta.env.DEV && !supabase)) return null;

  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };
  const go = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
    setPw('');
    setCode('');
  };
  const run = async (fn: () => Promise<string | null>, context: Parameters<typeof explain>[1]) => {
    setBusy(true);
    setError(null);
    const err = await fn();
    setBusy(false);
    if (err) setError(explain(err, context));
    return !err;
  };
  const localCount = Object.keys(db.days).length + Object.keys(db.years).length;
  const carry =
    localCount > 0 ? '지금까지 쓴 기록은 이 기기에만 있어요. 로그인하면 그대로 계정으로 옮겨집니다.' : '로그인하면 기록이 계정에 저장돼 다른 기기에서도 이어집니다.';

  const emailField = (
    <input
      ref={first}
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
  );
  const errorLine = error && (
    <p role="alert" {...stylex.props(s.error)}>
      {error}
    </p>
  );
  const link = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} {...stylex.props(ui.textButton, s.secondary)}>
      {label}
    </button>
  );

  let content;
  if (!supabase) {
    content = (
      <>
        <p {...stylex.props(s.title)}>계정 연결이 필요해요</p>
        <p {...stylex.props(s.text)}>
          .env.local 에 Supabase 주소와 공개 키를 넣으면 로그인이 켜집니다. 지금은 이 기기에만 저장돼요. (README 참고)
        </p>
      </>
    );
  } else if (sync.user) {
    content = (
      <>
        <p {...stylex.props(s.title)}>{sync.user.email}</p>
        <p {...stylex.props(s.text)} role="status">
          {notice ?? STATUS[sync.status]}
        </p>
        {changing ? (
          <form
            {...stylex.props(s.form)}
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => setPassword(password), 'password')) {
                setChanging(false);
                setPw('');
                setNotice('비밀번호를 저장했어요. 다음부터는 이메일과 비밀번호로 바로 로그인됩니다.');
              }
            }}
          >
            <input
              ref={first}
              type="password"
              required
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              placeholder={`새 비밀번호 (${MIN_PASSWORD}자 이상)`}
              aria-label="새 비밀번호"
              value={password}
              onChange={(e) => setPw(e.target.value)}
              {...stylex.props(s.input)}
            />
            <button type="submit" disabled={busy} {...stylex.props(s.primary)}>
              {busy ? '저장하는 중…' : '비밀번호 저장'}
            </button>
            {errorLine}
            {link('취소', () => {
              setChanging(false);
              setPw('');
              setError(null);
            })}
          </form>
        ) : (
          <div {...stylex.props(s.links)}>
            {link('비밀번호 설정 · 변경', () => {
              setChanging(true);
              setNotice(null);
              setError(null);
            })}
            {link('로그아웃', async () => {
              await signOut();
              if (pendingCount() > 0) setError('아직 올리지 못한 기록이 있어 이 기기에 남겨 뒀어요. 다시 로그인하면 이어서 올라갑니다.');
              else close();
            })}
            {errorLine}
          </div>
        )}
      </>
    );
  } else if (mode === 'signin' || mode === 'signup') {
    const signup = mode === 'signup';
    content = (
      <form
        {...stylex.props(s.form)}
        onSubmit={async (e) => {
          e.preventDefault();
          const mail = email.trim();
          if (!signup) {
            await run(() => signInWithPassword(mail, password), 'signin');
            return;
          }
          let confirm = false;
          const ok = await run(async () => {
            const r = await signUpWithPassword(mail, password);
            confirm = r.confirm;
            return r.error;
          }, 'signup');
          if (ok && confirm) go('confirm');
        }}
      >
        <p {...stylex.props(s.title)}>{signup ? '가입' : '로그인'}</p>
        <p {...stylex.props(s.text)}>{signup ? `이메일과 비밀번호만 정하면 바로 시작돼요. ${localCount > 0 ? '지금까지 쓴 기록도 그대로 계정에 담깁니다.' : ''}` : carry}</p>
        {emailField}
        <input
          type="password"
          required
          minLength={signup ? MIN_PASSWORD : undefined}
          autoComplete={signup ? 'new-password' : 'current-password'}
          placeholder={signup ? `비밀번호 (${MIN_PASSWORD}자 이상)` : '비밀번호'}
          aria-label="비밀번호"
          value={password}
          onChange={(e) => setPw(e.target.value)}
          {...stylex.props(s.input)}
        />
        <button type="submit" disabled={busy} {...stylex.props(s.primary)}>
          {busy ? '확인하는 중…' : signup ? '가입하고 시작하기' : '로그인'}
        </button>
        {errorLine}
        <div {...stylex.props(s.links)}>
          {signup ? link('이미 계정이 있어요 · 로그인', () => go('signin')) : link('처음이에요 · 가입하기', () => go('signup'))}
          {!signup && link('비밀번호 없이 메일로 로그인', () => go('mail'))}
        </div>
      </form>
    );
  } else if (mode === 'mail') {
    content = (
      <form
        {...stylex.props(s.form)}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => sendLoginLink(email.trim()), 'mail')) go('code');
        }}
      >
        <p {...stylex.props(s.title)}>메일로 로그인</p>
        <p {...stylex.props(s.text)}>
          비밀번호를 잊었거나 정한 적이 없을 때 써요. 메일로 받은 링크나 코드로 들어온 뒤, 계정 메뉴에서 비밀번호를 새로 정할 수 있어요.
        </p>
        {emailField}
        <button type="submit" disabled={busy} {...stylex.props(s.primary)}>
          {busy ? '보내는 중…' : '로그인 메일 받기'}
        </button>
        {errorLine}
        <div {...stylex.props(s.links)}>
          {link('이미 받은 코드 입력하기', () => {
            if (first.current?.reportValidity()) go('code');
          })}
          {link('비밀번호로 로그인', () => go('signin'))}
        </div>
      </form>
    );
  } else if (mode === 'code') {
    content = (
      <form
        {...stylex.props(s.form)}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!(await run(() => verifyLoginCode(email.trim(), code.trim()), 'code'))) first.current?.select();
        }}
      >
        <p {...stylex.props(s.title)}>메일함을 확인해 주세요</p>
        <p {...stylex.props(s.text)}>
          <span {...stylex.props(s.strong)}>{email}</span> 으로 보낸 메일의 링크를 누르거나, 메일에 적힌 코드를 여기에 입력하세요.
        </p>
        <input
          ref={first}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,8}"
          maxLength={8}
          required
          placeholder="코드"
          aria-label="메일로 받은 로그인 코드"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          {...stylex.props(s.input, s.code)}
        />
        <button type="submit" disabled={busy || code.length < 6} {...stylex.props(s.primary)}>
          {busy ? '확인하는 중…' : '코드로 로그인'}
        </button>
        {errorLine}
        {link('다른 이메일로 받기', () => go('mail'))}
      </form>
    );
  } else {
    content = (
      <>
        <p {...stylex.props(s.title)}>메일 확인이 한 번 필요해요</p>
        <p {...stylex.props(s.text)}>
          <span {...stylex.props(s.strong)}>{email}</span> 으로 확인 메일을 보냈어요. 메일의 링크를 누르면 가입이 끝나고 바로 로그인됩니다.
        </p>
        {link('로그인 화면으로', () => go('signin'))}
      </>
    );
  }

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
            {content}
          </div>
        </>
      )}
    </>
  );
}
