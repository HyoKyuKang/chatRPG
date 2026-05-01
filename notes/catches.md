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

(없음)

---

## 트랙 C — 시스템 / 데이터 (메타 / 잠금해제 / 진척)

(없음)

---

## 트랙 D — 콘텐츠 정리 (노드 / 페르소나 / 잔향)

(없음)
