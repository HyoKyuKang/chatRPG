# 아스트렌 (Astren)

한국어 텍스트 RPG. 이름을 잃은 이방인이 안개에 실려 *아스트렌*에 와서 숲, 산맥, 황무지, 꿈꾸는 도시, 새벽의 첨탑을 지나 마지막 세 선택 앞에 선다.

> *이 세계는 끝날 거야.*

## 실행

```bash
npm install
npm run dev
```

프로덕션 빌드:

```bash
npm run build
```

Android 빌드 흐름:

```bash
npm run cap:sync
npm run cap:apk:debug
```

## 주요 검증 명령

```bash
npm run lint:data
npm run lint:balance
npm run qa:combat-smoke
npm run qa:smoke
npm run build
```

- `lint:data`: JSON 스키마, 노드 연결, region/node/knowledge/item/hero 참조를 검사한다.
- `lint:balance`: 반복 가능한 HP/MP/아이템 보상 루프를 경고한다.
- `qa:combat-smoke`: 적 패턴, 페이즈 전환, 기본 전투 생존/사망 흐름을 검사한다.
- `qa:smoke`: Playwright로 프롤로그부터 2지역 진입까지 mage/warrior 주요 경로를 검사한다.
- `build`: 타입체크와 Vite production build를 실행한다.

V1.0 기준으로 위 명령이 모두 통과해야 출시 후보로 본다.

## 데이터 구조

- `data/regions/*.json`: 지역 순서, 진입 노드, 보스 노드, 지역 이미지.
- `data/nodes/<region>/*.json`: 실제 텍스트, 선택지, 전투 게이트, 엔딩.
- `data/shared/knowledge.json`: 선택의 흔적과 echo/gate에 쓰는 지식 ID.
- `data/shared/enemies.json`: 적 HP, 행동 예고, 실행 효과, 페이즈.
- `data/shared/items.json`: 아이템 정의.
- `data/shared/unlocks.json`: 메타 진행 보상.

노드는 데이터 주도형이다. 새 노드나 선택지를 추가하면 `npm run lint:data`를 먼저 통과시킨다.

## 스토리/문체 기준

- `docs/story-bible.md`: 전체 premise, 5지역 arc, 엔딩 의미.
- `docs/prose-brief.md`: 한국어 prose 기준.
- `docs/choice-echoes.md`: 이전 선택을 현재 장면에 되돌리는 echo 설계.
- `personas/*.md`: 주요 인물 voice 가드.

번역체를 피한다. 특히 `그/그를/그의`, `잊혀졌다`, `한 사람이 있었다` 같은 문장을 줄이고, 명사 반복과 짧은 단언을 우선한다.

## V1.0 QA 기준

출시 전 필수 확인:

- 프롤로그에서 1지역으로 자연스럽게 이어진다.
- 각 지역 rest/shop에서 HP/MP/아이템을 무한 파밍할 수 없다.
- mage/warrior 모두 1지역 보스를 지나 2지역에 진입할 수 있다.
- 전투 gateway와 전투 action이 분리되어 보인다.
- 세 엔딩이 모두 도달 가능하다.
- `ds-ending-defeat`는 승리 뒤에도 다음 안개의 암시가 남는다.

베타 피드백은 `notes/beta-feedback-template.md` 기준으로 받고, 재현 가능한 진행 막힘/크래시는 `notes/v1.0-blocker.md`에 모은다.
