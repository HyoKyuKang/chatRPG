import { chromium, type Page } from 'playwright'

const CHROME =
  '/home/ubuntu/.playwright/chromium-1208/chrome-linux64/chrome'
const URL = 'http://localhost:5173'
const STORAGE_KEY = 'chat-rpg/save-v1'

async function visibleButtons(page: Page) {
  const texts = await page.locator('button:visible').allTextContents()
  return texts.map((t) => t.trim()).filter(Boolean)
}

async function bodyText(page: Page) {
  return (await page.locator('body').textContent()) ?? ''
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
  })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', (e) => console.error('  [pageerror]', e.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('  [console.error]', msg.text())
  })

  // PRELUDE: clean slate
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY)
  await page.reload({ waitUntil: 'networkidle' })

  // ─── Happy path 1: 양피지 → ending ───────────────────────────────────
  await page.waitForSelector('text=안개 속에서 깨어났다')
  console.log('✓ prologue-01 rendered (fresh state)')
  let body = await bodyText(page)
  console.log('  HP/MP:', /HP\s*5/.test(body) && /MP\s*3/.test(body))

  await page.getByRole('button', { name: '주위를 둘러본다' }).click()
  await page.getByRole('button', { name: '당신을 믿겠다' }).click()
  await page.waitForSelector('text=두 가지가 놓여 있다')
  const p3btns = await visibleButtons(page)
  console.log(
    '✓ prologue-03 — conditional 양피지 visible:',
    p3btns.some((b) => b.includes('양피지')),
  )

  await page.getByRole('button', { name: '낡은 양피지를 펼친다' }).click()
  await page.waitForSelector('text=거대한 그림자')
  await page.getByRole('button', { name: '룬을 외운다' }).click()
  await page.waitForSelector('text=Week 1 데모 끝')
  body = await bodyText(page)
  console.log('✓ ending reached')
  console.log('  MP=2 (drained):', /MP\s*2/.test(body))
  console.log('  inventory empty (scroll consumed):', /소지품 없음/.test(body))
  console.log('  meta 출정 1 visible:', /출정\s*1/.test(body))

  // ─── Persist test: reload mid-ending ────────────────────────────────
  const saveBlob = await page.evaluate(
    (k) => localStorage.getItem(k),
    STORAGE_KEY,
  )
  if (!saveBlob) throw new Error('localStorage save missing after ending')
  console.log('✓ localStorage save written')

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('text=Week 1 데모 끝')
  body = await bodyText(page)
  console.log('✓ after reload — still at ending:', /Week 1 데모 끝/.test(body))
  console.log('  meta 출정 1 still visible:', /출정\s*1/.test(body))

  // ─── Reset → fresh run, meta preserved ──────────────────────────────
  await page.getByRole('button', { name: '다시 출정' }).click()
  await page.waitForSelector('text=안개 속에서 깨어났다')
  body = await bodyText(page)
  console.log('✓ reset → fresh run')
  console.log('  HP/MP back to 5/3:', /HP\s*5/.test(body) && /MP\s*3/.test(body))
  console.log(
    '  meta 출정 1 STILL visible (persisted across reset):',
    /출정\s*1/.test(body),
  )

  // ─── Alt path 2: 그냥 일어선다 → 검 path → prologue-04 with sword ────
  await page.getByRole('button', { name: '그냥 일어선다' }).click()
  await page.getByRole('button', { name: '관심 없다' }).click()
  await page.waitForSelector('text=두 가지가 놓여 있다')
  const altP3btns = await visibleButtons(page)
  console.log(
    '✓ alt prologue-03 — 양피지 hidden:',
    !altP3btns.some((b) => b.includes('양피지')),
  )
  await page.getByRole('button', { name: '녹슨 검을 잡는다' }).click()
  await page.waitForSelector('text=거대한 그림자')
  const p4btns = await visibleButtons(page)
  console.log(
    '✓ prologue-04 (검 path) — 검 visible, 주문 hidden:',
    p4btns.some((b) => b.includes('검으로 맞선다')) &&
      !p4btns.some((b) => b.includes('룬을 외운다')),
  )

  // ─── Death injection: set hp=1, reload, take damage ─────────────────
  await page.evaluate((k) => {
    const raw = localStorage.getItem(k)
    if (!raw) throw new Error('no save to mutate')
    const obj = JSON.parse(raw)
    obj.state.run.stats.hp = 1
    localStorage.setItem(k, JSON.stringify(obj))
  }, STORAGE_KEY)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('text=거대한 그림자')
  body = await bodyText(page)
  console.log(
    '✓ injected HP=1, reloaded — at prologue-04:',
    /HP\s*1/.test(body) && /거대한 그림자/.test(body),
  )

  await page.getByRole('button', { name: '검으로 맞선다' }).click()
  await page.waitForSelector('text=쓰러진다')
  body = await bodyText(page)
  console.log('✓ death triggered')
  console.log('  HP clamped to 0:', /HP\s*0/.test(body))
  console.log('  meta 기억 1 visible:', /기억\s*1/.test(body))
  console.log('  메시지 "쓰러진다":', /쓰러진다/.test(body))

  const deathButtons = await visibleButtons(page)
  console.log(
    '  only 다시 출정 button:',
    deathButtons.length === 1 && deathButtons[0] === '다시 출정',
  )

  // ─── After-death reset → fresh run, meta carries shards + count ─────
  await page.getByRole('button', { name: '다시 출정' }).click()
  await page.waitForSelector('text=안개 속에서 깨어났다')
  body = await bodyText(page)
  console.log('✓ post-death reset → fresh run')
  console.log(
    '  HP/MP restored 5/3:',
    /HP\s*5/.test(body) && /MP\s*3/.test(body),
  )
  console.log('  meta 기억 1 carries forward:', /기억\s*1/.test(body))
  console.log('  meta 출정 1 carries forward:', /출정\s*1/.test(body))

  await browser.close()
  console.log('\nQA smoke passed (Day 7).')
}

main().catch((e) => {
  console.error('QA FAILED:', e)
  process.exit(1)
})
