import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** 환경 변수가 없으면 null — 앱은 이 기기에만 저장하는 모드로 그대로 동작한다. */
export const supabase =
  url && key
    ? createClient(url, key, {
        // 메일의 링크를 다른 브라우저에서 열어도 로그인되도록 implicit 흐름을 쓴다
        auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
      })
    : null;

/** 로그인 링크가 돌아올 때 주소 해시에 토큰이나 오류가 실려 온다 */
export const isAuthHash = (hash: string) => /(^#|&)(access_token|error|error_description)=/.test(hash);

/** 만료된 링크 등으로 돌아왔을 때의 오류 설명 (페이지가 열리는 순간 한 번 읽어 둔다) */
export const authReturnError = (() => {
  const m = location.hash.match(/(?:^#|&)error_description=([^&]+)/);
  if (!m) return null;
  history.replaceState(null, '', location.pathname + location.search);
  return decodeURIComponent(m[1].replace(/\+/g, ' '));
})();
