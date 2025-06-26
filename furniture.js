async function runFurniture(page) {
  function parseDollars(text) {
    text = text.toLowerCase().replace(',', '').trim();
    if (text.endsWith('k')) return parseFloat(text) * 1000;
    if (text.endsWith('m')) return parseFloat(text) * 1_000_000;
    return parseFloat(text);
  }

  while (true) {
    console.log('🪑 Navigating to furniture mall...');
    await page.goto('https://v3.g.ladypopular.com/mall/mall.php?action=loadMallContent&mallType=3&nextLevelItems=false&categoryId=19');
    await page.waitForTimeout(15000);

    const dollarText = await page.locator('#player-dollars').innerText();
    const dollars = parseDollars(dollarText);
    console.log(`💰 Current dollars: ${dollars}`);

    if (dollars < 26000) {
      console.log('💸 Dollars below 26000. Stopping furniture loop.');
      break;
    }

    console.log('🛍️ Clicking item once...');
    const item = page.locator('#item_726').first(); // ✅ Only this line
    await item.click({ force: true });
    await page.waitForTimeout(15000);

    console.log('🎨 Waiting for color list...');
    await page.waitForSelector('dl.color-list', { timeout: 10000 });

    const colorSwatch = page.locator('dl.color-list img[src*="color_1.gif"]').first();
    console.log('🎯 Clicking color swatch 100 times...');
    for (let i = 0; i < 100; i++) {
      await colorSwatch.click({ force: true });
      await page.waitForTimeout(1000);
    }

    console.log('🧺 Clicking cart icon...');
    const cartIcon = page.locator('span.buttonIcon');
    try {
      await cartIcon.waitFor({ state: 'attached', timeout: 10000 });
      await cartIcon.click({ force: true });
    } catch (err) {
      console.error('❌ Failed to click cart icon:', err.message);
      await page.screenshot({ path: 'cart-icon-error.png', fullPage: true });
      throw err;
    }

    await page.waitForTimeout(20000);

    console.log('🪙 Waiting for Buy Items button...');
    const buyButton = page.locator('#cart-buy-btn');
    try {
      await buyButton.waitFor({ state: 'attached', timeout: 10000 });
      await buyButton.click({ force: true });
      console.log('✅ Buy button force-clicked.');
      await page.waitForTimeout(20000);
    } catch (err) {
      console.error('❌ Failed to force-click Buy Items button:', err.message);
      await page.screenshot({ path: 'buy-button-error.png', fullPage: true });
      throw err;
    }
  }

  console.log('✅ Furniture script finished.');
}

module.exports = runFurniture;
