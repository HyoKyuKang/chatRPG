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
  // Disable Phase B staged reveal during smoke (NodeView checks prefers-reduced-motion)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('pageerror', (e) => console.error('  [pageerror]', e.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('  [console.error]', msg.text())
  })

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY)
  await page.reload({ waitUntil: 'networkidle' })

  // ─── Mage path → ending ────────────────────────────────────────────
  await page.waitForSelector('text=안개 속에서 깨어난다')
  console.log('✓ fo-arrive (fresh state)')

  await page.getByRole('button', { name: '안개 너머를 살핀다' }).click()
  await page
    .getByRole('button', { name: '새벽의 첨탑... 거기로 가면 되나?' })
    .click()
  await page.waitForSelector('text=두 가지가 놓여 있다')
  const forkBtns = await visibleButtons(page)
  console.log(
    '✓ fo-fork — 양피지 visible:',
    forkBtns.some((b) => b.includes('양피지')),
  )

  await page.getByRole('button', { name: '낡은 양피지를 조심스레 펼친다' }).click()
  await page.waitForSelector('text=흰 머리의 노인')
  console.log('✓ fo-bayren-meet')

  await page.getByRole('button', { name: '이 글자, 읽을 수 있나?' }).click()
  await page.waitForSelector('text=딱 한 번 외워봐')
  await page.getByRole('button', { name: '숨을 고르고 따라 읽는다' }).click()
  await page.waitForSelector('text=외운 건 외운 거다')
  console.log('✓ fo-mage-awaken')

  await page.getByRole('button', { name: '룬을 다시 입에 올린다' }).click()
  await page.waitForSelector('text=썩은 단 냄새')
  let body = await bodyText(page)
  console.log('  class displayed as 마법사:', /마법사/.test(body))
  console.log('  MP=2 (rune cost):', /MP\s*2/.test(body))

  await page.getByRole('button', { name: '뿌리 사이를 살피며 간다' }).click()
  await page.waitForSelector('text=거대한 나무가 너 앞에 솟아 있다')
  const gatewayBtns = await visibleButtons(page)
  // W10 gateway B: combat-typed nodes render NodeView with gateway choices
  // first. Boss = engage-only (no evade); the player must click [물러서지 않는다] before
  // CombatView mounts and exposes the per-class action buttons.
  console.log(
    '✓ fo-boss-tree (gateway) — 물러서지 않는다 visible:',
    gatewayBtns.some((b) => b.includes('물러서지 않는다')),
  )
  console.log(
    '  combat actions hidden in gateway (룬 action not shown pre-engage):',
    !gatewayBtns.some((b) => b.includes('룬을 뿌리에')),
  )

  await page.getByRole('button', { name: '물러서지 않는다' }).click()
  // CombatView mounts; combat actions now visible.
  await page.waitForSelector('button:has-text("룬을 뿌리에 박아 넣는다")')
  const bossBtns = await visibleButtons(page)
  console.log(
    '✓ fo-boss-tree (engaged) — 룬을 뿌리에 박아 넣는다 available for mage:',
    bossBtns.some((b) => b.includes('룬을 뿌리에')),
  )

  await page.getByRole('button', { name: '룬을 뿌리에 박아 넣는다' }).click()
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
  await page.waitForSelector('text=안개 속에서 깨어난다')
  body = await bodyText(page)
  console.log('✓ wipe + reload → fresh run, meta cleared:', !/출정/.test(body))

  await page.getByRole('button', { name: '몸을 일으킨다' }).click()
  await page
    .getByRole('button', { name: '잠깐. 난 아직 아무것도 모른다' })
    .click()
  await page.waitForSelector('text=두 가지가 놓여 있다')
  const forkBtnsAlt = await visibleButtons(page)
  console.log(
    '✓ fo-fork (no glimpse) — both class choices visible:',
    forkBtnsAlt.some((b) => b.includes('양피지')) &&
      forkBtnsAlt.some((b) => b.includes('녹슨 검')),
  )

  await page.getByRole('button', { name: '녹슨 검 쪽으로 손을 뻗는다' }).click()
  await page.waitForSelector('text=신참 템플러')
  console.log('✓ fo-astrid-meet')

  await page.getByRole('button', { name: '혼자보단 낫겠지' }).click()
  await page.waitForSelector('text=부패한 늑대')
  // Gateway: regular fight gets engage + evade. Click engage to enter combat.
  const astridGate = await visibleButtons(page)
  console.log(
    '✓ fo-astrid-fight (gateway) — 허리의 검을 뽑는다 + 풀숲 쪽으로 물러난다 둘 다 보임:',
    astridGate.some((b) => b.includes('검을 뽑는다')) &&
      astridGate.some((b) => b.includes('풀숲 쪽으로')),
  )
  await page.getByRole('button', { name: '허리의 검을 뽑는다' }).click()
  await page.waitForSelector('button:has-text("늑대의 옆구리를 노린다")')
  await page.getByRole('button', { name: '늑대의 옆구리를 노린다' }).click()
  await page.waitForSelector('text=처음 잡는 사람 같지 않아')
  console.log('✓ fo-warrior-awaken')

  await page.getByRole('button', { name: '검을 놓지 않는다' }).click()
  await page.waitForSelector('text=썩은 단 냄새')
  body = await bodyText(page)
  console.log('  class displayed as 전사:', /전사/.test(body))
  console.log('  HP=4 (sword swing -1):', /HP\s*4/.test(body))

  await page.getByRole('button', { name: '검게 시든 길을 따라간다' }).click()
  await page.waitForSelector('text=거대한 나무가 너 앞에 솟아 있다')
  // Gateway again — engage first, then per-class action becomes available.
  await page.getByRole('button', { name: '물러서지 않는다' }).click()
  await page.waitForSelector('button:has-text("뿌리 깊은 곳을 벤다")')
  const bossBtnsW = await visibleButtons(page)
  console.log(
    '✓ fo-boss-tree (engaged, warrior) — 뿌리 깊은 곳을 벤다 available:',
    bossBtnsW.some((b) => b.includes('뿌리 깊은 곳을 벤다')),
  )

  await page.getByRole('button', { name: '뿌리 깊은 곳을 벤다' }).click()
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
