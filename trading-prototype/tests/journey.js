// End-to-end check of the main journey: buy -> truck -> sell (India + export) -> payments -> dashboard.
// Run:  node tests/journey.js   (needs Playwright; start the app first on http://localhost:8080)
const { chromium } = require('playwright');
const assert = require('assert');
const URL = process.env.APP_URL || 'http://localhost:8080/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('dialog', d => d.accept());
  const text = sel => page.locator(sel).innerText();
  const fill = async vals => { for (const [k, v] of Object.entries(vals)) {
    const el = page.locator(`#f_${k}`);
    if (await el.evaluate(e => e.tagName) === 'SELECT') await el.selectOption(v); else await el.fill(String(v));
  } };
  const save = () => page.click('#dlgOk');
  const tab = t => page.click(`#tabs [data-tab=${t}]`);
  const step = m => console.log('✓', m);

  await page.goto(URL);
  assert.match(await text('#simBanner'), /SAMPLE DATA/);
  assert.equal(await text('#kpiProfit'), '₹2,24,200');   // 42,000 + 1,63,200 + 19,000
  assert.equal(await text('#kpiFarmers'), '₹12,04,500');
  assert.equal(await text('#kpiTransport'), '₹88,000');
  assert.equal(await text('#kpiBuyers'), '₹7,41,200');
  assert.equal(await text('#kpiOnion'), '170 qtl');
  step('sample data loads, labelled as simulated, dashboard totals correct');

  await page.click('[data-act=clear-all]');
  assert.equal(await text('#simBanner'), '');
  assert.equal(await text('#kpiProfit'), '₹0');
  step('start empty');

  // 1. Purchase
  await tab('purchases');
  await page.click('[data-act=new-lot]');
  await save();
  assert.match(await text('#dlgErr'), /Farmer name/);
  await fill({ commodity: 'Onion', farmer: 'Test Farmer', village: 'Nashik', qty: 200, rate: 2000, paid: 500000 });
  await save();
  assert.match(await text('#dlgErr'), /cannot be more than the total/);
  await fill({ paid: 100000 });
  assert.match(await text('#dlgCalc'), /₹4,00,000/);
  await save();
  assert.match(await text('tr[data-lot="O-001"]'), /Test Farmer[\s\S]*₹3,00,000 due/);
  step('purchase saved as lot O-001 (validation works)');

  // 2. Transport
  await tab('transport');
  await page.click('[data-act=new-trip]');
  assert.equal(await page.inputValue('#f_from'), 'Nashik');
  await fill({ transporter: 'Test Roadways', to: 'Delhi', qty: 500, freight: 30000 });
  await save();
  assert.match(await text('#dlgErr'), /only 200 qtl/);
  await fill({ qty: 100 });
  await save();
  await page.click('[data-act=trip-next]');
  assert.match(await text('tr[data-trip="T-001"]'), /In transit/);
  step('truck booked and marked in transit');

  // 3. Sales – domestic then export
  await tab('sales');
  await page.click('[data-act=new-sale]');
  assert.ok(await page.locator('[data-field=fx]').isHidden());
  await fill({ buyer: 'Delhi Trader', place: 'Delhi', qty: 300, rate: 2600 });
  await save();
  assert.match(await text('#dlgErr'), /Only 200 qtl is unsold/);
  await fill({ qty: 100, received: 60000 });
  await save();
  assert.match(await text('tr[data-sale="S-001"] .value'), /₹2,60,000/);

  await page.click('[data-act=new-sale]');
  await fill({ market: 'Export', buyer: 'Gulf Importer', place: 'Dubai, UAE', qty: 50, rate: 350 });
  assert.ok(await page.locator('[data-field=fx]').isVisible());
  assert.match(await text('[data-field=rate] label'), /USD per tonne/);
  await fill({ fx: 90 });
  await save();                                           // 5 t x $350 x 90 = 1,57,500
  assert.match(await text('tr[data-sale="S-002"] .value'), /₹1,57,500[\s\S]*\$1,750 @ ₹90/);
  step('domestic and export sales saved; over-selling is blocked');

  // 4. Payments
  await tab('money');
  await page.click('#dueBuyers [data-act=pay] >> nth=1');   // older sale S-001, balance 2,00,000
  assert.equal(await page.inputValue('#f_amount'), '200000');
  await fill({ amount: 999999 });
  await save();
  assert.match(await text('#dlgErr'), /more than the balance/);
  await fill({ amount: 200000 });
  await save();
  await page.click('#dueFarmers [data-act=pay]');
  await fill({ amount: 300000 });
  await save();
  assert.match(await text('#dueFarmers'), /All farmers are paid/);
  step('payments recorded');

  // 5. Dashboard: sales 4,17,500 - cost 150 x 2000 - freight 30,000 = 87,500
  await tab('dashboard');
  assert.equal(await text('#kpiProfit'), '₹87,500');
  assert.equal(await text('#kpiFarmers'), '₹0');
  assert.equal(await text('#kpiTransport'), '₹30,000');
  assert.equal(await text('#kpiBuyers'), '₹1,57,500');
  assert.equal(await text('#kpiOnion'), '50 qtl');
  assert.match(await text('tr[data-lot="O-001"] .profit'), /₹87,500/);
  step('dashboard shows correct profit, dues and stock');

  // 6. Data survives reload; linked lot cannot be deleted
  await page.reload();
  assert.equal(await text('#kpiProfit'), '₹87,500');
  await tab('purchases');
  await page.click('[data-act=del-lot]');
  assert.match(await text('#toast'), /linked/);
  assert.equal(await page.locator('tr[data-lot="O-001"]').count(), 1);
  step('data kept after reload; lot with sales cannot be deleted');

  await page.click('[data-act=reset-sample]');
  await tab('dashboard');
  await page.screenshot({ path: process.env.SHOT || 'dashboard.png', fullPage: true });
  assert.deepEqual(errors, []);
  step('no browser errors');
  await browser.close();
  console.log('\nALL CHECKS PASSED');
})().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
