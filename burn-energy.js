// include tickets
const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const email = process.env.LP_EMAIL;
  const password = process.env.LP_PASSWORD;

  try {
    // 🔐 Login
    let loginSuccess = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        console.log(`🔐 [Attempt ${attempt}] Opening Lady Popular login page...`);
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
        console.log("🎉 Login successful.");
        loginSuccess = true;
        break;
      } catch (error) {
        console.log(`❌ Login attempt ${attempt} failed: ${error.message}`);
        await page.screenshot({ path: `login-error-${attempt}.png`, fullPage: true });
        if (attempt === 5) {
          await browser.close();
          return;
        }
      }
    }

    // 🍪 Cookie Consent
    const cookieSelectors = [
      '#accept-all-btn',
      'button:has-text("Accept All")',
      'button:has-text("Accept")',
      'button:has-text("Confirm")',
      'button:has-text("Agree")'
    ];

    let cookieAccepted = false;
    for (let selector of cookieSelectors) {
      try {
        const btn = await page.waitForSelector(selector, { timeout: 10000 });
        await page.waitForTimeout(15000);
        await btn.click();
        cookieAccepted = true;
        break;
      } catch {}
    }

    if (!cookieAccepted) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(5000);
      for (let selector of cookieSelectors) {
        try {
          const btn = await page.waitForSelector(selector, { timeout: 10000 });
          await page.waitForTimeout(15000);
          await btn.click();
          cookieAccepted = true;
          break;
        } catch {}
      }
    }

    if (!cookieAccepted) {
      console.log("❌ Cookie not accepted.");
      await browser.close();
      return;
    }

    // 🟧 Fashion Arena
    let arenaEnergy = 1;
    while (arenaEnergy > 0) {
      try {
        await page.goto('https://v3.g.ladypopular.com/duels.php', { timeout: 60000 });
        for (let i = 0; i < 3; i++) {
          await page.reload({ timeout: 30000 });
          await page.waitForTimeout(1500);
        }
        const energyText = await page.innerText('#header .player-arena-energy .player-energy-value span');
        arenaEnergy = parseInt(energyText.trim());

        if (arenaEnergy <= 0 || isNaN(arenaEnergy)) break;

        for (let i = 0; i < arenaEnergy; i++) {
          try {
            await page.click('#challengeLady', { timeout: 5000 });
            await page.waitForTimeout(1000);
          } catch {}
        }

        break;
      } catch {
        await page.reload({ timeout: 60000 });
        await page.waitForTimeout(5000);
      }
    }

    // 💅 Beauty Pageant
    await page.goto('https://v3.g.ladypopular.com/beauty_pageant.php', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(10000);

    const energySelector = '#header .player-bp-energy .player-energy-value';
    const parseEnergy = async () => parseInt((await page.innerText(energySelector)).trim());
    let voteCoordinate = { x: 345, y: 512 };

    let lastEnergy = await parseEnergy();
    while (lastEnergy > 1) {
      try {
        await page.goto('https://v3.g.ladypopular.com/beauty_pageant.php', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        await page.waitForTimeout(5000);
        await page.click('#judgeButton');

        for (let i = 0; i < 3; i++) {
          await page.mouse.click(voteCoordinate.x, voteCoordinate.y);
          await page.waitForTimeout(5000);
        }

        const newEnergy = await parseEnergy();
        if (newEnergy < lastEnergy) {
          lastEnergy = newEnergy;
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    // 🔁 Refresh before Step 6
    await page.goto('https://v3.g.ladypopular.com/beauty_pageant.php', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(5000);

    // 🎟️ Compete with Tickets
    const getTicketCount = async () => {
      const ticketText = await page.innerText('.bp-pass-amount');
      return parseInt(ticketText.trim());
    };

    let tickets = await getTicketCount();
    console.log(`🎟️ You have ${tickets} tickets.`);

    while (tickets > 0) {
      try {
        console.log(`🧨 Using ticket ${tickets}... clicking compete button.`);
        await page.click('#competeInDuel', { timeout: 5000 });
        await page.waitForTimeout(6000);

        await page.goto('https://v3.g.ladypopular.com/beauty_pageant.php', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        await page.waitForTimeout(5000);
        tickets = await getTicketCount();
        console.log(`🎟️ Tickets remaining: ${tickets}`);
      } catch (e) {
        console.log(`⚠️ Error using ticket: ${e.message}`);
        await page.screenshot({ path: `bp-ticket-error-${tickets}.png`, fullPage: true });
        break;
      }
    }

    console.log("🎯 All tickets used or error occurred. Closing browser.");
  } catch (err) {
    console.error("💥 Script crashed:", err);
    await page.screenshot({ path: 'error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
