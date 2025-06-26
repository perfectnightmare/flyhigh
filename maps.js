// maps.js

module.exports = async function runMapsEvent(page) {
  const mapsUrl = process.env.LP_MAPS_URL;

  // 🗺️ Maps Event
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
};
