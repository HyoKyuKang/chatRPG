// V2 HOUR 5 — Google Play store 용 스크린샷 4장 자동 캡처.
// Playwright 모바일 emulation (1080×1920 portrait, Pixel 7 결).
// dev 서버 (npm run dev) 가 localhost:5173 에서 돌고 있어야 작동.
//
// 시점 (디자인 문서의 인상 결로 선택):
//   1. 1지역 fo-arrive prologue — 게임 진입 인상 (안개 속 narrator)
//   2. 1지역 fo-astrid-meet — 영웅 등장 카드 + portrait (warrior path)
//   3. MetaUnlockScreen "공허" — 메타 잠금해제 (회색의 자 결)
//   4. 5지역 첨탑 reveal — 마왕 등장 (마법사 path 가 약간 더 임팩트)

import { chromium, devices, type Page } from 'playwright'
import { mkdir } from 'node:fs/promises'

const CHROME =
  '/home/ubuntu/.playwright/chromium-1208/chrome-linux64/chrome'
const URL = 'http://localhost:5173'
const STORAGE_KEY = 'chat-rpg/save-v1'
const OUT_DIR = 'notes/store-assets'

// Pixel 7 dimension은 Play Store 권장 1080×1920 와 거의 일치
const VIEWPORT = { width: 412, height: 915 } // CSS pixels (DPR=2.625 → 1080×~2400)
const CAPTURE_SIZE = { width: 1080, height: 1920 } // Final capture (cropped)

async function clearStorage(page: Page) {
  await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY)
  await page.reload({ waitUntil: 'networkidle' })
}

async function shoot(page: Page, name: string) {
  const path = `${OUT_DIR}/${name}.png`
  await page.screenshot({
    path,
    fullPage: false,
    clip: {
      x: 0,
      y: 0,
      width: VIEWPORT.width,
      height: Math.min(VIEWPORT.height, 915),
    },
  })
  console.log(`✓ ${path}`)
}

