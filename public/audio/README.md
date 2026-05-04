# BGM / SFX 음원 자리

V1.1 BGM 시스템이 5 region 별 ambient loop 를 여기서 로드한다. 현재
베이스라인은 `scripts/generate-audio-assets.ts` 로 만든 절차 생성 WAV다.
추후 CC0 / 외주 음원으로 같은 파일명만 교체하면 된다.

## 필수 파일 (5 개)

```
public/audio/forest-outskirts.wav
public/audio/forgotten-mountains.wav
public/audio/ash-wastes.wav
public/audio/dreaming-city.wav
public/audio/dawn-spire.wav
```

**최종 포맷 권장 (autoplan Eng 결과):** Mono ogg-vorbis @ 64kbps,
~60-90초 loop. 파일당 <800KB 목표, 총 <4MB. 현재 WAV는 외부 codec 도구
없이 생성 가능한 출시 전 baseline 이다.

## 필수 SFX 파일 (8 개)

```
public/audio/sfx/choice-tap.wav
public/audio/sfx/stat-loss.wav
public/audio/sfx/stat-gain.wav
public/audio/sfx/meta-unlock.wav
public/audio/sfx/death.wav
public/audio/sfx/ending-reveal.wav
public/audio/sfx/combat-engage.wav
public/audio/sfx/combat-victory.wav
```

## CC0 / 무료 음원 출처 후보

다음 사이트들에서 region tone 에 맞는 ambient loop 검색해서 다운로드:

### 1. Pixabay Music — https://pixabay.com/music/
- 검색 키워드: `dark ambient`, `mist`, `fantasy ambient`, `ethereal`, `mystical`
- License: Pixabay 자유 라이센스 (상업 가능, 출처 표기 불요)

### 2. Free Music Archive — https://freemusicarchive.org/
- "Ambient" / "Dark Ambient" 장르 + CC0 / CC BY 필터
- License 별로 표기 확인

### 3. Incompetech (Kevin MacLeod) — https://incompetech.com/music/
- Cinematic / Dark / Drone 카테고리
- License: CC BY 4.0 (출처 표기 필수, in-app credit 화면)

### 4. Free Sound — https://freesound.org/
- ambient loop 검색, CC0 또는 CC BY 필터
- 짧은 음원이 많아 loop 가공 필요

### 5. OpenGameArt.org — https://opengameart.org/art-search-advanced
- Music + Loop 카테고리, CC0 / CC BY 필터
- 게임 ambient 에 특화

## Region 별 톤 가이드

음원 selection 시 narrator + region 결 참고:

| Region | 톤 | 검색 키워드 |
|--------|----|-----------|
| forest-outskirts (안개의 숲) | 안개 / 신비 / 약한 무게 | mist, forest, ethereal pad |
| forgotten-mountains (잊혀진 산맥) | 차가운 바람 / 폐허 / 무거움 | cold wind, ruin, dark drone |
| ash-wastes (재의 황무지) | 무감각 / 잿빛 / 광활 | desolate, ash, void drone |
| dreaming-city (꿈꾸는 도시) | 가짜 평화 / 너무 명랑 / 환영 | uncanny, dream, wrong cheerful |
| dawn-spire (새벽의 첨탑) | 차가운 새벽 / 첨탑 / 옛 마법 | dawn, cathedral, choral cold |

## 변환

다른 포맷의 음원을 ogg-vorbis 64kbps mono 로 변환:

```bash
# ffmpeg 사용 (가장 일반적)
ffmpeg -i input.mp3 -ac 1 -c:a libvorbis -b:a 64k output.ogg

# 또는 macOS afconvert
afconvert input.mp3 -d 0 -f ogg -b 64000 output.ogg
```

## 동작 (음원 부재 시)

`src/lib/audio.ts` 가 음원 로드 실패 시 silently degrade — 게임은 정상 동작,
BGM 만 안 나옴. 즉 5 파일 다 채우지 못해도 점진적으로 추가 가능.

## 라이센스 표기

CC BY 음원 사용 시 게임 내 credit 화면 (또는 README) 에 출처 표기:
- 곡명, 작곡자, 라이센스, URL

현재 절차 생성 WAV baseline 은 repo-local generated asset 이며 외부 저작물
출처가 없다. 파일 교체 시 `public/audio/CREDITS.md` 를 갱신한다.

## 외주 (V1.2+ 검토)

CC0 음원 quality 부족하다 판단되면 V1.2 에서 한국 indie 외주
($50~150 per loop) 검토. V1.1 = CC0 으로 ship.
