module.exports = async function runBurnEnergy(page) {
  // 🟧 FASHION ARENA
  let arenaEnergy = 1;

  while (arenaEnergy > 0) {
    try {
      console.log("🟧 Navigating to Fashion Arena...");
      await page.goto('https://v3.g.ladypopular.com/duels.php', { timeout: 60000 });

      for (let i = 1; i <= 3; i++) {
        console.log(`🔄 Refreshing Fashion Arena page (${i}/3)...`);
        await page.reload({ timeout: 30000 });
        await page.waitForTimeout(1500);
      }

      const energyText = await page.innerText(
        '#header > div.wrapper > div > div.player-panel-middle > div.player-panel-energy > a.player-energy.player-arena-energy > span.player-energy-value > span'
      );
      arenaEnergy = parseInt(energyText.trim());

      if (arenaEnergy <= 0 || isNaN(arenaEnergy)) {
        console.log("✅ No energy left. Skipping Fashion Arena.");
        break;
      }

      console.log(`🔋 You have ${arenaEnergy} energy. Starting duels...`);

      for (let i = 0; i < arenaEnergy; i++) {
        try {
          await page.click('#challengeLady', { timeout: 5000 });
          console.log(`⚔️ Duel ${i + 1}`);
          await page.waitForTimeout(1000);
        } catch (e) {
          console.log(`⚠️ Duel ${i + 1} failed: ${e.message}`);
          throw e;
        }
      }

      console.log("✅ Finished all duels in Fashion Arena.");
      break;

    } catch (err) {
      console.log("🔁 Error occurred. Refreshing page to retry Fashion Arena...");
      await page.reload({ timeout: 60000 });
      await page.waitForTimeout(5000);
    }
  }

  // 💅 BEAUTY PAGEANT
  console.log("🔷 Navigating to Beauty Pageant page...");
  await page.goto('https://v3.g.ladypopular.com/beauty_pageant.php', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(10000);

  const energySelector = '#header > div.wrapper > div > div.player-panel-middle > div.player-panel-energy > a.player-energy.player-bp-energy > span.player-energy-value';
  const parseEnergy = async () => parseInt((await page.innerText(energySelector)).trim());

  let blueEnergy = await parseEnergy();
  const judgeCycles = Math.floor(blueEnergy / 2);
  console.log(`🔷 You have ${blueEnergy} blue energy. Performing up to ${judgeCycles} judge + vote cycles...`);

  // Step B: Try fixed coordinate
  let voteCoordinate = null;
  let coordinateVerified = false;

  async function testFixedCoordinate() {
    console.log("📌 Testing fixed vote coordinate (345,512)...");
    await page.click('#judgeButton');
    await page.waitForTimeout(2000);

    const initialEnergy = await parseEnergy();
    for (let i = 0; i < 3; i++) {
      await page.mouse.click(345, 512);
      await page.waitForTimeout(5000);
    }
    const finalEnergy = await parseEnergy();
    if (finalEnergy < initialEnergy) {
      voteCoordinate = { x: 345, y: 512 };
      console.log("✅ Fixed vote coordinate (345,512) confirmed.");
      return true;
    } else {
      console.log("❌ Fixed vote coordinate (345,512) did not reduce energy.");
      return false;
    }
  }

  coordinateVerified = await testFixedCoordinate();
  if (!coordinateVerified) {
    console.log("🔄 Retrying coordinate (345,512) after refresh...");
    await page.goto('https://v3.g.ladypopular.com/beauty_pageant.php', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(10000);
    coordinateVerified = await testFixedCoordinate();
  }

  if (!coordinateVerified) {
    console.log("📍 Falling back to arrow-based vote coordinate detection...");
    await page.goto('https://v3.g.ladypopular.com/beauty_pageant.php', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(10000);

    try {
      await page.click('#judgeButton');
      await page.waitForSelector('#dynamic-info-container > div.judge-panel > div.judge-left', { timeout: 10000 });

      const arrow = await page.$('#dynamic-info-container > div.judge-panel > div.judge-left');
      const box = await arrow.boundingBox();
      if (!box) throw new Error("Judge-left arrow not found");

      voteCoordinate = {
        x: box.x - 100,
        y: box.y + box.height / 2
      };

      console.log(`✅ Vote coordinate locked at (${Math.round(voteCoordinate.x)}, ${Math.round(voteCoordinate.y)})`);
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log("❌ Fallback coordinate detection failed: " + e.message);
      await page.screenshot({ path: 'bp-fallback-error.png', fullPage: true });
      return;
    }
  }

  // 🔁 Judge + Vote Loop
  let completed = 0;
  let lastEnergy = await parseEnergy();

  while (lastEnergy > 1) {
    console.log(`👑 Cycle ${completed + 1}: Refreshing and clicking Judge...`);
    try {
      await page.goto('https://v3.g.ladypopular.com/beauty_pageant.php', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await page.waitForTimeout(5000);

      await page.waitForSelector('#judgeButton', { timeout: 10000 });
      await page.click('#judgeButton');
      console.log("🖱️ Judge clicked.");

      for (let i = 0; i < 3; i++) {
        await page.mouse.click(voteCoordinate.x, voteCoordinate.y);
        console.log(`🗳️ Vote click ${i + 1} at (${Math.round(voteCoordinate.x)}, ${Math.round(voteCoordinate.y)})`);
        await page.waitForTimeout(5000);
      }

      const currentEnergy = await parseEnergy();
      if (currentEnergy < lastEnergy) {
        lastEnergy = currentEnergy;
        completed++;
        console.log(`✅ Energy dropped. Now: ${currentEnergy}`);
      } else {
        console.log("⚠️ Energy did not change after voting. Skipping.");
      }

    } catch (e) {
      console.log(`⚠️ Judge cycle ${completed + 1} failed: ${e.message}`);
      await page.screenshot({ path: `bp-error-${completed + 1}.png`, fullPage: true });
    }
  }

  // 🎟️ Compete with Tickets
  console.log("🎟️ Checking ticket count to decide how many to use...");

  const getTicketCount = async () => {
    const ticketText = await page.innerText('.bp-pass-amount');
    return parseInt(ticketText.trim());
  };

  let tickets = await getTicketCount();
  console.log(`🎟️ You have ${tickets} tickets.`);

  let ticketsToUse = tickets - 90;

  if (ticketsToUse > 0) {
    console.log(`🎯 Using ${ticketsToUse} ticket(s)...`);
    while (ticketsToUse > 0) {
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
        ticketsToUse--;
        console.log(`🎟️ Tickets remaining: ${tickets}. Tickets left to use: ${ticketsToUse}`);
      } catch (e) {
        console.log(`⚠️ Error using ticket: ${e.message}`);
        await page.screenshot({ path: `bp-ticket-error-${tickets}.png`, fullPage: true });
        break;
      }
    }

    console.log("✅ Finished using excess tickets.");
  } else {
    console.log(`🚫 Tickets are ${tickets}. Not more than 90. Skipping.`);
  }
};
