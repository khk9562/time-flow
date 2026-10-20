/**
 * 비밀번호 규칙. 가입·재설정·변경에서 같은 규칙을 쓴다.
 * 서버(Supabase → Sign In / Providers → Email)에도 같은 최소 길이와 "영문+숫자"를 걸어 둔다. README 참고.
 */
export const MIN_PASSWORD = 8;
/** bcrypt 가 72바이트까지만 보므로 Supabase 도 그 이상은 받지 않는다 */
export const MAX_PASSWORD = 72;

export type PasswordRule = { label: string; ok: boolean };

export function passwordRules(password: string, email: string): PasswordRule[] {
  const id = email.split('@')[0].toLowerCase();
  return [
    { label: `${MIN_PASSWORD}자 이상`, ok: password.length >= MIN_PASSWORD && password.length <= MAX_PASSWORD },
    { label: '영문과 숫자를 모두 포함', ok: /[a-z]/i.test(password) && /\d/.test(password) },
    // 이메일 아이디가 짧으면(3자 미만) 우연히 겹치기 쉬워 보지 않는다
    { label: '이메일 아이디가 들어가지 않게', ok: id.length < 3 || !password.toLowerCase().includes(id) },
  ];
}

export const passwordOk = (password: string, email: string) => passwordRules(password, email).every((r) => r.ok);
