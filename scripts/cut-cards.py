"""짝맞추기 카드 자르기 - Gemini 로 만든 5×6 카드 모음 이미지를 카드 한 장씩 잘라 webp 로 저장한다.

    python scripts/cut-cards.py <원본 폴더> [출력 폴더]

원본 폴더에 type1.png(학생) · type2.png(아기자기) · type3.png(추억)이 있어야 한다.
원본(장당 6~8MB)은 이 저장소에 넣지 않는다. 출력 기본값은 public/games/memory/cards/.
Pillow 와 numpy 가 필요하다.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

OUT_W, OUT_H = 240, 360  # 화면 카드와 같은 2:3

# 원본 파일 → 테마 폴더, 빼는 칸 (줄, 칸 - 0부터)
THEMES = {
    'type2.png': ('cute', {
        (4, 5),  # 오른쪽 아래 Gemini 표시
    }),
    'type1.png': ('teen', {
        (4, 5),  # 오른쪽 아래 Gemini 표시
        (2, 2),  # 운동화 - 실제 상표와 닮은 무늬
        (2, 0),  # (0,2)와 거의 같은 아이(금발·검은 비니·보라 후드)
        (3, 0),  # (0,3)과 닮음(보라 비니)
        (3, 2),  # (1,1)과 닮음(갈색 머리·보라 점퍼)
    }),
    'type3.png': ('old', {
        (4, 5),  # 오른쪽 아래 Gemini 표시
    }),
}


def runs(profile, threshold, min_len=80):
    """값이 threshold 를 넘는 구간들 (카드 줄·칸)"""
    out, start = [], None
    for i, v in enumerate(list(profile) + [0]):
        if v > threshold and start is None:
            start = i
        elif v <= threshold and start is not None:
            if i - start >= min_len:
                out.append((start, i))
            start = None
    return out


def cut(path, out_dir, skip):
    img = Image.open(path).convert('RGB')
    px = np.asarray(img).astype(int)
    bg = px[5, 5]
    mask = np.abs(px - bg).sum(2) > 40  # 바탕색과 다른 곳 = 카드
    rows = runs(mask.mean(1), 0.5)
    top, bottom = rows[0][0], rows[-1][1]
    cols = runs(mask[top:bottom].mean(0), 0.5)
    assert (len(rows), len(cols)) == (5, 6), f'{path.name}: {len(rows)}줄 {len(cols)}칸'

    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob('*.webp'):
        old.unlink()
    n = 0
    for r, (y0, y1) in enumerate(rows):
        for c, (x0, x1) in enumerate(cols):
            if (r, c) in skip:
                continue
            # 줄마다 카드가 조금씩 어긋나 있어 칸 안에서 카드 테두리를 다시 찾는다
            pad = 14
            ya, yb = max(0, y0 - pad), min(px.shape[0], y1 + pad)
            xa, xb = max(0, x0 - pad), min(px.shape[1], x1 + pad)
            ys, xs = np.nonzero(mask[ya:yb, xa:xb])
            cy0, cy1, cx0, cx1 = ya + ys.min(), ya + ys.max(), xa + xs.min(), xa + xs.max()
            # 테두리·둥근 귀퉁이를 걷어 낸다 (화면에서 다시 둥글게 깎는다)
            w, h = cx1 - cx0, cy1 - cy0
            cx0, cx1 = cx0 + w * 0.05, cx1 - w * 0.05
            cy0, cy1 = cy0 + h * 0.035, cy1 - h * 0.035
            # 2:3 으로 맞춘다 - 남는 쪽을 가운데 기준으로 덜어 낸다
            w, h = cx1 - cx0, cy1 - cy0
            if w / h > OUT_W / OUT_H:
                extra = w - h * OUT_W / OUT_H
                cx0, cx1 = cx0 + extra / 2, cx1 - extra / 2
            else:
                extra = h - w * OUT_H / OUT_W
                cy0, cy1 = cy0 + extra / 2, cy1 - extra / 2
            card = img.crop((round(cx0), round(cy0), round(cx1), round(cy1))).resize((OUT_W, OUT_H), Image.LANCZOS)
            n += 1
            card.save(out_dir / f'{n:02d}.webp', 'WEBP', quality=80, method=6)
    return n


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / 'public/games/memory/cards'
    for name, (theme, skip) in THEMES.items():
        n = cut(src / name, out / theme, skip)
        print(f'{theme}: {n}장')


if __name__ == '__main__':
    main()
