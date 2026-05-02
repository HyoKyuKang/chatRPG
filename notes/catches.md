# Catches

체감 플레이 도중 발견한 이슈 — 흐름 끊지 말고 박제 → 라운드 시작 시 일괄 처리.

각 catch 는 **트랙 (어디서 처리할지)** 로 묶임. 같은 트랙끼리 한 번에 가는 게 일관성 있음.

---

## 트랙 A — Reviewer retroactive QA (네이밍 / 글톤 / 디테일)

> V1.7 디자인 문서의 "Reviewer retroactive QA" 트랙. 한 번에 reviewer subagent 돌려서 일관성 검토.

### A-1. "수상자" 이름 재고 (2026-05-01) — ✅ RESOLVED

**Found:** 첫 풀 체감 플레이 중. 5지역 reveal ("나는 너 이전의 자다") 의 톤과 비교하면 "수상자" = "수상한 자" 가 너무 직설적, 미스터리 결 약함.

**Resolved:** V2 HOUR 2 (`16b4dfe`) 에서 **"회색의 자"** 로 일괄 변경. 영웅 풀 패턴 ("잠식된 자" / "잠든 왕" / "그림자 사령관") 따름. 5지역 reveal 시 "회색 = 너 이전의 자" 자연스럽게 연결. ID = `gray-one`. 모든 region 노드 + plan yaml + persona MD 일괄 sed + persona 파일 rename (sujangja.md → gray-one.md).

---

## 트랙 B — UI 폴리싱 (인터랙션 / 시각)

### B-1. 선택지 누르면 맨 위 대화부터 스크롤 (2026-05-02) — ✅ RESOLVED (W10, 997c9f1)

**Found:** D5 폰 검증 (W9 머지 후 `/tmp/chatrpg.apk` 5.3MB). 새 history entry 추가 시 chat log 가 scroll-to-bottom 안 되거나 잘못 trigger (맨 위로 이동).

**Resolved (W10):** 원인 = footer 높이 변동에 따른 clientHeight 축소로 새 컨텐츠가 footer 뒤로 밀린 결. `behavior:'smooth'` 가 잦은 re-trigger 로 Android WebView 에서 끊기는 문제도 같이. Fix = bottom sentinel + `scrollIntoView({block:'end'})` + ResizeObserver (footer size shift 시 sentinel 재맞춤) + `behavior:'auto'`.

### B-2. 글이 많아서 시각 부담 (2026-05-02) — V1.0 갈래 B + V1.1 갈래 A

**Found:** D5 폰 검증. 사용자 비교 = 서울 2033 (각 선택지마다 상황 일러). V1.0 현재 = 영웅 portrait 7장만 (HeroIntroCard).

**Resolution (CEO 결정):**
- V1.0 안 = **갈래 B (원림)** — W12 Delight pack 에 region header image 5장 추가 + glob pacing (letter-spacing / staged reveal 강화)
- V1.1 = **갈래 A (노드별 일러)** — DALL-E 3 batch ~$3.16 (79 노드 × $0.04). 톤 일관성 검토 후 결정.

**Status:** W12 worker prompt 갱신 예정 (W10 머지 후).

---

## 트랙 C — 시스템 / 데이터 (메타 / 잠금해제 / 진척 / 그래프 logic 밸런스)

### C-1. Logic balance abuse spot (2026-05-02) — ⏳ Logic balance sweep worker 예정

**Found:** D5 폰 검증. 사용자 catch — "안개너머 샘으로 가서 HP 무한 회복하는 버그 이런것 처럼 논리적 밸런스도". rest / shop / discovery 노드의 visited gate 부족 + abuse 가능 path.

**구체 의심 spot:**
- `fo-rest-spring` (안개너머 샘, 1지역) — HP 회복 무한 반복 가능 (visited gate 없음 의심)
- 다른 rest / shop / discovery 노드 동일 패턴 가능 (fo-shop-traveler / fa-storm / etc)
- 보스 회피 후 다시 진입해도 보상 계속 받음 가능 (knowledge gate 부족)

**Resolution (CEO 결정):** plan-first 3-step
1. 새 worker (Logic balance sweep) 가 노드 graph 분석 + `scripts/lint-balance.ts` hybrid 박기 (W3 의 lint-echoes 패턴):
   - type='rest' / stat-gain knowledge / shop 노드의 visited gate 검증
   - self-reachable + 누적 효과 path 자동 catch
   - manual review 로 lint 못 잡는 상황 (영웅 영입 의도 깨짐 / 보스 회피 abuse) 박음
