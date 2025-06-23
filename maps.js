const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const email = process.env.LP_EMAIL;
  const password = process.env.LP_PASSWORD;
  const mapsUrl = process.env.LP_MAPS_URL;

  try {
    // ----------------------------------------
    // 🔐 Login
    let loginSuccess = false;
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
        loginSuccess = true;
        break;

      } catch (error) {
        console.log(`❌ Login attempt ${attempt} failed: ${error.message}`);
        await page.screenshot({ path: `login-error-${attempt}.png`, fullPage: true });

        if (attempt === 5) {
          console.log("🚫 Max login attempts reached. Aborting.");
          await browser.close();
          return;
        }
      }
    }

    // ----------------------------------------
    // 🍪 Cookie Handling
    const cookieSelectors = [
      '#accept-all-btn',
      'button:has-text("Accept All")',
      'button:has-text("Accept")',
      'button:has-text("Confirm")',
      'button:has-text("Agree")'
    ];

    async function attemptCookieConsent() {
      console.log("🍪 Looking for cookie consent button...");
      for (const selector of cookieSelectors) {
        try {
          const button = await page.waitForSelector(selector, { timeout: 10000 });
          await page.waitForTimeout(15000);
          await button.click();
          console.log(`🍪 Cookie accepted using selector: ${selector}`);
          await page.waitForTimeout(10000);
          return true;
        } catch {
          console.log(`🔍 Cookie button not found with selector: ${selector}`);
        }
      }
      return false;
    }

    let cookieAccepted = await attemptCookieConsent();
    if (!cookieAccepted) {
      console.log("🔁 Cookie button not found. Refreshing and retrying...");
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(5000);
      cookieAccepted = await attemptCookieConsent();
    }

    if (!cookieAccepted) {
      console.log("❌ Failed to accept cookie even after retry. Aborting.");
      await page.screenshot({ path: 'cookie-error.png', fullPage: true });
      await browser.close();
      return;
    }

    // ----------------------------------------
    // 🗺️ Maps Event Section Starts Here
    console.log("🗺️ Navigating to Maps Event...");
    await page.goto(mapsUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    for (let i = 1; i <= 3; i++) {
      console.log(`🔄 Refreshing Maps Event page (${i}/3)...`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(60000);
    }

    const fullCircles = await page.$$eval(
      '.currency-tries .currency-circle.currency-circle-full',
      circles => circles.length
    );
    console.log(`🎯 Full tries available: ${fullCircles}`);

    let successfulClicks = 0;

    for (let i = 0; i < fullCircles; i++) {
      const emeraldText = await page.$eval('#player-emeralds', el => el.textContent.trim());
      const emeralds = parseInt(emeraldText.replace(/[^\d]/g, ''));

      if (emeralds < 2) {
        console.log(`❌ Only ${emeralds} emeralds left. Stopping.`);
        break;
      }

      const unopenedCells = await page.$$('a.square.unopened');
      if (unopenedCells.length === 0) {
        console.log("✅ No unopened cells left.");
        break;
      }

      const randomIndex = Math.floor(Math.random() * unopenedCells.length);
      const cell = unopenedCells[randomIndex];

      await cell.scrollIntoViewIfNeeded();
      const relAttr = await cell.getAttribute('rel');
      await cell.click();
      successfulClicks++;

      console.log(`✅ Clicked cell rel=${relAttr}. Emeralds left: ${emeralds - 2}`);

      await page.waitForTimeout(15000);
    }

    console.log(`🏁 Maps complete. Total clicks: ${successfulClicks}`);
  } catch (err) {
    console.error("💥 Script crashed:", err);
    await page.screenshot({ path: 'error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
