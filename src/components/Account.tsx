import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { atmosphere, atmosphereSnapshot, phaseOf, subscribeAtmosphere } from '../lib/atmosphere';
import {
  accountsAvailable, NO_ACCOUNT, passwordPending, pendingCount, pendingEmail, sendEmailCode, setPassword, signInWithPassword, signOut,
  useDB, useSync, verifyEmailCode, type CodePurpose,
} from '../lib/store';
import { MAX_PASSWORD, MIN_PASSWORD, passwordOk, passwordRules } from '../lib/password';
import { authReturnError, supabase } from '../lib/supabase';
import { color, dur, ease, radius, type } from '../tokens.stylex';
import { PhaseIcon } from './PhaseIcon';
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
  // 로그인하면 아이디 대신 지금 시간대의 그림이 프로필처럼 선다. 동기화 중에는 숨 쉬고, 끊기면 흐려진다.
  avatar: { width: 40, paddingInline: 0, justifyContent: 'center' },
  busy: { animationName: breathe, animationDuration: '1.2s', animationIterationCount: 'infinite' },
  off: { opacity: 0.4 },
  scrim: { position: 'fixed', inset: 0, zIndex: 20 },
  card: {
    position: 'fixed',
    zIndex: 21,
    top: 'calc(54px + env(safe-area-inset-top))',
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
  rules: { listStyle: 'none', padding: 0, margin: 0, marginTop: -4, display: 'flex', flexDirection: 'column', gap: 2, fontSize: type.small, lineHeight: 1.5, color: color.inkFaint },
  ruleOk: { color: color.ink, fontWeight: 600 },
});

const STATUS: Record<string, string> = {
  syncing: '저장하는 중',
  synced: '모든 기록이 계정에 저장됨',
  offline: '연결이 끊겼어요. 이 기기에 보관했다가 연결되면 올립니다',
  local: '',
};

/** 서버 오류를 사람이 읽을 말로 */
function explain(err: string, context: 'signin' | 'mail' | 'code' | 'password'): string {
  if (/fetch|network/i.test(err)) return '연결이 안 돼요. 인터넷을 확인하고 다시 눌러 주세요.';
  if (/rate|seconds|too many/i.test(err)) return '요청이 너무 잦아요. 잠시 후에 다시 시도해 주세요.';
  if (context === 'signin') {
    if (/not confirmed/i.test(err)) return '메일 확인이 안 된 계정이에요. 아래 "비밀번호를 잊었어요"로 코드를 받아 확인해 주세요.';
    return '이메일 또는 비밀번호가 맞지 않아요. 비밀번호를 잊었다면 아래 "비밀번호를 잊었어요"를 눌러 주세요.';
  }
  if (context === 'mail') {
    if (err === NO_ACCOUNT) return '가입되지 않은 이메일이에요. 먼저 가입해 주세요.';
    if (/signups? not allowed|signup_disabled/i.test(err)) return '지금은 새 가입을 받지 않아요.';
    if (/invalid/i.test(err)) return '이메일 주소를 다시 확인해 주세요.';
  }
  if (context === 'code') return '코드가 맞지 않거나 만료됐어요. 메일의 코드를 다시 확인해 주세요.';
  if (context === 'password') {
    if (/different|same/i.test(err)) return '지금 쓰는 것과 다른 비밀번호로 정해 주세요.';
    if (/least|short|weak|characters/i.test(err)) return `비밀번호는 ${MIN_PASSWORD}자 이상, 영문과 숫자를 섞어 정해 주세요.`;
  }
  return `처리하지 못했어요. (${err})`;
}

type Mode = 'signin' | CodePurpose | 'code';