2. 사용자 우선순위 결정 (HP 무한 회복 부터, 다른 abuse 차후)
3. batch fix (data 갱신 — visited gate knowledge 추가 / schema/store 인프라 보완)

**Status:** W10 머지 후 즉시 던질 예정 (Voice QA sweep 보다 먼저 — 구체 bug = critical, 출시 차단 가능).

---

## 트랙 D — 콘텐츠 정리 (노드 / 페르소나 / 잔향)

### D-1. 번역투 sweep (2026-05-02) — ⏳ Voice QA sweep worker 예정

**Found:** D5 폰 검증. 사용자 catch — "전체적으로 번역투같은게 너무 많아 한번 다 잡고 가야할거 같은데". V1.0 voice quality 핵심.

**Resolution (CEO 결정):** plan-first 3-step
1. 새 worker (Voice QA sweep) 가 5 region 전체 `npm run author -- review-all <plan>` batch 검토 (~30분, read-only). voice/tone score 매김 + 번역투 의심 노드 list.
2. 사용자 우선순위 결정 (전체 vs main path + boss vs sub-scope).
3. narrator subagent 가 batch 재작성 → 사용자 final review.

**Status:** W10 머지 후 던질 예정. interactive 부담 최소화 (79 × AskUserQuestion X, batch 결).

---

## 트랙 E — Combat (V2 SCOPE EXPANSION 결과)

### E-1. Combat 진입 gateway 부재 (2026-05-02) — ✅ RESOLVED (W10, 997c9f1)

**Found:** D5 폰 검증. 사용자 = "전투가 들어갈 때 갑자기 들어가게 되니까 이상해 — 전투를 시작한다 라던지 상황을 설명하고 그다음에 선택지를 누른다음 전투에 들어가게". commitment 결정 없이 화면 swap.

**Resolved (W10, 갈래 B 인프라+데이터):** type='combat' 노드 자체가 prose + choices 가짐. Choice 에 `startsCombat?: boolean` 추가 (true=engage / false=evade(diplomacy) / undefined=in-combat action). store 의 `engageCombatFromChoice(choiceId)` 액션 — choice text 를 chat log 에 'choice' 엔트리 + outcome.text 가 있으면 'outcome' 엔트리도 박은 후 engageCombat 실행. NodeView 의 `isCombat` = `run.combat` 존재일 때만 true (gateway 단계에선 startsCombat 정의된 choice 만 visible). 12 combat 노드 prose+choices: 보스 5 = engage-only, 일반 7 = engage+evade. 회피는 같은 nextNodeId 로 흘러가되 outcome.text 로 회피 결을 narrator 톤으로 묘사.

### E-2. Combat UI raw (2026-05-02) — ✅ RESOLVED (W10, 997c9f1)

**Found:** D5 폰 검증. CombatView 의 hp bar / turn indicator / 행동 예고 / 페이즈 전환 시각 일관성 부족 (W8 인프라 + W9 데이터 = polish X).

**Resolved (W10):** footer takeover 전제로 재작성. 적 HP bar = pip 패턴 (StatBar 결, blood 톤), HP > 10 보스는 continuous bar fallback (consumed-one 14, mawang 16). 턴 indicator = 골드 액센트 / tabular-nums. 페이즈 indicator = N/M + 페이즈 전환 턴 narrator italic 단락 ("결이 한 칸 어긋난다"). 적 행동 예고 = italic narrator 톤 dim + 라벨 가벼운 uppercase. HP 변화 시 stat-shake (V2 HOUR 4 결). qa:combat-smoke 19/19 + `notes/store-assets/04-combat.png` 캡처.

### E-3. 사운드 X (2026-05-02) — ⏳ W1 (BGM) + W11 (SFX) 트랙

**Found:** D5 폰 검증. Combat / 메타 / 죽음 / ending 등 모든 시점 silent.

**Resolution:** 이미 plan 박힘. **W1 (BGM 5장 region) + W11 (SFX 5~8개)** trip. W10 머지 후 W11 던질 예정.

**Status:** plan 박힘, W10 후 진행.
