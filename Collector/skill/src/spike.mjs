// Playwriter spike — proves the toolchain end to end.
//
// Prereqs (one-time, manual):
//   1. Install Playwriter Chrome extension:
//      https://chromewebstore.google.com/detail/playwriter-mcp/jfeammnjpkecdekppnclgkkffahnhfhe
//   2. In the SAME terminal session, run the relay (separate process):
//      npm run relay
//      (it stays running on 127.0.0.1:19988)
//   3. In Chrome, open https://example.com in a tab and click the Playwriter
//      extension icon. Icon turns green when attached.
//   4. Run this spike: `node src/spike.mjs`
//
// Success criteria: prints the page title without spawning a fresh Chrome,
// then writes spike-screenshot.png from the same logged-in tab.

import { chromium } from 'playwright-core'

const CDP_URL = 'http://127.0.0.1:19988'

async function main() {
  console.log(`→ Connecting to Playwriter relay at ${CDP_URL}`)
  const browser = await chromium.connectOverCDP(CDP_URL)

  const contexts = browser.contexts()
  if (contexts.length === 0) {
    throw new Error(
      'No browser contexts visible. Did you click the Playwriter extension icon on a tab? (Icon must be green.)'
    )
  }
  const ctx = contexts[0]
  const pages = ctx.pages()
  if (pages.length === 0) {
    throw new Error('Context has no pages. Open a tab and click the Playwriter icon.')
  }
  const page = pages[0]
  console.log(`→ Attached. URL: ${page.url()}`)
  console.log(`→ Title: ${await page.title()}`)

  await page.screenshot({ path: 'spike-screenshot.png' })
  console.log('→ Wrote spike-screenshot.png')

  await browser.close()
  console.log('✓ Spike OK')
}

main().catch((err) => {
  console.error('✗ Spike failed:', err.message)
  process.exit(1)
})
