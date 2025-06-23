const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  const browser = await chromium.launch({ headless: true, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();

  const email = process.env.LP_EMAIL;
  const password = process.env.LP_PASSWORD;
  const memoryUrl = process.env.LP_MEMORY_URL;

  console.log("🚀 Launching browser...");

  // Step 1: Login
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      console.log(`🔐 [Attempt ${attempt}] Logging in...`);
      await page.goto('https://ladypopular.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#login-btn', { timeout: 30000 });
      await page.waitForTimeout(5000);
      await page.click('#login-btn');
      await page.waitForSelector('#login-username-field', { timeout: 10000 });
      await page.fill('#login-username-field', email);
      await page.fill('#loginForm3 > div > label:nth-child(2) > input[type=password]', password);
      await page.waitForTimeout(5000);
      await page.click('#loginSubmit');
      await page.waitForSelector('#header', { timeout: 15000 });
      console.log("✅ Logged in successfully.");
      break;
    } catch (err) {
      console.log(`❌ Login attempt ${attempt} failed: ${err.message}`);
      if (attempt === 5) {
        await browser.close();
        return;
      }
    }
  }

  // Step 2: Handle cookies
  console.log("⏳ Waiting for cookie popup...");
  await page.waitForTimeout(60000);
  const cookieSelectors = ['#accept-all-btn', 'button:has-text("Accept All")', 'button:has-text("Accept")', 'button:has-text("Confirm")', 'button:has-text("Agree")'];
  for (const selector of cookieSelectors) {
    try {
      const btn = await page.waitForSelector(selector, { timeout: 10000 });
      await page.waitForTimeout(5000);
      await btn.click();
      console.log("🍪 Cookie accepted.");
      break;
    } catch {
      console.log(`⚠️ Cookie selector not found: ${selector}`);
    }
  }

  // Step 3: Navigate to memory event
  console.log("🌐 Navigating to Memory Event...");
  await page.goto(memoryUrl, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 3; i++) {
    console.log(`🔄 Refresh ${i + 1}/3`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(30000);
  }

  // Step 4: Check emeralds
  const emeraldText = await page.textContent('#player-emeralds');
  const emeralds = parseInt(emeraldText.replace(/\D/g, ''));
  console.log(`💎 Emeralds found: ${emeralds}`);
  if (emeralds < 8) {
    console.log("🚫 Not enough emeralds. Exiting.");
    await browser.close();
    return;
  }

  // Step 5: Click start game
  console.log("▶️ Clicking start game button...");
  const startButton = await page.waitForSelector('button.btn-free-reset', { timeout: 30000 });
  await page.waitForTimeout(1000);
  await startButton.click({ force: true });
  await page.waitForSelector('.memory-grid-wrapper', { timeout: 30000 });
  console.log("🎯 Memory grid loaded.");

  // Step 6: Final refresh before game start
  console.log("🔁 Final pre-game refresh...");
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(30000);

  const getAllTiles = async () => await page.$$('.memory-grid-item:not(.memory-grid-item-fake)');
  
  async function clickTileAndGetId(index) {
    const tiles = await getAllTiles();
    const tile = tiles[index];
    if (!tile) return null;
    console.log(`🕒 Waiting 10s before clicking tile ${index}...`);
    await page.waitForTimeout(10000);
    await tile.click({ force: true });
    console.log(`✅ Clicked tile ${index}`);
    await page.waitForTimeout(100);
    const inner = await tile.waitForSelector('.memory-grid-item-inner', { timeout: 7000 }).catch(() => null);
    if (!inner) return null;
    const className = await inner.getAttribute('class');
    console.log(`📦 Class for tile ${index}: ${className}`);
    const match = className.match(/memory-grid-item-inner-(\d+)/);
    const innerId = match ? match[1] : null;
    console.log(`🔍 Tile ${index} has inner ID: ${innerId}`);
    return innerId;
  }

  async function isTileMatched(index) {
    const tiles = await getAllTiles();
    const tile = tiles[index];
    if (!tile) return false;
    const className = await tile.getAttribute('class');
    const matched = className.includes('opened') || className.includes('matched') || className.includes('disable-on-match');
    console.log(`🔎 Checking if tile ${index} is matched: ${matched}`);
    return matched;
  }

  const totalTiles = (await getAllTiles()).length;
  console.log(`🎯 Detected ${totalTiles} real tiles.`);
  const clickedOnce = new Set();
  const matched = new Set();
  const known = {};

  console.log("🧠 Phase 1: Discovering inner numbers...");

  while (clickedOnce.size < totalTiles) {
    let firstIndex = null;
    for (let i = 0; i < totalTiles; i++) {
      if (!clickedOnce.has(i) && !matched.has(i)) {
        firstIndex = i;
        break;
      }
    }
    if (firstIndex === null) break;

    const firstId = await clickTileAndGetId(firstIndex);
    clickedOnce.add(firstIndex);
    if (!firstId) continue;
    
    console.log(`📚 Current known map before checking match for firstId (${firstId}):`, JSON.stringify(known));
    const knownMatch = (known[firstId] || []).find(i => i !== firstIndex && !matched.has(i));
    let secondIndex;

    if (knownMatch != null) {
      secondIndex = knownMatch;
    } else {
      for (let i = 0; i < totalTiles; i++) {
        if (!clickedOnce.has(i) && !matched.has(i) && i !== firstIndex) {
          secondIndex = i;
          break;
        }
      }
    }

    if (secondIndex == null) continue;

    const secondId = await clickTileAndGetId(secondIndex);
    clickedOnce.add(secondIndex);
    if (!secondId) continue;

    known[firstId] = [...(known[firstId] || []), firstIndex];
    known[secondId] = [...(known[secondId] || []), secondIndex];

    await page.waitForTimeout(500);
    const m1 = await isTileMatched(firstIndex);
    const m2 = await isTileMatched(secondIndex);
    if (m1 && m2) {
      matched.add(firstIndex);
      matched.add(secondIndex);
      console.log(`✅ MATCHED: ${firstIndex} & ${secondIndex}`);
    } else {
      console.log(`❌ Not a match: ${firstIndex} & ${secondIndex}`);
    }
  }

  console.log("🧠 Phase 2: Matching all known pairs...");
  for (const [innerId, indices] of Object.entries(known)) {
    const unmatchedIndices = indices.filter(i => !matched.has(i));
    for (let i = 0; i < unmatchedIndices.length; i += 2) {
      const a = unmatchedIndices[i];
      const b = unmatchedIndices[i + 1];
      if (a == null || b == null) continue;
      await clickTileAndGetId(a);
      await clickTileAndGetId(b);
      await page.waitForTimeout(500);
      const m1 = await isTileMatched(a);
      const m2 = await isTileMatched(b);
      if (m1 && m2) {
        matched.add(a);
        matched.add(b);
        console.log(`✅ MATCHED in Phase 2: ${a} & ${b}`);
      } else {
        console.log(`❌ Phase 2 mismatch: ${a} & ${b}`);
      }
    }
  }

  if (matched.size === totalTiles) {
    console.log("🎉 All pairs matched!");
  } else {
    console.log(`⚠️ Game incomplete: Matched ${matched.size}/${totalTiles}`);
  }
  
  await browser.close();
  console.log("🛑 Browser closed.");
})();