/** 계정: 로그인 없이 쓰다가 가입·로그인하면 그동안의 기록이 그대로 계정으로 옮겨진다. */
export function Account() {
  const sync = useSync();
  useSyncExternalStore(subscribeAtmosphere, atmosphereSnapshot);
  const phase = phaseOf(atmosphere.preview ?? atmosphere.hour);
  const db = useDB();
  const [open, setOpen] = useState(!!authReturnError);
  const [mode, setMode] = useState<Mode>('signin');
  const [purpose, setPurpose] = useState<CodePurpose>('signup');
  const [existing, setExisting] = useState(false);
  // 코드를 받아 둔 채 새로고침해도 이메일을 다시 쓰지 않게 채워 둔다
  const [email, setEmail] = useState(() => pendingEmail() ?? '');
  const [password, setPw] = useState('');
  const [password2, setPw2] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(authReturnError ? '메일의 링크가 만료됐거나 이미 사용됐어요. 코드를 다시 받아 주세요.' : null);
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
    setPw2('');
    setCode('');
    setError(null);
    setChanging(false);
    if (sync.user) setMode('signin');
    // 메일 코드로 들어왔으면 비밀번호를 정할 때까지 창을 열어 둔다 (메일의 링크로 다른 탭에서 들어온 경우 포함)
    if (sync.user && passwordPending(sync.user.email)) setOpen(true);
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
    setPw2('');
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
    // 가입·재설정에서 메일 코드를 확인한 뒤라면 비밀번호부터 정한다 (건너뛸 수 없다)
    const required = passwordPending(sync.user.email);
    const rules = passwordRules(password, sync.user.email);
    const passwordForm = (
      <form
        {...stylex.props(s.form)}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!passwordOk(password, sync.user?.email ?? '')) {
            setError('아래 비밀번호 조건을 모두 맞춰 주세요.');
            return;
          }
          if (password !== password2) {
            setError('두 비밀번호가 달라요. 다시 입력해 주세요.');
            return;
          }
          if (await run(() => setPassword(password), 'password')) {
            setChanging(false);
            setPw('');
            setPw2('');
            setNotice('비밀번호를 저장했어요. 다음부터는 이메일과 비밀번호로 로그인돼요.');
          }
        }}
      >
        <input
          ref={first}
          type="password"
          required
          maxLength={MAX_PASSWORD}
          autoComplete="new-password"
          placeholder="새 비밀번호"
          aria-label="새 비밀번호"
          aria-describedby="password-rules"
          value={password}
          onChange={(e) => setPw(e.target.value)}
          {...stylex.props(s.input)}
        />
        <ul id="password-rules" {...stylex.props(s.rules)}>
          {rules.map((r) => (
            <li key={r.label} {...stylex.props(r.ok && s.ruleOk)}>
              {r.ok ? '✓' : '·'} {r.label}
            </li>
          ))}
        </ul>
        <input
          type="password"
          required
          maxLength={MAX_PASSWORD}
          autoComplete="new-password"
          placeholder="새 비밀번호 확인"
          aria-label="새 비밀번호 확인"
          value={password2}
          onChange={(e) => setPw2(e.target.value)}
          {...stylex.props(s.input)}
        />
        <button type="submit" disabled={busy} {...stylex.props(s.primary)}>
          {busy ? '저장하는 중…' : required ? '비밀번호 저장하고 시작하기' : '비밀번호 저장'}
        </button>
        {errorLine}
        {!required &&
          link('취소', () => {
            setChanging(false);
            setPw('');
            setPw2('');
            setError(null);
          })}
      </form>
    );
    content = required ? (
      <>
        <p {...stylex.props(s.title)}>비밀번호 정하기</p>
        <p {...stylex.props(s.text)}>
          <span {...stylex.props(s.strong)}>{sync.user.email}</span> 확인이 끝났어요. 다음부터는 이 이메일과 비밀번호로 로그인해요.
        </p>
        {passwordForm}
        {link('다음에 하기 · 로그아웃', () => void signOut())}
      </>
    ) : (
      <>
        <p {...stylex.props(s.title)}>{sync.user.email}</p>
        <p {...stylex.props(s.text)} role="status">
          {notice ?? STATUS[sync.status]}
        </p>
        {changing ? (
          passwordForm
        ) : (
          <div {...stylex.props(s.links)}>
            {link('비밀번호 변경', () => {
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
  } else if (mode === 'signin') {
    content = (
      <form
        {...stylex.props(s.form)}
        onSubmit={async (e) => {
          e.preventDefault();
          await run(() => signInWithPassword(email.trim(), password), 'signin');
        }}
      >
        <p {...stylex.props(s.title)}>로그인</p>
        <p {...stylex.props(s.text)}>{carry}</p>
        {emailField}
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="비밀번호"
          aria-label="비밀번호"
          value={password}
          onChange={(e) => setPw(e.target.value)}
          {...stylex.props(s.input)}
        />
        <button type="submit" disabled={busy} {...stylex.props(s.primary)}>
          {busy ? '확인하는 중…' : '로그인'}
        </button>
        {errorLine}
        {/* 소셜 로그인(Google·카카오 등)을 붙이면 이 자리에 버튼을 둔다. DESIGN.md "계정" 참고 */}
        <div {...stylex.props(s.links)}>
          {link('처음이에요 · 가입하기', () => go('signup'))}
          {link('비밀번호를 잊었어요', () => go('reset'))}
        </div>
      </form>
    );
  } else if (mode === 'signup' || mode === 'reset') {
    const signup = mode === 'signup';
    content = (
      <form
        {...stylex.props(s.form)}
        onSubmit={async (e) => {
          e.preventDefault();
          let found = false;
          const ok = await run(async () => {
            const r = await sendEmailCode(email.trim(), mode);
            found = r.existing;
            return r.error;
          }, 'mail');
          if (ok) {
            go('code');
            setPurpose(mode);
            setExisting(found);
          }
        }}
      >
        <p {...stylex.props(s.title)}>{signup ? '가입' : '비밀번호 재설정'}</p>
        <p {...stylex.props(s.text)}>
          {signup
            ? `메일로 받은 코드로 이메일을 확인한 뒤 비밀번호를 정해요. ${localCount > 0 ? '지금까지 쓴 기록도 그대로 계정에 담깁니다.' : ''}`
            : '가입한 이메일로 코드를 보내 드려요. 코드를 확인하면 비밀번호를 새로 정할 수 있어요.'}
        </p>
        {emailField}
        <button type="submit" disabled={busy} {...stylex.props(s.primary)}>
          {busy ? '보내는 중…' : '인증 코드 받기'}
        </button>
        {errorLine}
        <div {...stylex.props(s.links)}>
          {link('이미 받은 코드 입력하기', () => {
            if (!first.current?.reportValidity()) return;
            go('code');
            setPurpose(mode);
            setExisting(false);
          })}
          {link(signup ? '이미 계정이 있어요 · 로그인' : '비밀번호로 로그인', () => go('signin'))}
        </div>
      </form>
    );
  } else {
    content = (
      <form
        {...stylex.props(s.form)}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!(await run(() => verifyEmailCode(email.trim(), code.trim()), 'code'))) first.current?.select();
        }}
      >
        <p {...stylex.props(s.title)}>메일함을 확인해 주세요</p>
        <p {...stylex.props(s.text)}>
          {purpose === 'signup' && existing && <span {...stylex.props(s.strong)}>이미 가입된 이메일이에요. </span>}
          <span {...stylex.props(s.strong)}>{email}</span> 으로 보낸 메일의 코드를 입력하세요. 확인되면{' '}
          {purpose === 'signup' && !existing ? '비밀번호를 정하고 시작해요.' : '비밀번호를 새로 정해요.'}
        </p>
        <input
          ref={first}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,8}"
          maxLength={8}
          required
          placeholder="코드"
          aria-label="메일로 받은 인증 코드"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          {...stylex.props(s.input, s.code)}
        />
        <button type="submit" disabled={busy || code.length < 6} {...stylex.props(s.primary)}>
          {busy ? '확인하는 중…' : '코드 확인'}
        </button>
        {errorLine}
        {link('코드 다시 받기 · 다른 이메일로', () => go(purpose))}
      </form>
    );
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={sync.user ? `계정 ${sync.user.email}` : undefined}
        title={sync.user?.email}
        onClick={() => setOpen((v) => !v)}
        {...stylex.props(ui.textButton, s.trigger, sync.user && s.avatar)}
      >
        {sync.user ? (
          <span {...stylex.props(sync.status === 'syncing' && s.busy, sync.status === 'offline' && s.off)}>
            <PhaseIcon id={phase.id} />
          </span>
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
