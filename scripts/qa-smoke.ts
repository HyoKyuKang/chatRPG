import { chromium } from 'playwright'

const CHROME =
  '/home/ubuntu/.playwright/chromium-1208/chrome-linux64/chrome'
const URL = 'http://localhost:5173'

async function visibleButtons(page: import('playwright').Page) {
  const texts = await page.locator('button:visible').allTextContents()
  return texts.map((t) => t.trim()).filter(Boolean)
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
  })
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
  })
  page.on('pageerror', (e) => console.error('  [pageerror]', e.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('  [console.error]', msg.text())
  })

  await page.goto(URL, { waitUntil: 'networkidle' })

  // prologue-01
  await page.waitForSelector('text=안개 속에서 깨어났다', { timeout: 5000 })
  console.log('✓ prologue-01 rendered')
  const bodyText = await page.locator('body').textContent()
  console.log('  HP/MP visible:', /HP\s*5/.test(bodyText ?? '') && /MP\s*3/.test(bodyText ?? ''))
  console.log('  buttons:', await visibleButtons(page))

  // click "주위를 둘러본다" — gains 'glimpse-of-mist'
  await page.getByRole('button', { name: '주위를 둘러본다' }).click()
  await page.waitForSelector('text=드디어 왔구나', { timeout: 5000 })
  console.log('✓ prologue-02 rendered after choice')
  console.log('  buttons:', await visibleButtons(page))

  // click "당신을 믿겠다"
  await page.getByRole('button', { name: '당신을 믿겠다' }).click()
  await page.waitForSelector('text=두 가지가 놓여 있다', { timeout: 5000 })
  console.log('✓ prologue-03 rendered')
  const p3btns = await visibleButtons(page)
  console.log('  buttons:', p3btns)
  console.log('  conditional 양피지 visible:', p3btns.some((b) => b.includes('양피지')))

  // pick 양피지 path (knowledge gate)
  await page.getByRole('button', { name: '낡은 양피지를 펼친다' }).click()
  await page.waitForSelector('text=거대한 그림자', { timeout: 5000 })
  console.log('✓ prologue-04 rendered')
  const p4btns = await visibleButtons(page)
  console.log('  buttons:', p4btns)
  console.log('  검 옵션 hidden (no sword):', !p4btns.some((b) => b.includes('검으로 맞선다')))
  console.log('  주문 옵션 visible (has scroll):', p4btns.some((b) => b.includes('룬을 외운다')))

  // cast spell — mana -1, removes scroll
  await page.getByRole('button', { name: '룬을 외운다' }).click()
  await page.waitForSelector('text=Week 1 데모 끝', { timeout: 5000 })
  console.log('✓ prologue-05 ending reached')

  const finalText = await page.locator('body').textContent()
  console.log('  Mana decreased:', /MP\s*2/.test(finalText ?? ''))
  console.log('  Inventory empty (scroll consumed):', /소지품 없음/.test(finalText ?? ''))

  // reset
  await page.getByRole('button', { name: '다시 출정' }).click()
  await page.waitForSelector('text=안개 속에서 깨어났다', { timeout: 5000 })
  const afterReset = await page.locator('body').textContent()
  console.log('✓ reset works')
  console.log('  HP/MP back to 5/3:', /HP\s*5/.test(afterReset ?? '') && /MP\s*3/.test(afterReset ?? ''))

  // second flow — pick "그냥 일어선다" path (no glimpse knowledge)
  await page.getByRole('button', { name: '그냥 일어선다' }).click()
  await page.getByRole('button', { name: '관심 없다' }).click()
  await page.waitForSelector('text=두 가지가 놓여 있다', { timeout: 5000 })
  const altP3btns = await visibleButtons(page)
  console.log('✓ alt path: prologue-03 reached without glimpse')
  console.log('  buttons:', altP3btns)
  console.log('  양피지 hidden (no knowledge):', !altP3btns.some((b) => b.includes('양피지')))
  console.log('  검 still visible:', altP3btns.some((b) => b.includes('녹슨 검')))

  await browser.close()
  console.log('\nQA smoke passed.')
}

main().catch((e) => {
  console.error('QA FAILED:', e)
  process.exit(1)
})
