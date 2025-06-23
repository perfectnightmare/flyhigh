const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const email = process.env.LP_EMAIL;
    const password = process.env.LP_PASSWORD;
    const slotsUrl = process.env.LP_SLOTS_URL; // URL to the slots event page

    // ----------------------------------------
    // 🔐 Step 1 + 2: Login + Credential Handling
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        console.log(`🔐 [Attempt ${attempt}] Opening Lady Popular login page...`);
        await page.goto('https://ladypopular.com', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        console.log("🔎 Waiting for Sign In button...");
        await page.waitForSelector('#login-btn', { timeout: 30000 });
        await page.waitForTimeout(5000);
        await page.click('#login-btn');

        console.log("🔐 Entering credentials...");
        await page.waitForSelector('#login-username-field', { timeout: 10000 });
        await page.fill('#login-username-field', email);
        await page.fill('#loginForm3 > div > label:nth-child(2) > input[type=password]', password);
        await page.waitForTimeout(5000);
        await page.click('#loginSubmit');

        await page.waitForSelector('#header', { timeout: 15000 });
        console.log("🎉 Login successful.");
        break;
      } catch (error) {
        console.log(`❌ Login attempt ${attempt} failed: ${error.message}`);
        if (attempt === 5) {
          console.log("🚫 Max login attempts reached. Aborting.");
          await page.screenshot({ path: 'login-error.png', fullPage: true });
          await browser.close();
          return;
        }
      }
    }

    // ----------------------------------------
    // 🍪 Step 3: Wait and strictly enforce cookie consent
    console.log("⏳ Waiting 1 minute for cookie popup to appear...");
    await page.waitForTimeout(60000); // Wait 1 minute after login

    const cookieSelectors = [
      '#accept-all-btn',
      'button:has-text("Accept All")',
      'button:has-text("Accept")',
      'button:has-text("Confirm")',
      'button:has-text("Agree")'
    ];

    let cookieAccepted = false;

    for (const selector of cookieSelectors) {
      try {
        const button = await page.waitForSelector(selector, { timeout: 10000 });
        await page.waitForTimeout(5000); // Short pause before clicking
        await button.click();
        console.log(`✅ Cookie accepted using selector: ${selector}`);
        cookieAccepted = true;
        break;
      } catch {
        console.log(`❌ Cookie button not found with selector: ${selector}`);
      }
    }

    if (!cookieAccepted) {
      console.log("🚫 Cookie consent failed. Exiting script.");
      await page.screenshot({ path: 'cookie-failure.png', fullPage: true });
      await browser.close();
      process.exit(1);
    }

    // ----------------------------------------
    // 🎰 Step 4: Navigate to slots event page
    console.log("🌐 Navigating to slots event page...");
    await page.goto(slotsUrl, { waitUntil: 'domcontentloaded' });

    // 🔄 Refresh the page 3 times, waiting 30s after each
    for (let i = 1; i <= 3; i++) {
      console.log(`🔄 Refreshing slots page (Attempt ${i}/3)...`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(30000); // Wait 30 seconds after each refresh
    }

    // ----------------------------------------
    // 🎰 Step 5: Repeatedly click spin if tries and emeralds available
    while (true) {
      // 💎 Check emeralds count
      const emeraldsText = await page.$eval('#player-emeralds', el => el.textContent.trim());
      const emeralds = parseInt(emeraldsText.replace(/[^\d]/g, ''), 10);

      if (isNaN(emeralds) || emeralds < 3) {
        console.log(`💎 Not enough emeralds to spin. You have: ${emeralds}`);
        break;
      }

      // 🎯 Check available tries
      // Count full currency circles and subtract 1
      const tries = Math.max(0, (await page.$$eval('.currency-circle-full', spans => spans.length)) - 1);
      if (tries === 0) {
        console.log("🎯 No tries left. Exiting.");
        break;
      }

      // 🎰 Click the spin button
      console.log(`🎰 Spinning... (Tries left: ${tries}, Emeralds: ${emeralds})`);
      try {
        await page.click('#content > div.wrapper.clear > div.slot-event-wrapper > div.slot-event-machine-wrapper > div.spin-btn');
      } catch (clickError) {
        console.error("❌ Click failed, taking screenshot...");
        await page.screenshot({ path: 'click-failure.png', fullPage: true });
        throw clickError;
      }

      await page.waitForTimeout(15000); // Wait for spin animation
    }

    console.log("🏁 Finished all spins or out of emeralds/tries.");
    await browser.close();
  } catch (err) {
    console.error("❌ Unhandled error:", err.message);
    await page.screenshot({ path: 'unhandled-error.png', fullPage: true });
    console.log("📸 Saved screenshot: unhandled-error.png");
    await browser.close();
    process.exit(1);
  }
})();
