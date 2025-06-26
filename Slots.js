// Slots.js

module.exports = async function runSlotsEvent(page) {
  const slotsUrl = process.env.LP_SLOTS_URL;

  console.log("🌐 Navigating to slots event page...");
  await page.goto(slotsUrl, { waitUntil: 'domcontentloaded' });

  // 🔄 Refresh the page 3 times
  for (let i = 1; i <= 3; i++) {
    console.log(`🔄 Refreshing slots page (Attempt ${i}/3)...`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(30000); // Wait 30 seconds
  }

  // 🎰 Repeatedly click spin if tries and emeralds available
  while (true) {
    // 💎 Check emeralds
    const emeraldsText = await page.$eval('#player-emeralds', el => el.textContent.trim());
    const emeralds = parseInt(emeraldsText.replace(/[^\d]/g, ''), 10);

    if (isNaN(emeralds) || emeralds < 3) {
      console.log(`💎 Not enough emeralds to spin. You have: ${emeralds}`);
      break;
    }

    // 🎯 Check tries
    const tries = Math.max(0, (await page.$$eval('.currency-circle-full', spans => spans.length)) - 1);
    if (tries === 0) {
      console.log("🎯 No tries left. Exiting.");
      break;
    }

    // 🎰 Click spin
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
};
