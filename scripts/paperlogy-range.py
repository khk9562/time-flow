"""Paperlogy 에서 실제로 모양이 그려진 글자 범위를 뽑아 src/lib/paperlogy-range.ts 로 쓴다.

Paperlogy 는 한글 11,172자를 모두 가진 것처럼 선언하지만, 자주 쓰는 글자 밖의 8천여 자는
빈 글자다. 그대로 두면 '홓' 같은 글자가 투명하게 보이므로, 빈 글자를 범위에서 빼서
브라우저가 시스템 폰트로 대신 그리게 한다.

사용: pip install fonttools brotli
      git clone --depth 1 https://github.com/projectnoonnu/2408-3 /tmp/paperlogy
      python3 scripts/paperlogy-range.py /tmp/paperlogy
"""
import glob
import sys
import unicodedata

from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont

files = sorted(glob.glob(f'{sys.argv[1]}/Paperlogy-*.woff2'))
if not files:
    sys.exit('Paperlogy-*.woff2 를 찾지 못했습니다')

drawn = None
for fn in files:
    font = TTFont(fn)
    glyphs = font.getGlyphSet()
    ok = set()
    for cp, name in font.getBestCmap().items():
        pen = RecordingPen()
        glyphs[name].draw(pen)
        # 공백·제어 문자는 원래 비어 있다
        if pen.value or unicodedata.category(chr(cp))[0] in 'ZC':
            ok.add(cp)
    # 굵기마다 다르면 모두에 그려진 글자만 남긴다
    drawn = ok if drawn is None else drawn & ok

cps = sorted(drawn)
ranges = []
start = prev = cps[0]
for cp in cps[1:]:
    if cp != prev + 1:
        ranges.append((start, prev))
        start = cp
    prev = cp
ranges.append((start, prev))

body = ','.join(f'{a:X}' if a == b else f'{a:X}-{b:X}' for a, b in ranges)
lines = [body[i:i + 100] for i in range(0, len(body), 100)]
with open('src/lib/paperlogy-range.ts', 'w') as out:
    out.write('// scripts/paperlogy-range.py 로 만든 파일. 직접 고치지 않는다.\n')
    out.write(f'// Paperlogy 에 실제로 그려진 글자 {len(cps)}자 ({len(ranges)}구간, 16진수 코드 포인트).\n')
    out.write('export const PAPERLOGY_RANGE =\n')
    out.write('\n'.join(f"  '{l}'" for l in lines).replace("'\n", "' +\n"))
    out.write(';\n')
print(f'{len(cps)} chars, {len(ranges)} ranges')
