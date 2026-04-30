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

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY)
  await page.reload({ waitUntil: 'networkidle' })

  // ─── Mage path → ending ────────────────────────────────────────────
  await page.waitForSelector('text=안개 속에서 깨어났다')
  console.log('✓ fo-arrive (fresh state)')

  await page.getByRole('button', { name: '주위를 둘러본다' }).click()
  await page.getByRole('button', { name: '당신을 믿겠다' }).click()
  await page.waitForSelector('text=두 가지가 놓여 있다')
  const forkBtns = await visibleButtons(page)
  console.log(
    '✓ fo-fork — 양피지 visible (glimpse-of-mist gate):',
    forkBtns.some((b) => b.includes('양피지')),
  )

  await page.getByRole('button', { name: '낡은 양피지를 펼친다' }).click()
  await page.waitForSelector('text=흰 머리의 노인')
  console.log('✓ fo-bayren-meet')

  await page.getByRole('button', { name: '이게 무슨 글인지 알려달라' }).click()
  await page.waitForSelector('text=딱 한 번 외워봐')
  await page.getByRole('button', { name: '긴 호흡을 하고 외운다' }).click()
  await page.waitForSelector('text=룬을 부를 수 있는 자')
  console.log('✓ fo-mage-awaken')

  await page.getByRole('button', { name: '룬을 부르는 자로 살겠다' }).click()
  await page.waitForSelector('text=썩은 단 냄새')
  let body = await bodyText(page)
  console.log('  class displayed as 마법사:', /마법사/.test(body))
  console.log('  MP=2 (rune cost):', /MP\s*2/.test(body))

  await page.getByRole('button', { name: '주변을 살피며 간다' }).click()
  await page.waitForSelector('text=거대한 나무가 너 앞에 솟아 있다')
  const bossBtns = await visibleButtons(page)
  console.log(
    '✓ fo-boss-tree — 룬 visible, 검 hidden (mage class):',
    bossBtns.some((b) => b.includes('룬을 던진다')) &&
      !bossBtns.some((b) => b.includes('검으로 뿌리를 베어낸다')),
  )

  await page.getByRole('button', { name: '룬을 던진다' }).click()
  await page.waitForSelector('text=다음은 산')
  body = await bodyText(page)
  console.log('✓ fo-resolution (ending) reached')
  console.log('  meta 출정 1 visible:', /출정\s*1/.test(body))
  console.log('  inventory empty (scroll consumed):', /소지품 없음/.test(body))

  // ─── Region transition: 1지역 → 2지역 ───────────────────────────────
  const endingBtns = await visibleButtons(page)
  console.log(
    '✓ transition button visible (not 다시 출정):',
    endingBtns.some((b) => b.includes('잊혀진 산맥으로 간다')) &&
      !endingBtns.some((b) => b === '다시 출정'),
  )

  await page.getByRole('button', { name: '잊혀진 산맥으로 간다' }).click()
  await page.waitForSelector('text=산맥의 입구')
  body = await bodyText(page)
  console.log('✓ transitioned to fm-arrive (잊혀진 산맥)')
  console.log('  class still 마법사 (carry-over):', /마법사/.test(body))
  console.log('  MP=0 carried (rune-fundamentals -1, boss -2):', /MP\s*0/.test(body))

  // ─── Persist test: reload at fm-arrive ──────────────────────────────
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('text=산맥의 입구')
  body = await bodyText(page)
  console.log('✓ persist — reload at fm-arrive OK:', /산맥의 입구/.test(body))
  console.log('  meta 출정 1 still visible:', /출정\s*1/.test(body))

  // ─── Wipe localStorage → fresh start for warrior path ───────────────
  await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('text=안개 속에서 깨어났다')
  body = await bodyText(page)
  console.log('✓ wipe + reload → fresh run, meta cleared:', !/출정/.test(body))

  await page.getByRole('button', { name: '그냥 일어선다' }).click()
  await page.getByRole('button', { name: '관심 없다' }).click()
  await page.waitForSelector('text=두 가지가 놓여 있다')
  const forkBtnsAlt = await visibleButtons(page)
  console.log(
    '✓ fo-fork (no glimpse) — 양피지 hidden:',
    !forkBtnsAlt.some((b) => b.includes('양피지')) &&
      forkBtnsAlt.some((b) => b.includes('녹슨 검')),
  )

  await page.getByRole('button', { name: '녹슨 검을 잡는다' }).click()
  await page.waitForSelector('text=신참 템플러')
  console.log('✓ fo-astrid-meet')

  await page.getByRole('button', { name: '함께 가겠다' }).click()
  await page.waitForSelector('text=부패한 늑대')
  await page.getByRole('button', { name: '검을 휘두른다' }).click()
  await page.waitForSelector('text=처음이 아닌 거 같다')
  console.log('✓ fo-warrior-awaken')

  await page.getByRole('button', { name: '검을 든 자로 살겠다' }).click()
  await page.waitForSelector('text=썩은 단 냄새')
  body = await bodyText(page)
  console.log('  class displayed as 전사:', /전사/.test(body))
  console.log('  HP=4 (sword swing -1):', /HP\s*4/.test(body))

  await page.getByRole('button', { name: '곧장 전진한다' }).click()
  await page.waitForSelector('text=거대한 나무가 너 앞에 솟아 있다')
  const bossBtnsW = await visibleButtons(page)
  console.log(
    '✓ fo-boss-tree (warrior) — 검 visible, 룬 hidden:',
    bossBtnsW.some((b) => b.includes('검으로 뿌리를 베어낸다')) &&
      !bossBtnsW.some((b) => b.includes('룬을 던진다')),
  )

  await page.getByRole('button', { name: '검으로 뿌리를 베어낸다' }).click()
  await page.waitForSelector('text=다음은 산')
  body = await bodyText(page)
  console.log('✓ fo-resolution (warrior ending)')
  console.log('  meta 출정 1 (post-wipe):', /출정\s*1/.test(body))
  console.log('  HP=2 (5 -1 -2):', /HP\s*2/.test(body))

  // ─── Warrior also gets transition button ────────────────────────────
  const warriorEndingBtns = await visibleButtons(page)
  console.log(
    '✓ warrior path also gets transition button:',
    warriorEndingBtns.some((b) => b.includes('잊혀진 산맥으로 간다')),
  )

  await browser.close()
  console.log('\nQA smoke passed (Week 4 / region transition).')
}

main().catch((e) => {
  console.error('QA FAILED:', e)
  process.exit(1)
})
