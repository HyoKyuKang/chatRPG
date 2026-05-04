# Prose Brief Template

서브에이전트 호출 시, 해당 노드의 프로즈 초안을 받기 위해 보내는 brief 포맷.
서브에이전트는 이 brief + 첨부된 페르소나 MD 파일(들)을 읽고 description / choice text /
outcome text 초안을 반환한다. 메커닉 필드 (statDelta, itemAdd 등)는 메인이 채움.

---

## Brief 구성

### 1. 노드 메타
- **ID**: (예) fo-astrid-meet
- **region**: forest-outskirts (1지역, 숲의 외곽)
- **type**: encounter | event | combat | boss | ending

### 2. 컨텍스트 (이 노드의 위치)
- 1줄: 이 노드는 어떤 순간인가
- 직전 노드 / 플레이어가 무엇을 골라 여기로 왔는가
- 직후로 향하는 노드 (분기 있으면 분기별로)

### 3. 등장 페르소나
- 항상: narrator
- 이번 노드에 등장 / 말하는 자: (페르소나 ID 목록)

### 4. 메커닉 / 구조
- description 길이 가이드 (노드 type 디폴트 표 참고)
- 선택지 N 개의 골격:
  1. 라벨 (anchor — 서브에이전트가 verbatim 반환), condition?, outcome 효과
  2. ...

(서브에이전트는 description + outcome_text 만 작성. **선택지 라벨은 입력 그대로 반환** — 아이코닉 대사 보호.)

### 4.1 노드 type 별 디폴트

| type | desc 길이 | outcome 길이 | 톤 / 결 |
|---|---|---|---|
| encounter | 2~3 단락 / 80~150자 | 1 단락 / 30~80자 | 외부 관찰 한 비트, 잔잔함 + 작은 의문 |
| event | 2~4 단락 / 100~200자 (대사 포함 가능) | 1~2 단락 / 40~120자 | 정서 비트, 캐릭터 대사 인용 가능 |
| combat | 2~3 단락 / 80~140자 | 1~2 단락 / 40~100자 | 행동 + 결과의 즉물성, 신체 감각 강함 |
| boss | 3~5 단락 / 150~250자 | 2~3 단락 / 80~180자 | 위협 고조, 서사적 무게, 클래스별 분기 prose 차별화 |
| ending | 4~6 단락 / 180~300자 (수상자 등장 가능) | (선택지 없음) | 결판 정서, 남은 여운, 다음 지역 암시 |

이 표는 디폴트일 뿐. brief의 "톤 타겟"이 다르면 그쪽 우선.

### 4.2 번역투 방지 가드

- 한국어에서 자연스러운 주어 생략을 우선한다. `그/그의/그녀` 반복 금지.
- 현재형을 기본으로 쓴다. 회상이나 고유 과거가 아니면 `-했다/-였다`를 피한다.
- `마치 ~듯이`, `~기 시작한다`, `~려 한다`, `~것이다` 같은 번역체 연결을 피한다.
- `결`, `무게`, `의무`, `잠식` 같은 추상명사는 한 노드 안에서 반복하지 않는다.
- 대괄호 메타텍스트를 prose에 넣지 않는다. 필요한 표식은 데이터 구조로 분리한다.

### 5. 톤 타겟 (한 문장)
이 노드에서 노리는 정서 / 긴장.

### 6. 출력 포맷
다음 JSON 그대로 반환:

```json
{
  "description": "...",
  "choices": [
    { "id": "...", "text": "...", "outcome_text": "..." },
    ...
  ]
}
```

---

## 서브에이전트 호출 가이드 (메인 에이전트용)

호출 시:
1. 위 brief를 채움
2. 첨부할 페르소나 MD 파일들의 **전체 내용**을 prompt에 포함
3. "출력은 위 JSON 포맷 그대로, 다른 텍스트 추가 금지" 명시
4. general-purpose 서브에이전트 사용

서브에이전트 응답 → 메인이 zod 스키마에 맞춰 JSON 통합 → 린트.

---

## Reviewer 서브에이전트 (작성 후 검증)

prose가 작성된 노드를 페르소나 voice + 톤 타겟에 얼마나 일치하는지 채점.

**워크플로:**
1. `npx tsx scripts/author-node.ts review-brief <plan> <node-id>` → stdout으로 review brief.
2. 그 brief 텍스트를 general-purpose 서브에이전트에 prompt로 전달.
3. 응답 JSON을 `/tmp/review-<id>.json`에 저장.
4. `npx tsx scripts/author-node.ts review-integrate <plan> <node-id> <review-path>` — zod 검증 + 결과 1줄 표시. 통과 못 하면 exit code 2.
5. (대안) `ANTHROPIC_API_KEY` 있으면 `review` 한 명령으로 자동.

**점수 기준:**
- voiceMatch (0~5) + toneMatch (0~5) 합산 8↑, structureOk = true → 통과.
- 미만이면 `issues` 배열 보고 해당 노드 prose 다시 굴리거나 손으로 다듬음.
