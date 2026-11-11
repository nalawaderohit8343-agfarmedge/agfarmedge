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
  assert.equal(await text('#kpiProfit'), '₹1,64,855');   // 32,280 + 1,18,700 + 13,875
  assert.equal(await text('#kpiFarmers'), '₹12,04,500');
  assert.equal(await text('#kpiTransport'), '₹88,000');
  assert.equal(await text('#kpiBuyers'), '₹7,41,200');
  assert.equal(await text('#kpiOnion'), '165 qtl');
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
  await fill({ amount: 300000, date: '2026-11-05', note: 'UPI' });
  await save();
  assert.match(await text('#dueFarmers'), /All farmers are paid/);
  step('payments recorded');

  // 4b. Payment history: see dated entries, remove one, pay again
  await tab('purchases');
  await page.click('tr[data-lot="O-001"] [data-act=pay]');
  assert.match(await text('#dlgCalc'), /Paid at purchase[\s\S]*05-11-2026 · ₹3,00,000 · UPI/);
  await page.click('[data-act=del-payment] >> nth=1');
  assert.match(await text('#dlgCalc'), /balance ₹3,00,000/);
  await save();                                            // pays the full balance again
  assert.match(await text('tr[data-lot="O-001"]'), /Paid/);
  step('payment history kept with dates; a wrong entry can be removed');

  // 4c. Other costs and weight loss
  await tab('costs');
  await page.click('[data-act=new-cost]');
  await fill({ type: 'Labour / loading', amount: 5000, note: 'Loading' });
  await save();
  assert.match(await text('tr[data-cost="X-001"]'), /O-001[\s\S]*₹5,000/);
  await tab('purchases');
  await page.click('tr[data-lot="O-001"] [data-act=edit-lot]');
  await fill({ loss: 80 });
  await save();
  assert.match(await text('#dlgErr'), /cannot be more than the quantity bought/);
  await fill({ loss: 10 });
  await save();
  assert.equal(await text('tr[data-lot="O-001"] .unsold'), '40 qtl');
  step('other costs and weight loss recorded');

  // 4d. Printable bill
  await tab('sales');
  await page.click('tr[data-sale="S-002"] [data-act=doc]');
  assert.equal(await text('#docTitle'), 'EXPORT SALE BILL');
  assert.equal(await text('#docTotal'), '₹1,57,500');
  assert.match(await text('#doc'), /not a GST tax invoice/);
  await page.emulateMedia({ media: 'print' });
  assert.ok(await page.locator('#tabs').isHidden() && await page.locator('#docTotal').isVisible());
  await page.emulateMedia({ media: null });
  await page.click('[data-act=doc-close]');
  step('printable sale bill opens; print shows only the bill');

  // 5. Dashboard: sales 4,17,500 - cost (150 sold + 10 lost) x 2000 - freight 30,000 - costs 5,000 = 62,500
  await tab('dashboard');
  assert.equal(await text('#kpiProfit'), '₹62,500');
  assert.equal(await text('#kpiFarmers'), '₹0');
  assert.equal(await text('#kpiTransport'), '₹30,000');
  assert.equal(await text('#kpiBuyers'), '₹1,57,500');
  assert.equal(await text('#kpiOnion'), '40 qtl');
  assert.match(await text('tr[data-lot="O-001"] .profit'), /₹62,500/);
  step('dashboard shows correct profit, dues and stock');

  // 6. Data survives reload; linked lot cannot be deleted
  await page.reload();
  assert.equal(await text('#kpiProfit'), '₹62,500');
  await tab('purchases');
  await page.click('[data-act=del-lot]');
  assert.match(await text('#toast'), /linked/);
  assert.equal(await page.locator('tr[data-lot="O-001"]').count(), 1);
  step('data kept after reload; lot with sales cannot be deleted');

  // 7. Backup file -> wipe -> restore
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=backup]')]);
  const file = await dl.path();
  await page.click('[data-act=clear-all]');
  await tab('dashboard');
  assert.equal(await text('#kpiProfit'), '₹0');
  await page.setInputFiles('#restoreFile', file);
  await page.waitForFunction(() => document.querySelector('#kpiProfit').innerText === '₹62,500');
  step('backup downloaded and restored');

  // 8. Data saved by the older version (no payment history) still opens
  await page.evaluate(() => localStorage.setItem('agfg-trading-prototype-v1', JSON.stringify({ sample: false, fx: 88, seq: { lot: 1, trip: 0, sale: 0 },
    lots: [{ id: 'C-001', date: '2026-11-01', commodity: 'Cotton', farmer: 'Old', village: 'V', qty: 10, rate: 7000, paid: 20000 }], trips: [], sales: [] })));
  await page.reload();
  assert.equal(await text('#kpiFarmers'), '₹50,000');
  step('older saved data is upgraded');

  // 9. Names from the main AG Farmedge app are suggested
  await page.evaluate(() => localStorage.setItem('agfarmedge_v2', JSON.stringify({ farmers: [{ id: 1, name: 'Main App Farmer', village: 'Solapur' }], traders: [] })));
  await tab('purchases');
  await page.click('[data-act=new-lot]');
  assert.equal(await page.locator('#f_farmer_list option[value="Main App Farmer"]').count(), 1);
  await page.click('[data-act=dlg-cancel]');
  step('farmer names from the main app are suggested');

  await page.click('[data-act=reset-sample]');

  // 10. Phone: every tab fits the screen without sideways scrolling
  await page.setViewportSize({ width: 390, height: 800 });
  for (const t of ['dashboard', 'purchases', 'transport', 'sales', 'costs', 'money']) {
    await tab(t);
    const over = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, ...[...document.querySelectorAll('#view .scroll')].map(e => e.scrollWidth - e.clientWidth + innerWidth)) - innerWidth);
    assert.ok(over <= 0, `${t} overflows on phone by ${over}px`);
  }
  await page.screenshot({ path: (process.env.SHOT || 'dashboard.png').replace('.png', '-phone.png') });
  step('phone layout: no sideways scrolling on any tab');
  await page.setViewportSize({ width: 1280, height: 900 });
  await tab('dashboard');
  await page.screenshot({ path: process.env.SHOT || 'dashboard.png', fullPage: true });
  assert.deepEqual(errors, []);
  step('no browser errors');
  await browser.close();
  console.log('\nALL CHECKS PASSED');
})().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
