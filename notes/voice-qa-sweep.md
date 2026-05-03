# Voice QA sweep step 1 — 진단 결과 (2026-05-02)

D5 폰 검증 catch (D-1 "번역투가 너무 많다") 후속. 5 region 76 노드 전체 review-all 자동 검토 (Agent subagent 5개 병렬).

## 전체 통과율

| Region | Pass | Fail | Total | Fail % |
|---|---|---|---|---|
| forest-outskirts (1지역) | 9 | 3 | 12 | 25% |
| forgotten-mountains (2지역) | 14 | 1 | 15 | 7% |
| ash-wastes (3지역) | 10 | 7 | 17 | 41% |
| dreaming-city (4지역) | 12 | 4 | 16 | 25% |
| dawn-spire (5지역) | 10 | 6 | 16 | 38% |
| **합계** | **55** | **21** | **76** | **27.6%** |

통과 기준: voiceMatch + toneMatch >= 8 AND structureOk = true

> **주의**: 통과한 노드 중에도 voice 4/5 + 번역투 issue 1~2개 있는 경우 다수. 사용자 catch한 D-1을 살리려면 "통과 기준 미달" 외에 "issue가 번역투 1+ 인 노드"도 후보.

## 임계 미달 21 노드 (재작성 1순위 후보)

### 1지역 (3)
- `fo-bayren-rune` — '그' 영어식 대명사 + '들어차기 시작한다' (begin to 직역)
- `fo-boss-tree` — description 4단락 룰 위반 + '비명 없이' (without screaming 도치)
- `fo-resolution` — '잊혀진' 이중피동 (표준은 '잊힌') + '그' 영어식

### 2지역 (1)
- `fm-street` — '이름 없는 무게가 어깨에 내려앉는다' (= 사용자 catch한 "의무가 어깨를 누른다" 동일 패턴) + '의지의 흔적' 추상명사

### 3지역 (7)
- `fa-storm` — 비유 다수 ('칼처럼' + '모래처럼')
- `fa-cavern` — '동굴은 너를 삼킨다' (swallows 직역) + '...였다' 과거시제
- `fa-cavern-fight` — '그' 반복
- `fa-mirror` — '잠식은 풍경에만 깃드는 것이 아니다' 추상 단언 + '~것이다' 추측
- `fa-mirror-fight` — '결' 추상어 남발 + '너가' 부자연 (보통 '네가')
- `fa-converge` — 'you know that ~' 직역 어순
- **`fa-corrupted`** — voice 2점, 사용자 D5 폰에서 직접 catch한 **"비틀린 호선" 그대로**, '그/그의' 남발, 길이 초과

### 4지역 (4)
- `dc-citizen-attack` — voice 3
- `dc-fork` — 과거시제 위반 + 추상 의인화
- `dc-vendor` — '마치 ~듯이' 영문학 번역체 + 과거시제
- **`dc-resolution`** — voice 2, 과거시제 3연속, ending인데 길이 한참 미달

### 5지역 (6)
- `ds-floor-illusion` — '푸른 불이 너의 안쪽을 핥는다' (licks at 직역) + 길이 초과
- `ds-floor-illusion-fight` — '결' 4번+ 반복
- `ds-floor-mages` — 베일런 정서 단언 + 길이 ~370자 (가이드 100~200 초과)
- `ds-ending-defeat` — `[V1 데모 — ...]` 대괄호 메타텍스트
- `ds-ending-betrayal` — 동일
- `ds-ending-sacrifice` — 동일 + 비유 2회 (룰 위반)

## 공통 번역투 패턴 (region 횡단)

검토 agent들이 일관되게 catch한 패턴 — 앞으로 narrator/persona 가이드 강화 + 일괄 수정 가능 후보:

1. **'그/그녀' 영어식 대명사 반복** — 1지역 5 노드 + 3지역 combat 노드. 한국어는 주어 생략 자연스러움. 캐릭터명 또는 생략 권장.
2. **'결' 추상명사 남용** — 3지역, 5지역 region 시그니처. '비틀린 호선' / '의무가 어깨를 누른다'와 동일 결의 한자/추상어 문제. 구체 묘사로 교체 권장.
3. **추상명사+의인화 단언** — '의무가 어깨를 누른다', '잠식이 깃든다', '의식이 떠오른다' 등 narrator 외부 관찰 룰 위반 + 번역체.
4. **'마치 ~듯이'** — 영문학 번역체 시그니처. 직접 묘사로 교체.
5. **과거시제 위반** — narrator 현재형 룰. '잊혀진/무너져 내렸고/절었고/본 적 없다' 등.
6. **'~기 시작한다'** — 'begin to' 직역. 그냥 동사 현재형으로.
7. **이중 피동 ('잊혀진')** — 표준 한국어 '잊힌'.
8. **'~려 한다'** — 'about to' 직역 의심 케이스.
9. **대괄호 메타텍스트** — 5지역 ending 3개 모두 `[V1 데모 — ...]` 형식 룰 위반. 데이터 구조로 분리하든지 룰 예외 결정 필요.
10. **길이/단락 룰 위반** — fo-boss-tree, fa-corrupted, ds-floor-mages 등.

## TOP 5 가장 심각 (먼저 손볼 후보)

1. **fa-corrupted** (voice 2, structure FAIL) — 사용자 D5 catch '비틀린 호선' 그대로 + 길이 초과 + '그/그의' 남발
2. **dc-resolution** (voice 2, structure FAIL) — ending인데 과거시제 3연속 + 길이 미달
3. **fm-resolution** (voice 3, 임계 통과) — '무너져 내렸고/남지 않았다' 과거시제 + '마침의 무게' 추상
4. **fa-mirror** (voice 3) — '잠식은 풍경에만 깃드는 것이 아니다' 추상 단언
5. **ds-floor-illusion-fight** (voice 3) — '결' 4번+ 반복 (한 노드에서)

## 다음 단계 옵션

1. **풀 sweep**: 21 노드 재작성 + 패턴 1~10 batch 일괄 수정 (~2일+, voice quality 최대치, ship 좀 늦춰짐)
2. **임계 미달만 재작성**: 21 노드만 narrator subagent로 재작성 (~1일, borderline은 유지)
3. **메인 path 우선**: 각 지역 arrive/converge/boss/resolution + boss + ending = 핵심 ~15-20 노드만 (~반나절, 사이드는 V1.1로)
4. **패턴 batch만**: '그/그녀 → 캐릭터명/생략', '잊혀진 → 잊힌', '마치 ~듯이' 등 기계적 패턴만 정규식/sed batch (~1~2시간, 구조적 번역투는 유지)

3 + 4 hybrid 추천: **메인 path 재작성 + 전체 region에 패턴 batch fix**. 1일 안쪽이면 가능, 사용자 D5 catch는 풀려고 하면서 ship cap 안에 들어옴.

## 결과 파일

- `/tmp/reviews-forest-outskirts.json`
- `/tmp/reviews-forgotten-mountains.json`
- `/tmp/reviews-ash-wastes.json`
- `/tmp/reviews-dreaming-city.json`
- `/tmp/reviews-dawn-spire.json`

## 후속 작업

- 가이드 강화: 패턴 1~10 narrator 페르소나 MD에 명시 가드 추가 (재발 방지). brief에 '번역투 금지 패턴' 섹션 박기.
- review subagent 가 '결' 명사 사용을 voice penalty로 잡도록 reviewer 프롬프트 강화 (false negative 줄이기).