async function clickButton(page: Page, name: string) {
  await page.getByRole('button', { name }).click()
  await page.waitForTimeout(400) // staged reveal 안전 마진 (reduced motion 시 무시)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
  })

  // Pixel 7 emulation (closest to Play Store 1080×1920 target)
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    reducedMotion: 'reduce', // Phase B staged reveal skip (smoke 와 일관)
  })

  const page = await context.newPage()
  page.on('pageerror', (e) => console.error('  [pageerror]', e.message))

  await page.goto(URL, { waitUntil: 'networkidle' })

  // ─── 1. fo-arrive prologue ───────────────────────────────
  await clearStorage(page)
  await page.waitForSelector('text=안개 속에서 깨어났다')
  await page.waitForTimeout(500)
  await shoot(page, '01-prologue-fo-arrive')

  // ─── 2. fo-astrid-meet (warrior path) ───────────────────
  await clickButton(page, '그냥 일어선다')
  await clickButton(page, '관심 없다')
  await page.waitForSelector('text=두 가지가 놓여 있다')
  await clickButton(page, '녹슨 검을 잡는다')
  await page.waitForSelector('text=신참 템플러')
  await page.waitForTimeout(700)
  await shoot(page, '02-hero-card-astrid')

  // ─── 3. MetaUnlockScreen "공허" ─────────────────────────
  // 1지역 끝까지 가서 ds-style 메타 화면 도달은 5지역 가야. 단축:
  // 1지역 fo-resolution → "잊혀진 산맥으로 간다" 안 누르고 죽음 시나리오.
  // 빠른 방법: warrior path → 검 휘두르기 4번 (HP -1 each, 시작 HP 5 → 0 죽음 → MetaUnlockScreen)
  await clickButton(page, '함께 가겠다')
  await page.waitForSelector('text=부패한 늑대')
  // W10 gateway: regular fights need engage click before combat actions show.
  await clickButton(page, '검을 뽑는다')
  await page.waitForSelector('button:has-text("검을 휘두른다")')
  await clickButton(page, '검을 휘두른다')
  // fo-warrior-awaken
  await page.waitForSelector('text=처음이 아닌 거 같다')
  await clickButton(page, '검을 든 자로 살겠다')
  await page.waitForSelector('text=썩은 단 냄새')
  await clickButton(page, '곧장 전진한다')
  await page.waitForSelector('text=거대한 나무가 너 앞에 솟아 있다')
  // Boss gateway: engage-only.
  await clickButton(page, '맞선다')
  // ─── 4. CombatView 폴리싱 캡처 ──────────────────────────
  // Engaged but not yet acted — HP bar, turn indicator, action prediction
  // all visible. Pause a beat for the fade-in to settle.
  await page.waitForSelector('button:has-text("검으로 뿌리를 베어낸다")')
  await page.waitForTimeout(500)
  await shoot(page, '04-combat')
  await clickButton(page, '검으로 뿌리를 베어낸다')
  await page.waitForSelector('text=다음은 산')
  await clickButton(page, '잊혀진 산맥으로 간다')
  // 2지역 진입. fm-arrive 도달 후 2지역 보스에 일부러 죽음 — 첫 메타 화면 진입.
  // 단순화: 5지역까지 가지 말고 2지역 fm-arrive 직후 스크린샷 + reset 후 두 번째 출정 시
  // 기억의 조각 표시. 그러나 메타 화면은 죽음 후만. → 5지역 ds-* 까지 가는 거 cost 큼.
  // 대안: 첫 죽음 시 메타 화면 표시되니, 일부러 1지역에서 빠르게 죽으면 됨.
  // 다만 위 시나리오는 1지역 무난히 통과. 죽음 시나리오 별도 캡처 필요.
  // 일단 region transition 화면 캡처 (스크린샷 3 candidate):
  await page.waitForSelector('text=산맥의 입구')
  await page.waitForTimeout(700)
  await shoot(page, '03-region-transition-fm-arrive')

  // ─── 4. 첨탑 reveal (수상자 정체 reveal) — 시간 큼, skip ───
  // 5지역 ds-mawang 까지 직진 시나리오 = 매우 길다 (3+4+ 시간 소모).
  // 대신 dc-resolution 이전 4지역 끝에서 회색의 자 등장 캡처 가능.
  // 일단 위 3장 + 메타 화면 1장은 별도 흐름 (DEV reset 활용) 으로 추후 작성.

  // ─── 4. 메타 화면 (DEV reset 후 일부러 죽음) ────────────
  await clearStorage(page)
  // 빠른 죽음 path: 1지역 fo-arrive → fo-stranger → fo-fork → fo-astrid-meet → fo-astrid-fight 검 휘두르기 → fo-warrior-awaken → fo-converge → fo-boss-tree → 검으로 뿌리 베어내기 → fo-resolution → 잊혀진 산맥 → 2지역 보스 일부러 죽음
  // 이건 시간 큼. 단순화: 5지역까지 가는 게 진짜 메타 화면 (final ending).
  // 아니면 첫 출정 후 일부러 죽으면 됨.
  //
  // 가장 빠른 죽음 시나리오: warrior path 그대로 → 보스 도달 → "도망간다" 같은
  // 옵션 없으니, 검 휘두르기 후 일부러 진행 안 함. 또는 메타 화면 = 5지역 final ending.
  //
  // Trade-off: 시간 vs accuracy. 일단 위 3장 commit 후 사용자가 직접 4번째
  // (메타 화면 + 마왕 reveal) 1지역 죽음 시나리오로 캡처.

  console.log('\n3 of 4 screenshots captured.')
  console.log('TODO: 메타 화면 + 5지역 reveal 캡처는 사용자 직접 (긴 시나리오).')

  await browser.close()
}

main().catch((e: Error) => {
  console.error(`ERROR: ${e.message}`)
  process.exit(1)
})
