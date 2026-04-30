# Choice Echoes

`echoes`는 같은 노드에 도착하더라도 이전 선택의 흔적을 짧게 되돌려주는 문장이다.
노드를 많이 쪼개지 않고도 "게임이 내 선택을 기억한다"는 감각을 만든다.

## JSON shape

```json
{
  "id": "fm-arrive",
  "region": "forgotten-mountains",
  "type": "encounter",
  "description": "산맥의 입구에 선다...",
  "echoes": [
    {
      "condition": { "knowledge": "rejected-stranger" },
      "text": "안개 너머에서 수상자의 말이 늦게 따라온다. \"그래도 여기까지 왔군.\""
    },
    {
      "condition": { "knowledge": "templar-creed" },
      "text": "아스트리드가 외웠던 신조 한 줄이, 추위 속에서 잠깐 되살아난다."
    }
  ],
  "choices": []
}
```

`condition`은 선택지 조건과 같은 필드를 쓴다.

- `class`: 특정 클래스일 때
- `knowledge`: 특정 기억/지식을 가지고 있을 때
- `item`: 특정 아이템을 가지고 있을 때
- `statGte`: 특정 스탯이 일정 이상일 때

조건이 없는 echo는 항상 붙는다. 보통은 남용하지 않는다.

## Authoring rule

Echo는 새 사건을 시작하기보다, 이미 지나간 선택이 현재 장면의 결을 살짝 바꾸는 용도로 쓴다.

좋은 echo:

- 수상자를 믿거나 거절한 태도 회수
- 동료 앞에서 보인 용기/회피 회수
- 보스에게서 도망친 기억 회수
- 특정 아이템을 아직 들고 있는 상태 회수
- HP/MP가 낮은 상태의 몸/정신 반응

피할 echo:

- 핵심 정보를 echo에만 숨기기
- 너무 긴 설명
- 선택지를 새로 열어야 할 정도의 큰 사건
- 같은 플래그를 매 노드마다 반복하기

## Combat use

전투는 숫자 계산보다 "어떤 대가를 치렀는지"가 중요하다.

예:

- `hp`를 잃고 정면으로 막았다면 다음 동료 장면에서 인정 echo
- `mana`를 잃고 속삭임을 견뎠다면 다음 환각 장면에서 저항 echo
- 아이템을 소모해 피해를 피했다면 결말에서 빈 손 echo
- 도망쳤다면 다음 보스/수상자 장면에서 회피 echo

## Suggested flags

아래 이름들은 예시다. 실제 추가 시 `data/shared/knowledge.json`에 등록해야 한다.

- `trusted-stranger`
- `rejected-stranger`
- `astrid-respected`
- `astrid-doubted`
- `fled-tree`
- `heard-corrupted-whisper`
- `fled-shadow-commander`
- `used-shield-in-combat`

## Scope

Echo는 `description` 뒤에 빈 줄 두 개로 이어 붙는다. 기존 노드와 선택지 구조는 그대로 유지된다.
`npm run lint:data`는 echo 조건의 `knowledge`와 `item` 참조가 실제 shared data에 있는지 검사한다.
