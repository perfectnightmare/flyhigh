// burn energy + tickets
module.exports = async function runBurnEnergy(page) {
  try {
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

    console.log("🎯 All tickets used or error occurred.");
  } catch (err) {
    console.error("💥 Script crashed:", err);
    await page.screenshot({ path: 'error.png', fullPage: true });
  }
};
