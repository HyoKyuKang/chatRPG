# Hero portraits

영웅 작은 초상 이미지가 들어갈 디렉토리. Vite 가 `public/` 을 자동으로 root
에 serve 하므로 URL 은 `/portraits/<heroId>.webp`.

## 매핑 규칙

파일명 = `data/shared/heroes.json` 의 `id` 와 일치.

| heroId | 파일 |
|---|---|
| astrid | `astrid.webp` |
| bayren-rosa | `bayren-rosa.webp` |
| shadow-commander | `shadow-commander.webp` |
| corrupted-one | `corrupted-one.webp` |
| sleeping-king | `sleeping-king.webp` |
| mawang | `mawang.webp` |
| gray-one | `gray-one.webp` |

(행객-단 = V1.1 trace, 일단 fallback (그라디언트 + 이니셜) 그대로.)

파일 없으면 NodeView 가 자동으로 fallback (그라디언트 + 큰 이니셜) 표시.

## V1.0 사양

- **해상도:** 1024×1024 (square)
- **포맷:** webp
- **품질:** quality 85 (`cwebp -q 85` 또는 `ffmpeg -quality 85`)
- **결:** warm dark fantasy / hand-painted illustration / soft warm lighting

## Midjourney v7 워크플로 (V2 HOUR 3 결정)

### Step 1: Style anchor 1장

```
/imagine warm dark fantasy character portrait, hand-painted digital
illustration, soft warm lighting, korean indie game art style, hopeful
yet melancholic, hades-like character art, centered, 1024x1024
--ar 1:1 --v 7 --style raw
```

best 1장의 URL → 다음 모든 영웅에 `--sref <URL>` 로 적용.

### Step 2: 영웅 7명

각 prompt 끝에 `--sref <STYLE_URL> --ar 1:1 --v 7 --style raw` 붙임.

```
astrid:           young female templar, korean light hair, holy white-gold
                  armor, faith-bound but uncertain, warm hopeful expression,
                  character portrait

bayren-rosa:      elderly male wizard, long white hair, weary stern face,
                  dark layered robes, ancient runes glowing faintly, gruff
                  but knowing, character portrait

shadow-commander: armored male commander, helmet hiding face, black-purple
                  plate armor, shadow tendrils, once-faithful now fallen,
                  weight of broken oath, character portrait

corrupted-one:    former hero turned corrupted, cracked porcelain face, dark
                  whispers around skull, ash-stained tunic, eyes too bright,
                  character portrait

sleeping-king:    ancient dreaming king, ornate purple-gold robes, eyes
                  closed peacefully, suspended in dream-light, ethereal,
                  character portrait

mawang:           ancient demon king, former mage, long black-grey robes,
                  weary eyes that have seen too much, melancholic not
                  malicious, dark throne backdrop, character portrait

gray-one:         mysterious cloaked figure, face entirely hidden in shadow
                  under gray hood, simple gray robes, first stranger from
                  before time, quiet authority, void backdrop,
                  character portrait
```

### Step 3: 변환 + 저장

각 영웅 4 generation 중 best 1장 선택 → 다운로드 → webp 변환:

```bash
# 권장 (cwebp 빠르고 quality 좋음)
cwebp -q 85 astrid.png -o astrid.webp

# 또는 ffmpeg
ffmpeg -i astrid.png -c:v libwebp -quality 85 astrid.webp
```

저장: `chat-rpg/public/portraits/<heroId>.webp`

`npm run dev` 가 자동 serve. lint:data / qa:smoke 에 영향 없음.

## V1.1+ 확장

- 큰 캐릭터 카드 일러 (HeroIntroCard 의 큰 슬롯) — 1024×768 등
- 보스 5명 + 수상자 reveal 컷 + 이벤트 컷
- 추가 영웅 (행객-단 + 영웅 풀 6→15 확장)
