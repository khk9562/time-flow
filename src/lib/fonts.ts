import { PAPERLOGY_RANGE } from './paperlogy-range';

// Paperlogy — 눈누(noonnu) 배포 CDN. 오프라인 사용 시 public/fonts 로 옮겨 경로만 바꾸면 된다.
const BASE = 'https://cdn.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/';
const FILES = ['1Thin', '2ExtraLight', '3Light', '4Regular', '5Medium', '6SemiBold', '7Bold', '8ExtraBold', '9Black'];

/**
 * @font-face 대신 여기서 등록한다. 그려진 글자 범위(1,858구간)를 굵기 9개에 되풀이해 CSS 에 넣으면
 * 너무 커지기 때문. 범위 밖의 글자(빈 글자)는 브라우저가 시스템 한글 폰트로 대신 그린다.
 */
export function registerFonts() {
  if (typeof FontFace === 'undefined') return;
  const unicodeRange = PAPERLOGY_RANGE.split(',').map((r) => `U+${r}`).join(',');
  FILES.forEach((file, i) => {
    document.fonts.add(
      new FontFace('Paperlogy', `url(${BASE}Paperlogy-${file}.woff2) format('woff2')`, {
        weight: String((i + 1) * 100),
        display: 'swap',
        unicodeRange,
      }),
    );
  });
}
