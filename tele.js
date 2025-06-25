// teleport_solver.js
// Run with: npm install playwright dotenv
// Usage: node teleport_solver.js

const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const email = process.env.LP_EMAIL;
    const password = process.env.LP_PASSWORD;
    const teleportUrl = process.env.LP_TELEPORT_URL;

    // --- Step 1: Login ---
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

    // --- Step 2: Cookie acceptance ---
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
        await page.waitForTimeout(5000);
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

    // --- Step 3: Navigate to teleport page ---
    console.log("🌐 Navigating to teleport event page...");
    await page.goto(teleportUrl, { waitUntil: 'domcontentloaded' });

    // --- Step 4: Begin teleport automation ---
    console.log('Step 4: Refresh & wait...');
    await page.reload();
    await page.waitForTimeout(30000);
    const emeralds = parseInt(await page.textContent('#player-emeralds'));
    console.log('Emeralds:', emeralds);
    if (emeralds < 3) {
      console.log('➡️ Not enough emeralds. Exiting.');
      return browser.close();
    }
    let tries = await page.$$eval('div.currency-tries > span.currency-circle-full', els => els.length);
    console.log('Initial tries:', tries);
    if (tries === 0) {
      console.log('➡️ No tries available. Exiting.');
      return browser.close();
    }

    const getIndex = (r, c) => (r - 1) * 10 + c;
    const getCoords = idx => [Math.floor((idx - 1) / 10) + 1, ((idx - 1) % 10) + 1];
    const getNeighbors = (r, c) => {
      const n = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 1 && rr <= 10 && cc >= 1 && cc <= 10) n.push([rr, cc]);
        }
      }
      return n;
    };
    const key = ([r, c]) => `${r},${c}`;
    const randomPick = arr => arr[Math.floor(Math.random() * arr.length)];

    while (tries > 0) {
      const grid = await page.$$eval('div.zone-grid > div > span', spans =>
        spans.map((sp, i) => {
          const cls = sp.className;
          let t = 'untouched';
          if (cls.includes('opened miss')) t = 'block';
          else if (cls.includes('opened reward')) t = 'reward';
          else if (cls.includes('opened empty')) t = 'empty';
          else if (cls.includes('pending hint')) t = 'hint';
          return { idx: i + 1, type: t };
        })
      );

      const sets = { block: [], reward: [], empty: [], hint: [], untouched: [] };
      grid.forEach(c => {
        const [r, c0] = getCoords(c.idx);
        sets[c.type].push([r, c0]);
      });

      const toMap = arr => new Set(arr.map(key));
      const blockSet = toMap(sets.block);
      const rewardSet = toMap(sets.reward);
      const emptySet = toMap(sets.empty);
      const hintSet = toMap(sets.hint);
      const untouchedSet = toMap(sets.untouched);

      const bigBlock = new Set();
      blockSet.forEach(k => {
        const [r, c0] = k.split(',').map(Number);
        getNeighbors(r, c0).forEach(nn => bigBlock.add(key(nn)));
      });
      blockSet.forEach(b => bigBlock.add(b));
      rewardSet.forEach(r0 => bigBlock.delete(r0));
      emptySet.forEach(e0 => bigBlock.delete(e0));

      const sacrificialHint = new Set([...hintSet].filter(h => bigBlock.has(h)));
      const laggingHint = new Set([...hintSet].filter(h => !bigBlock.has(h)));
      const qualifiedUntouch = new Set([...untouchedSet].filter(u => !bigBlock.has(u)));
      const highProb = new Set([...laggingHint, ...qualifiedUntouch]);

      const totalCheck = bigBlock.size + rewardSet.size + emptySet.size + laggingHint.size + qualifiedUntouch.size;
      const altCheck = bigBlock.size + rewardSet.size + emptySet.size + highProb.size;
      console.log('Set validation:', totalCheck === 100, altCheck === 100);

      let clicked = false;
      const hintArr = [...hintSet];
      if (hintArr.length > 0) {
        let minMark = Infinity, hingeList = [];
        hintArr.forEach(hk => {
          const [hr, hc] = hk.split(',').map(Number);
          const marks = getNeighbors(hr, hc).filter(nk => highProb.has(key(nk))).length;
          if (marks <= minMark) {
            if (marks < minMark) hingeList = [];
            minMark = marks;
            hingeList.push({ cell: hk, marks });
          }
        });

        if (minMark <= 3 && hingeList.length) {
          const sac = hingeList.filter(h => sacrificialHint.has(h.cell));
          const chosenH = randomPick(sac.length ? sac : hingeList);
          const [hr, hc] = chosenH.cell.split(',').map(Number);
          const targetNeighbors = getNeighbors(hr, hc).filter(nk => highProb.has(key(nk)));

          if (targetNeighbors.length) {
            let clickTarget;
            if (targetNeighbors.length === 1) {
              clickTarget = targetNeighbors[0];
            } else {
              if (!sacrificialHint.has(chosenH.cell)) {
                const others = targetNeighbors.filter(t => key(t) !== chosenH.cell);
                clickTarget = others.length ? randomPick(others) : randomPick(targetNeighbors);
              } else {
                clickTarget = randomPick(targetNeighbors);
              }
            }

            console.log('Phase I click:', clickTarget);
            const idx = getIndex(...clickTarget);
            await page.click(`.zone-grid > div > span:nth-child(${idx})`);
            tries--;
            await page.waitForTimeout(20000);
            clicked = true;
          }
        }
      }

      if (!clicked && tries > 0) {
        console.log('Phase II disturbance click...');
        const progress = await page.textContent('.all-rewards-button-label');
        const collected = parseInt(progress.split('/')[0].trim());
        const priority = collected < 12
          ? [[2, 2], [2, 9], [9, 2], [9, 9]]
          : [[3, 3], [3, 8], [8, 3], [8, 8]];
        const candidates = priority.filter(p => highProb.has(key(p)));
        if (candidates.length >= 2) {
          const tk = randomPick(candidates);
          console.log('Priority disturbance click:', tk);
          const idx = getIndex(...tk);
          await page.click(`.zone-grid > div > span:nth-child(${idx})`);
          tries--;
          await page.waitForTimeout(20000);
          clicked = true;
        }
      }

      if (!clicked && tries > 0) {
        const candidateHP = [...highProb];
        let best = [], bestCount = -1;
        candidateHP.forEach(hk => {
          const [hr, hc] = hk.split(',').map(Number);
          const overlap = getNeighbors(hr, hc).filter(nk => bigBlock.has(key(nk))).length;
          if (overlap > bestCount) { bestCount = overlap; best = [hk]; }
          else if (overlap === bestCount) best.push(hk);
        });
        if (bestCount > 0) {
          const tk = randomPick(best).split(',').map(Number);
          console.log('Phase II overlap-bigblock click:', tk);
          const idx = getIndex(...tk);
          await page.click(`.zone-grid > div > span:nth-child(${idx})`);
          tries--;
          await page.waitForTimeout(20000);
          clicked = true;
        }
      }

      if (!clicked && tries > 0) {
        const candidateHP = [...highProb];
        let best = [], bestCount = -1;
        candidateHP.forEach(hk => {
          const [hr, hc] = hk.split(',').map(Number);
          const overlap = getNeighbors(hr, hc).filter(nk => laggingHint.has(key(nk))).length;
          if (overlap > bestCount) { bestCount = overlap; best = [hk]; }
          else if (overlap === bestCount) best.push(hk);
        });
        if (bestCount > 0) {
          const tk = randomPick(best).split(',').map(Number);
          console.log('Phase II overlap-lagging click:', tk);
          const idx = getIndex(...tk);
          await page.click(`.zone-grid > div > span:nth-child(${idx})`);
          tries--;
          await page.waitForTimeout(20000);
          clicked = true;
        }
      }

      if (!clicked && tries > 0) {
        const candidates = [...highProb];
        const tk = randomPick(candidates).split(',').map(Number);
        console.log('Phase II fallback click:', tk);
        const idx = getIndex(...tk);
        await page.click(`.zone-grid > div > span:nth-child(${idx})`);
        tries--;
        await page.waitForTimeout(20000);
        clicked = true;
      }

      console.log('Remaining tries:', tries);
    }

    console.log('All done — no tries left.');
    await browser.close();
  } catch (error) {
    console.error("💥 Unexpected error:", error);
    await browser.close();
  }
})();
