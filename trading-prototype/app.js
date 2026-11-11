/* AG Farmedge Global – Cotton & Onion Trading prototype.
   Plain JavaScript, no server. Data lives in this browser (localStorage).
   Quantities are in quintals (1 qtl = 100 kg). All money is kept in rupees. */
'use strict';

const KEY = 'agfg-trading-prototype-v1';
const MAIN_APP_KEY = 'agfarmedge_v2';   // the main AG Farmedge app; read-only, used for name suggestions
const STATUSES = ['Booked', 'In transit', 'Delivered'];
const COST_TYPES = ['Labour / loading', 'Packing / bags', 'Commission / brokerage', 'Mandi fee / market tax', 'GST', 'Export duty / port charges', 'Storage / warehouse', 'Other'];

// ───────── Sample data (SIMULATED – every name and number below is made up) ─────────
function sampleData() {
  return normalize({
    sample: true, fx: 88, seq: { lot: 4, trip: 4, sale: 4, cost: 5 },
    lots: [
      { id: 'C-001', date: '2026-10-20', commodity: 'Cotton', farmer: 'Ramesh Patil', village: 'Yavatmal', qty: 120, rate: 7400, loss: 0, paid: 600000 },
      { id: 'O-002', date: '2026-10-28', commodity: 'Onion', farmer: 'Sunita Jadhav', village: 'Lasalgaon', qty: 300, rate: 1900, loss: 5, paid: 570000 },
      { id: 'O-003', date: '2026-11-03', commodity: 'Onion', farmer: 'Ganesh Shinde', village: 'Niphad', qty: 250, rate: 2050, loss: 0, paid: 200000 },
      { id: 'C-004', date: '2026-11-06', commodity: 'Cotton', farmer: 'Vitthal Deshmukh', village: 'Wardha', qty: 80, rate: 7550, loss: 0, paid: 0 },
    ],
    trips: [
      { id: 'T-001', date: '2026-10-22', lotId: 'C-001', transporter: 'Raju Transport', vehicle: 'MH 29 AB 1234', from: 'Yavatmal', to: 'Coimbatore', qty: 120, freight: 42000, paid: 42000, status: 'Delivered' },
      { id: 'T-002', date: '2026-10-30', lotId: 'O-002', transporter: 'Sai Roadlines', vehicle: 'MH 15 CD 5678', from: 'Lasalgaon', to: 'Delhi', qty: 180, freight: 54000, paid: 30000, status: 'Delivered' },
      { id: 'T-003', date: '2026-11-09', lotId: 'O-002', transporter: 'Raju Transport', vehicle: 'MH 15 EF 9012', from: 'Lasalgaon', to: 'JNPT Port, Mumbai', qty: 100, freight: 18000, paid: 0, status: 'In transit' },
      { id: 'T-004', date: '2026-11-10', lotId: 'O-003', transporter: 'Sai Roadlines', vehicle: 'MH 15 GH 3456', from: 'Niphad', to: 'Kolkata', qty: 100, freight: 46000, paid: 0, status: 'Booked' },
    ],
    sales: [
      { id: 'S-001', date: '2026-10-25', lotId: 'C-001', buyer: 'Shree Textiles', place: 'Coimbatore', market: 'Domestic', qty: 120, rate: 8100, fx: 1, received: 700000 },
      { id: 'S-002', date: '2026-11-01', lotId: 'O-002', buyer: 'Azadpur Traders', place: 'Delhi', market: 'Domestic', qty: 180, rate: 2600, fx: 1, received: 468000 },
      { id: 'S-003', date: '2026-11-08', lotId: 'O-002', buyer: 'Al Noor Foods', place: 'Dubai, UAE', market: 'Export', qty: 100, rate: 340, fx: 88, received: 0 },
      { id: 'S-004', date: '2026-11-10', lotId: 'O-003', buyer: 'Bengal Agro Traders', place: 'Kolkata', market: 'Domestic', qty: 100, rate: 2700, fx: 1, received: 100000 },
    ],
    costs: [
      { id: 'X-001', date: '2026-10-25', lotId: 'C-001', type: 'Commission / brokerage', amount: 9720, note: '1% broker' },
      { id: 'X-002', date: '2026-10-28', lotId: 'O-002', type: 'Labour / loading', amount: 9000, note: '' },
      { id: 'X-003', date: '2026-10-29', lotId: 'O-002', type: 'Packing / bags', amount: 14000, note: 'Jute bags' },
      { id: 'X-004', date: '2026-11-08', lotId: 'O-002', type: 'Export duty / port charges', amount: 12000, note: 'JNPT handling' },
      { id: 'X-005', date: '2026-11-03', lotId: 'O-003', type: 'Mandi fee / market tax', amount: 5125, note: '1% market fee' },
    ],
  });
}
function emptyData() {
  return normalize({ sample: false, fx: 88, seq: {}, lots: [], trips: [], sales: [], costs: [] });
}

// ───────── Helpers ─────────
const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
const usd = n => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const qtl = n => (+n.toFixed(2)).toLocaleString('en-IN') + ' qtl';
const fmtDate = d => { const [y, m, day] = d.split('-'); return `${day}-${m}-${y}`; };
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const tag = (text, cls) => `<span class="tag ${esc(String(cls ?? text).replace(/ /g, '-'))}">${esc(text)}</span>`;
const money = n => `<span class="${n < 0 ? 'neg' : 'pos'}">${inr(n)}</span>`;
const balTag = bal => bal > 0 ? tag(inr(bal) + ' due', 'due') : tag('Paid', 'ok');
const uniq = arr => [...new Set(arr.map(x => String(x || '').trim()).filter(Boolean))].sort();
const byDateDesc = (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
const nextId = (kind, prefix) => `${prefix}-${String(++state.seq[kind]).padStart(3, '0')}`;
const PAID_FIELD = { lot: 'paid', trip: 'paid', sale: 'received' };
const LISTS = { lot: 'lots', trip: 'trips', sale: 'sales', cost: 'costs' };

// Brings older saved data / backups up to the current shape.
function normalize(s) {
  s.costs = Array.isArray(s.costs) ? s.costs : [];
  s.seq = Object.assign({ lot: 0, trip: 0, sale: 0, cost: 0 }, s.seq);
  s.company = Object.assign({ address: '', phone: '', gstin: '' }, s.company);
  s.fx = s.fx > 0 ? s.fx : 88;
  for (const kind of ['lot', 'trip', 'sale']) {
    const f = PAID_FIELD[kind];
    s[LISTS[kind]].forEach(r => {
      if (!Array.isArray(r.payments)) r.payments = r[f] > 0 ? [{ date: r.date, amount: r[f], note: 'Opening entry' }] : [];
      r[f] = sum(r.payments, p => p.amount);
    });
  }
  s.lots.forEach(l => { l.loss = l.loss > 0 ? l.loss : 0; });
  return s;
}
const validData = s => s && Array.isArray(s.lots) && Array.isArray(s.trips) && Array.isArray(s.sales);

// ───────── State ─────────
let state, tab = 'dashboard';

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (validData(s)) return normalize(s);
  } catch (e) { /* fall through to sample data */ }
  return sampleData();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save in this browser'); }
}

// Names already entered in the main AG Farmedge app (same website only). Read-only.
function mainAppNames() {
  try {
    const d = JSON.parse(localStorage.getItem(MAIN_APP_KEY)) || {};
    const list = x => Object.values(x || {});
    return { farmers: list(d.farmers), traders: list(d.traders) };
  } catch (e) { return { farmers: [], traders: [] }; }
}

// ───────── Calculations ─────────
const lotCost = l => Math.round(l.qty * l.rate);
// Domestic: rate is ₹ per quintal. Export: rate is USD per tonne (10 qtl), converted at the sale's USD rate.
const saleUsd = s => s.market === 'Export' ? (s.qty / 10) * s.rate : 0;
const saleValue = s => Math.round(s.market === 'Export' ? saleUsd(s) * s.fx : s.qty * s.rate);
const lotById = id => state.lots.find(l => l.id === id);
const totalOf = (kind, r) => kind === 'lot' ? lotCost(r) : kind === 'trip' ? r.freight : saleValue(r);

function lotStats(l) {
  const sales = state.sales.filter(s => s.lotId === l.id);
  const sold = sum(sales, s => s.qty);
  const salesValue = sum(sales, saleValue);
  const freight = sum(state.trips.filter(t => t.lotId === l.id), t => t.freight);
  const other = sum(state.costs.filter(c => c.lotId === l.id), c => c.amount);
  const stockCost = Math.round((sold + l.loss) * l.rate);   // cost of what was sold or lost
  return {
    sold, inHand: l.qty - sold - l.loss, salesValue, freight, other, stockCost,
    profit: salesValue - stockCost - freight - other,
    active: sold > 0 || freight > 0 || other > 0 || l.loss > 0,
  };
}

function table(heads, rows, emptyText, foot) {
  if (!rows.length) return `<div class="empty">${emptyText}</div>`;
  const th = heads.map(h => `<th class="${h.startsWith('#') ? 'n' : ''}">${h.replace(/^#/, '')}</th>`).join('');
  return `<div class="scroll"><table><thead><tr>${th}</tr></thead><tbody>${rows.join('')}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table></div>`;
}

// ───────── Views ─────────
function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  document.getElementById('simBanner').textContent = state.sample
    ? '⚠ SAMPLE DATA (simulated): the farmers, transporters, buyers and amounts shown are made up. Click "Start empty" at the bottom to enter your own.'
    : '';
  document.getElementById('fxInput').value = state.fx;
  const views = { dashboard: viewDashboard, purchases: viewPurchases, transport: viewTransport, sales: viewSales, costs: viewCosts, money: viewMoney };
  const view = document.getElementById('view');
  view.innerHTML = views[tab]();
  // Label every cell with its column name so phones can show rows as cards.
  view.querySelectorAll('table').forEach(t => {
    const heads = [...t.tHead.rows[0].cells].map(c => c.textContent);
    t.querySelectorAll('tbody tr').forEach(r => [...r.cells].forEach((c, i) => {
      c.dataset.label = heads[i] || '';
      c.innerHTML = `<span class="cv">${c.innerHTML}</span>`;
    }));
  });
}

function viewDashboard() {
  const stats = state.lots.map(l => ({ l, s: lotStats(l) }));
  const oweFarmers = sum(state.lots, l => lotCost(l) - l.paid);
  const oweTransport = sum(state.trips, t => t.freight - t.paid);
  const toCollect = sum(state.sales, s => saleValue(s) - s.received);
  const profit = sum(stats, x => x.s.profit);
  const stockOf = c => sum(stats.filter(x => x.l.commodity === c), x => x.s.inHand);
  const moving = state.trips.filter(t => t.status !== 'Delivered');

  const kpis = `
    <div class="kpis">
      <div class="kpi"><div class="l">Profit so far</div><div class="v ${profit < 0 ? 'neg' : 'pos'}" id="kpiProfit">${inr(profit)}</div><div class="s">sales − stock cost − freight − other costs</div></div>
      <div class="kpi"><div class="l">You owe farmers</div><div class="v" id="kpiFarmers">${inr(oweFarmers)}</div><div class="s">unpaid purchases</div></div>
      <div class="kpi"><div class="l">You owe transporters</div><div class="v" id="kpiTransport">${inr(oweTransport)}</div><div class="s">unpaid freight</div></div>
      <div class="kpi"><div class="l">Buyers owe you</div><div class="v" id="kpiBuyers">${inr(toCollect)}</div><div class="s">unpaid sales</div></div>
      <div class="kpi"><div class="l">Cotton unsold</div><div class="v" id="kpiCotton">${qtl(stockOf('Cotton'))}</div><div class="s">stock in hand</div></div>
      <div class="kpi"><div class="l">Onion unsold</div><div class="v" id="kpiOnion">${qtl(stockOf('Onion'))}</div><div class="s">stock in hand</div></div>
    </div>`;

  const dash = '<span class="sub">–</span>';
  const lotRows = stats.slice().sort((a, b) => byDateDesc(a.l, b.l)).map(({ l, s }) => `
    <tr data-lot="${esc(l.id)}">
      <td><b>${esc(l.id)}</b></td><td>${tag(l.commodity)}</td><td>${esc(l.farmer)}</td>
      <td class="n">${qtl(l.qty)}</td><td class="n">${qtl(s.sold)}</td><td class="n">${l.loss ? qtl(l.loss) : dash}</td><td class="n">${qtl(s.inHand)}</td>
      <td class="n">${inr(s.salesValue)}</td><td class="n">${inr(s.stockCost)}</td><td class="n">${inr(s.freight)}</td><td class="n">${inr(s.other)}</td>
      <td class="n profit">${s.active ? money(s.profit) : dash}</td>
      <td class="n">${s.salesValue ? (s.profit / s.salesValue * 100).toFixed(1) + '%' : dash}</td>
    </tr>`);
  const lotFoot = `<tr><td colspan="7">Total</td><td class="n">${inr(sum(stats, x => x.s.salesValue))}</td><td class="n">${inr(sum(stats, x => x.s.stockCost))}</td><td class="n">${inr(sum(stats, x => x.s.freight))}</td><td class="n">${inr(sum(stats, x => x.s.other))}</td><td class="n">${money(profit)}</td><td></td></tr>`;

  const stockRows = ['Cotton', 'Onion'].map(c => {
    const xs = stats.filter(x => x.l.commodity === c);
    const onRoad = sum(state.trips.filter(t => t.status === 'In transit' && lotById(t.lotId)?.commodity === c), t => t.qty);
    return `<tr><td>${tag(c)}</td><td class="n">${qtl(sum(xs, x => x.l.qty))}</td><td class="n">${qtl(sum(xs, x => x.s.sold))}</td><td class="n">${qtl(sum(xs, x => x.l.loss))}</td><td class="n"><b>${qtl(sum(xs, x => x.s.inHand))}</b></td><td class="n">${qtl(onRoad)}</td></tr>`;
  });
  const moveRows = moving.sort(byDateDesc).map(t => `
    <tr><td><b>${esc(t.lotId)}</b></td><td>${esc(t.from)} → ${esc(t.to)}</td><td class="n">${qtl(t.qty)}</td><td>${esc(t.transporter)}</td><td>${tag(t.status)}</td></tr>`);

  const dueList = (items, nameOf, balOf) => {
    const map = {};
    items.forEach(x => { const b = balOf(x); if (b > 0) map[nameOf(x)] = (map[nameOf(x)] || 0) + b; });
    const rows = Object.entries(map).sort((a, b) => b[1] - a[1]).map(([n, b]) => `<tr><td>${esc(n)}</td><td class="n">${inr(b)}</td></tr>`);
    return table(['Name', '#Balance'], rows, 'Nothing due. 👍');
  };

  return `
    <div class="head"><div><h2>Dashboard</h2><div class="hint">Profit, payments and stock at a glance. A <b>lot</b> is one purchase from one farmer.</div></div></div>
    ${kpis}
    <div class="card"><h3>Profit per lot</h3>
      ${table(['Lot', 'Crop', 'Farmer', '#Bought', '#Sold', '#Weight loss', '#In hand', '#Sales', '#Cost of sold + lost', '#Freight', '#Other costs', '#Profit', '#Margin'], lotRows, 'No lots yet. Start in "1 · Purchases".', lotFoot)}
    </div>
    <div class="cols">
      <div class="card"><h3>Stock</h3>${table(['Crop', '#Bought', '#Sold', '#Weight loss', '#In hand', '#On the road'], stockRows, '')}</div>
      <div class="card"><h3>Trucks not yet delivered</h3>${table(['Lot', 'Route', '#Qty', 'Transporter', 'Status'], moveRows, 'No trucks booked or on the road.')}</div>
    </div>
    <div class="cols">
      <div class="card"><h3>Pay to farmers</h3>${dueList(state.lots, l => l.farmer, l => lotCost(l) - l.paid)}</div>
      <div class="card"><h3>Pay to transporters</h3>${dueList(state.trips, t => t.transporter, t => t.freight - t.paid)}</div>
      <div class="card"><h3>Collect from buyers</h3>${dueList(state.sales, s => s.buyer, s => saleValue(s) - s.received)}</div>
    </div>`;
}

const DOC_LABEL = { lot: 'Slip', trip: 'Slip', sale: 'Bill' };
const rowActs = (kind, id, bal) => `<td><div class="acts">
  <button class="btn ${bal > 0 ? '' : 'ghost'} small" data-act="pay" data-kind="${kind}" data-id="${esc(id)}">${bal > 0 ? (kind === 'sale' ? 'Receive' : 'Pay') : 'Payments'}</button>
  <button class="btn ghost small" data-act="doc" data-kind="${kind}" data-id="${esc(id)}">${DOC_LABEL[kind]}</button>
  <button class="btn ghost small" data-act="edit-${kind}" data-id="${esc(id)}">Edit</button>
  <button class="btn danger small" data-act="del-${kind}" data-id="${esc(id)}">Delete</button></div></td>`;

function viewPurchases() {
  const rows = state.lots.slice().sort(byDateDesc).map(l => {
    const s = lotStats(l), bal = lotCost(l) - l.paid;
    return `<tr data-lot="${esc(l.id)}"><td><b>${esc(l.id)}</b></td><td>${fmtDate(l.date)}</td><td>${tag(l.commodity)}</td>
      <td>${esc(l.farmer)}<div class="sub">${esc(l.village)}</div></td>
      <td class="n">${qtl(l.qty)}</td><td class="n">${inr(l.rate)}</td><td class="n">${inr(lotCost(l))}</td>
      <td class="n">${inr(l.paid)}</td><td>${balTag(bal)}</td><td class="n">${l.loss ? qtl(l.loss) : '–'}</td><td class="n unsold">${qtl(s.inHand)}</td>${rowActs('lot', l.id, bal)}</tr>`;
  });
  return `
    <div class="head"><div><h2>Purchases from farmers</h2><div class="hint">Each purchase becomes a lot. Transport, sales and costs are linked to the lot. Use Edit to record weight loss (drying, grading, rot).</div></div>
      <button class="btn" data-act="new-lot">+ New purchase</button></div>
    <div class="card">${table(['Lot', 'Date', 'Crop', 'Farmer', '#Qty', '#Rate / qtl', '#Total', '#Paid', 'Payment', '#Weight loss', '#Unsold', ''], rows, 'No purchases yet. Click "+ New purchase".')}</div>`;
}

function viewTransport() {
  const rows = state.trips.slice().sort(byDateDesc).map(t => {
    const bal = t.freight - t.paid, next = STATUSES[STATUSES.indexOf(t.status) + 1];
    return `<tr data-trip="${esc(t.id)}"><td><b>${esc(t.id)}</b></td><td>${fmtDate(t.date)}</td><td><b>${esc(t.lotId)}</b> ${tag(lotById(t.lotId)?.commodity || '?')}</td>
      <td>${esc(t.transporter)}<div class="sub">${esc(t.vehicle)}</div></td><td>${esc(t.from)} → ${esc(t.to)}</td>
      <td class="n">${qtl(t.qty)}</td><td class="n">${inr(t.freight)}</td><td>${balTag(bal)}</td>
      <td>${tag(t.status)} ${next ? `<button class="btn ghost small" data-act="trip-next" data-id="${esc(t.id)}">Mark ${next.toLowerCase()}</button>` : ''}</td>
      ${rowActs('trip', t.id, bal)}</tr>`;
  });
  return `
    <div class="head"><div><h2>Hired transport</h2><div class="hint">Book a hired truck for a lot. Freight is counted in that lot's profit. Truck status is updated by hand (no GPS).</div></div>
      <button class="btn" data-act="new-trip">+ Book truck</button></div>
    <div class="card">${table(['Trip', 'Date', 'Lot', 'Transporter', 'Route', '#Qty', '#Freight', 'Payment', 'Status', ''], rows, 'No trucks booked yet. Click "+ Book truck".')}</div>`;
}

function viewSales() {
  const rows = state.sales.slice().sort(byDateDesc).map(s => {
    const val = saleValue(s), bal = val - s.received, ex = s.market === 'Export';
    return `<tr data-sale="${esc(s.id)}"><td><b>${esc(s.id)}</b></td><td>${fmtDate(s.date)}</td><td><b>${esc(s.lotId)}</b> ${tag(lotById(s.lotId)?.commodity || '?')}</td>
      <td>${esc(s.buyer)}<div class="sub">${esc(s.place)}</div></td><td>${tag(s.market)}</td>
      <td class="n">${qtl(s.qty)}</td>
      <td class="n">${ex ? usd(s.rate) + ' / tonne' : inr(s.rate) + ' / qtl'}</td>
      <td class="n value">${inr(val)}${ex ? `<div class="sub">${usd(saleUsd(s))} @ ₹${s.fx}</div>` : ''}</td>
      <td class="n">${inr(s.received)}</td><td>${balTag(bal)}</td>${rowActs('sale', s.id, bal)}</tr>`;
  });
  return `
    <div class="head"><div><h2>Sales to traders</h2><div class="hint">Sell from a lot to a trader in India (₹ per quintal) or abroad (USD per tonne, converted at the simulated USD rate).</div></div>
      <button class="btn" data-act="new-sale">+ New sale</button></div>
    <div class="card">${table(['Sale', 'Date', 'Lot', 'Buyer', 'Market', '#Qty', '#Rate', '#Value', '#Received', 'Payment', ''], rows, 'No sales yet. Click "+ New sale".')}</div>`;
}

function viewCosts() {
  const rows = state.costs.slice().sort(byDateDesc).map(c => `
    <tr data-cost="${esc(c.id)}"><td><b>${esc(c.id)}</b></td><td>${fmtDate(c.date)}</td><td><b>${esc(c.lotId)}</b> ${tag(lotById(c.lotId)?.commodity || '?')}</td>
      <td>${esc(c.type)}</td><td>${esc(c.note)}</td><td class="n">${inr(c.amount)}</td>
      <td><div class="acts"><button class="btn ghost small" data-act="edit-cost" data-id="${esc(c.id)}">Edit</button>
      <button class="btn danger small" data-act="del-cost" data-id="${esc(c.id)}">Delete</button></div></td></tr>`);
  const foot = `<tr><td colspan="5">Total</td><td class="n">${inr(sum(state.costs, c => c.amount))}</td><td></td></tr>`;
  return `
    <div class="head"><div><h2>Other costs</h2><div class="hint">Labour, packing, commission, mandi fee, GST, export duty and so on. Each cost is charged to one lot and reduces that lot's profit. Enter the amount you actually paid – nothing is calculated automatically.</div></div>
      <button class="btn" data-act="new-cost">+ Add cost</button></div>
    <div class="card">${table(['No.', 'Date', 'Lot', 'Type', 'Note', '#Amount', ''], rows, 'No other costs yet. Click "+ Add cost".', foot)}</div>`;
}

function viewMoney() {
  const btn = (kind, id, label) => `<td><button class="btn small" data-act="pay" data-kind="${kind}" data-id="${esc(id)}">${label}</button></td>`;
  const lots = state.lots.filter(l => lotCost(l) > l.paid).sort(byDateDesc).map(l =>
    `<tr><td>${esc(l.farmer)}</td><td><b>${esc(l.id)}</b></td><td>${fmtDate(l.date)}</td><td class="n">${inr(lotCost(l))}</td><td class="n">${inr(l.paid)}</td><td class="n"><b>${inr(lotCost(l) - l.paid)}</b></td>${btn('lot', l.id, 'Pay')}</tr>`);
  const trips = state.trips.filter(t => t.freight > t.paid).sort(byDateDesc).map(t =>
    `<tr><td>${esc(t.transporter)}</td><td><b>${esc(t.id)}</b> (${esc(t.lotId)})</td><td>${fmtDate(t.date)}</td><td class="n">${inr(t.freight)}</td><td class="n">${inr(t.paid)}</td><td class="n"><b>${inr(t.freight - t.paid)}</b></td>${btn('trip', t.id, 'Pay')}</tr>`);
  const sales = state.sales.filter(s => saleValue(s) > s.received).sort(byDateDesc).map(s =>
    `<tr><td>${esc(s.buyer)}</td><td><b>${esc(s.id)}</b> (${esc(s.lotId)})</td><td>${fmtDate(s.date)}</td><td class="n">${inr(saleValue(s))}</td><td class="n">${inr(s.received)}</td><td class="n"><b>${inr(saleValue(s) - s.received)}</b></td>${btn('sale', s.id, 'Receive')}</tr>`);
  const heads = who => [who, 'For', 'Date', '#Total', '#Paid', '#Balance', ''];
  return `
    <div class="head"><div><h2>Payments due</h2><div class="hint">Record money here after you pay or receive it. Each entry is kept with its date. Nothing is sent to a bank – this is a manual record only.</div></div></div>
    <div class="card" id="dueFarmers"><h3>You owe farmers</h3>${table(heads('Farmer'), lots, 'All farmers are paid. 👍')}</div>
    <div class="card" id="dueTransport"><h3>You owe transporters</h3>${table(heads('Transporter'), trips, 'All transporters are paid. 👍')}</div>
    <div class="card" id="dueBuyers"><h3>Buyers owe you</h3>${table(heads('Buyer'), sales, 'All sales are fully received. 👍')}</div>`;
}

// ───────── Generic dialog form ─────────
const dlg = document.getElementById('dlg');
const dlgForm = document.getElementById('dlgForm');
let formCfg = null;

function openForm(cfg) {
  formCfg = cfg;
  const field = f => {
    const id = 'f_' + f.name;
    let input;
    if (f.type === 'select') {
      input = `<select id="${id}" name="${f.name}">${f.options.map(o => {
        const [v, t] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(v)}" ${String(v) === String(f.value) ? 'selected' : ''}>${esc(t)}</option>`;
      }).join('')}</select>`;
    } else {
      const list = f.list ? `list="${id}_list"` : '';
      input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" ${f.type === 'number' ? 'min="0" step="any" inputmode="decimal"' : ''} ${list} autocomplete="off">`
        + (f.list ? `<datalist id="${id}_list">${f.list.map(v => `<option value="${esc(v)}">`).join('')}</datalist>` : '');
    }
    return `<div class="f ${f.wide ? 'wide' : ''}" data-field="${f.name}"><label for="${id}">${esc(f.label)}</label>${input}</div>`;
  };
  dlgForm.innerHTML = `<h3>${esc(cfg.title)}</h3><div class="grid">${cfg.fields.map(field).join('')}
    <div class="calc" id="dlgCalc"></div><div class="err" id="dlgErr"></div></div>
    <div class="dlg-btns"><button type="button" class="btn ghost" data-act="dlg-cancel">${cfg.fields.length ? 'Cancel' : 'Close'}</button>${cfg.fields.length ? `<button type="submit" class="btn" id="dlgOk">${esc(cfg.ok || 'Save')}</button>` : ''}</div>`;
  refreshForm();
  if (!dlg.open) dlg.showModal();
}
function formValues() {
  const v = {};
  formCfg.fields.forEach(f => {
    const raw = dlgForm.elements[f.name].value.trim();
    v[f.name] = f.type === 'number' ? (raw === '' ? NaN : Number(raw)) : raw;
  });
  return v;
}
function refreshForm() {
  const v = formValues();
  formCfg.fields.forEach(f => {
    const box = dlgForm.querySelector(`[data-field="${f.name}"]`);
    if (f.hide) box.hidden = f.hide(v);
    if (f.dynLabel) box.querySelector('label').textContent = f.dynLabel(v);
  });
  const calc = document.getElementById('dlgCalc');
  const text = formCfg.calc ? formCfg.calc(v) : '';
  calc.hidden = !text; calc.innerHTML = text;
}
dlgForm.addEventListener('input', () => { document.getElementById('dlgErr').textContent = ''; refreshForm(); });
dlgForm.addEventListener('submit', e => {
  e.preventDefault();
  const err = formCfg.submit(formValues());
  if (err) { document.getElementById('dlgErr').textContent = err; return; }
  dlg.close(); save(); render();
});

const need = (v, names) => { for (const [k, label] of names) if (v[k] === '' || (typeof v[k] === 'number' && isNaN(v[k]))) return `Please fill in: ${label}`; };
const positive = (v, names) => { for (const [k, label] of names) if (!(v[k] > 0)) return `${label} must be more than 0`; };
const firstPayment = (date, amount, note) => amount > 0 ? [{ date, amount, note }] : [];

// ───────── Purchase (lot) form ─────────
function lotForm(id) {
  const l = id ? lotById(id) : null;
  const main = mainAppNames();
  openForm({
    title: l ? `Edit purchase ${l.id}` : 'New purchase from farmer',
    fields: [
      { name: 'date', label: 'Date', type: 'date', value: l?.date || today() },
      l ? { name: 'commodity', label: 'Crop', type: 'select', options: [l.commodity], value: l.commodity }
        : { name: 'commodity', label: 'Crop', type: 'select', options: ['Cotton', 'Onion'], value: 'Cotton' },
      { name: 'farmer', label: 'Farmer name', value: l?.farmer, list: uniq([...state.lots.map(x => x.farmer), ...main.farmers.map(f => f.name)]) },
      { name: 'village', label: 'Village / mandi', value: l?.village, list: uniq([...state.lots.map(x => x.village), ...main.farmers.map(f => f.village)]) },
      { name: 'qty', label: 'Quantity (quintals)', type: 'number', value: l?.qty },
      { name: 'rate', label: 'Rate (₹ per quintal)', type: 'number', value: l?.rate },
      { name: 'loss', label: 'Weight loss so far (quintals) – drying, grading, rot', type: 'number', value: l?.loss ?? 0, wide: true },
      ...(l ? [] : [{ name: 'paid', label: 'Paid to farmer now (₹)', type: 'number', value: 0, wide: true }]),
    ],
    calc: v => {
      if (!(v.qty > 0 && v.rate > 0)) return '';
      let out = `Total to pay farmer: <b>${inr(v.qty * v.rate)}</b>`;
      if (v.loss > 0) out += ` · weight loss costs you ${inr(v.loss * v.rate)}`;
      if (l) out += `<br><span class="sub">Already paid ${inr(l.paid)}. Use the Pay button to add or remove payments.</span>`;
      return out;
    },
    submit: v => {
      const e = need(v, [['date', 'Date'], ['farmer', 'Farmer name'], ['qty', 'Quantity'], ['rate', 'Rate']])
        || positive(v, [['qty', 'Quantity'], ['rate', 'Rate']]);
      if (e) return e;
      const total = Math.round(v.qty * v.rate), loss = v.loss || 0, sold = l ? lotStats(l).sold : 0;
      const paid = l ? l.paid : (v.paid || 0);
      if (loss < 0 || paid < 0) return 'Amounts cannot be negative';
      if (sold + loss > v.qty) return `Sold (${qtl(sold)}) plus weight loss (${qtl(loss)}) cannot be more than the quantity bought.`;
      if (paid > total) return l ? `${inr(paid)} is already paid to this farmer. The total cannot be less than that.`
        : `Paid amount cannot be more than the total (${inr(total)})`;
      const rec = { date: v.date, farmer: v.farmer, village: v.village, qty: v.qty, rate: v.rate, loss };
      if (l) Object.assign(l, rec);
      else state.lots.push({ id: nextId('lot', v.commodity[0]), commodity: v.commodity, ...rec, paid, payments: firstPayment(v.date, paid, 'Paid at purchase') });
      toast(l ? 'Purchase updated' : 'Purchase saved');
    },
  });
}

const lotOptions = () => state.lots.slice().sort(byDateDesc).map(l =>
  [l.id, `${l.id} · ${l.commodity} · ${l.farmer} · ${qtl(lotStats(l).inHand)} unsold of ${qtl(l.qty)}`]);

// ───────── Transport (trip) form ─────────
function tripForm(id) {
  if (!state.lots.length) return toast('Add a purchase first – a truck is booked for a lot');
  const t = id ? state.trips.find(x => x.id === id) : null;
  const first = t ? lotById(t.lotId) : state.lots.slice().sort(byDateDesc)[0];
  openForm({
    title: t ? `Edit trip ${t.id}` : 'Book a hired truck',
    fields: [
      { name: 'lotId', label: 'Lot being moved', type: 'select', options: lotOptions(), value: first.id, wide: true },
      { name: 'date', label: 'Date', type: 'date', value: t?.date || today() },
      { name: 'status', label: 'Status', type: 'select', options: STATUSES, value: t?.status || 'Booked' },
      { name: 'transporter', label: 'Transporter', value: t?.transporter, list: uniq(state.trips.map(x => x.transporter)) },
      { name: 'vehicle', label: 'Vehicle number (optional)', value: t?.vehicle },
      { name: 'from', label: 'From', value: t?.from ?? first.village },
      { name: 'to', label: 'To', value: t?.to, list: uniq([...state.trips.map(x => x.to), ...state.sales.map(x => x.place)]) },
      { name: 'qty', label: 'Quantity loaded (quintals)', type: 'number', value: t?.qty },
      { name: 'freight', label: 'Freight charge (₹)', type: 'number', value: t?.freight },
      ...(t ? [] : [{ name: 'paid', label: 'Paid to transporter now (₹)', type: 'number', value: 0, wide: true }]),
    ],
    calc: v => v.qty > 0 && v.freight > 0 ? `Freight works out to <b>${inr(v.freight / v.qty)}</b> per quintal` : '',
    submit: v => {
      const e = need(v, [['date', 'Date'], ['transporter', 'Transporter'], ['from', 'From'], ['to', 'To'], ['qty', 'Quantity'], ['freight', 'Freight charge']])
        || positive(v, [['qty', 'Quantity'], ['freight', 'Freight charge']]);
      if (e) return e;
      const lot = lotById(v.lotId), paid = t ? t.paid : (v.paid || 0), freight = Math.round(v.freight);
      if (v.qty > lot.qty) return `Lot ${lot.id} has only ${qtl(lot.qty)}. You cannot load more than that.`;
      if (paid < 0) return 'Paid amount cannot be negative';
      if (paid > freight) return t ? `${inr(paid)} is already paid to this transporter. Freight cannot be less than that.`
        : `Paid amount cannot be more than the freight (${inr(freight)})`;
      const rec = { date: v.date, lotId: v.lotId, transporter: v.transporter, vehicle: v.vehicle, from: v.from, to: v.to, qty: v.qty, freight, status: v.status };
      if (t) Object.assign(t, rec);
      else state.trips.push({ id: nextId('trip', 'T'), ...rec, paid, payments: firstPayment(v.date, paid, 'Advance') });
      toast(t ? 'Trip updated' : 'Truck booked');
    },
  });
}

// ───────── Sale form ─────────
function saleForm(id) {
  if (!state.lots.length) return toast('Add a purchase first – you sell from a lot');
  const s = id ? state.sales.find(x => x.id === id) : null;
  const withStock = state.lots.slice().sort(byDateDesc).find(l => lotStats(l).inHand > 0);
  if (!s && !withStock) return toast('All lots are fully sold. Add a new purchase first.');
  const main = mainAppNames();
  const available = lotId => lotStats(lotById(lotId)).inHand + (s && s.lotId === lotId ? s.qty : 0);
  const value = v => v.market === 'Export' ? (v.qty / 10) * v.rate * v.fx : v.qty * v.rate;
  openForm({
    title: s ? `Edit sale ${s.id}` : 'New sale to trader',
    fields: [
      { name: 'lotId', label: 'Sell from lot', type: 'select', options: lotOptions(), value: s?.lotId || withStock.id, wide: true },
      { name: 'date', label: 'Date', type: 'date', value: s?.date || today() },
      { name: 'market', label: 'Market', type: 'select', options: [['Domestic', 'India (₹)'], ['Export', 'Export (USD)']], value: s?.market || 'Domestic' },
      { name: 'buyer', label: 'Buyer / trader', value: s?.buyer, list: uniq([...state.sales.map(x => x.buyer), ...main.traders.map(t => t.name)]) },
      { name: 'place', label: 'City / country', value: s?.place, list: uniq([...state.sales.map(x => x.place), ...main.traders.map(t => t.city)]) },
      { name: 'qty', label: 'Quantity (quintals)', type: 'number', value: s?.qty },
      { name: 'rate', label: 'Rate', type: 'number', value: s?.rate, dynLabel: v => v.market === 'Export' ? 'Rate (USD per tonne)' : 'Rate (₹ per quintal)' },
      { name: 'fx', label: '₹ per 1 USD (simulated, type the real rate)', type: 'number', value: s?.market === 'Export' ? s.fx : state.fx, hide: v => v.market !== 'Export', wide: true },
      ...(s ? [] : [{ name: 'received', label: 'Received from buyer now (₹)', type: 'number', value: 0, wide: true }]),
    ],
    calc: v => {
      const lot = lotById(v.lotId);
      let out = `Unsold in ${esc(lot.id)}: <b>${qtl(available(v.lotId))}</b> · bought at ${inr(lot.rate)} / qtl`;
      if (v.qty > 0 && v.rate > 0 && (v.market !== 'Export' || v.fx > 0)) {
        out += `<br>Sale value: <b>${inr(value(v))}</b>`;
        if (v.market === 'Export') out += ` (${usd(v.qty / 10 * v.rate)} for ${+(v.qty / 10).toFixed(2)} tonnes)`;
        out += ` · before freight and costs: ${money(value(v) - v.qty * lot.rate)}`;
      }
      return out;
    },
    submit: v => {
      const ex = v.market === 'Export';
      const e = need(v, [['date', 'Date'], ['buyer', 'Buyer'], ['qty', 'Quantity'], ['rate', 'Rate']])
        || positive(v, [['qty', 'Quantity'], ['rate', 'Rate']]) || (ex && positive(v, [['fx', 'USD rate']]));
      if (e) return e;
      const avail = available(v.lotId);
      if (v.qty > avail) return `Only ${qtl(avail)} is unsold in lot ${v.lotId}. You cannot sell more than that.`;
      const rec = { date: v.date, lotId: v.lotId, buyer: v.buyer, place: v.place, market: v.market, qty: v.qty, rate: v.rate, fx: ex ? v.fx : 1 };
      const total = saleValue(rec), received = s ? s.received : (v.received || 0);
      if (received < 0) return 'Received amount cannot be negative';
      if (received > total) return s ? `${inr(received)} is already received for this sale. The value cannot be less than that.`
        : `Received amount cannot be more than the sale value (${inr(total)})`;
      if (s) Object.assign(s, rec);
      else state.sales.push({ id: nextId('sale', 'S'), ...rec, received, payments: firstPayment(v.date, received, 'Advance') });
      toast(s ? 'Sale updated' : 'Sale saved');
    },
  });
}

// ───────── Other cost form ─────────
function costForm(id) {
  if (!state.lots.length) return toast('Add a purchase first – a cost is charged to a lot');
  const c = id ? state.costs.find(x => x.id === id) : null;
  openForm({
    title: c ? `Edit cost ${c.id}` : 'Add a cost to a lot',
    fields: [
      { name: 'lotId', label: 'Lot', type: 'select', options: lotOptions(), value: c?.lotId || state.lots.slice().sort(byDateDesc)[0].id, wide: true },
      { name: 'date', label: 'Date', type: 'date', value: c?.date || today() },
      { name: 'type', label: 'Type of cost', type: 'select', options: COST_TYPES, value: c?.type || COST_TYPES[0] },
      { name: 'amount', label: 'Amount paid (₹)', type: 'number', value: c?.amount },
      { name: 'note', label: 'Note (optional)', value: c?.note },
    ],
    submit: v => {
      const e = need(v, [['date', 'Date'], ['amount', 'Amount']]) || positive(v, [['amount', 'Amount']]);
      if (e) return e;
      const rec = { date: v.date, lotId: v.lotId, type: v.type, amount: Math.round(v.amount), note: v.note };
      if (c) Object.assign(c, rec); else state.costs.push({ id: nextId('cost', 'X'), ...rec });
      toast(c ? 'Cost updated' : 'Cost saved');
    },
  });
}

// ───────── Payments (with dated history) ─────────
const findRec = (kind, id) => state[LISTS[kind]].find(x => x.id === id);
const partyOf = (kind, r) => kind === 'lot' ? r.farmer : kind === 'trip' ? r.transporter : r.buyer;

function payForm(kind, id) {
  const rec = findRec(kind, id), field = PAID_FIELD[kind], total = totalOf(kind, rec);
  const bal = total - rec[field], word = kind === 'sale' ? 'received' : 'paid';
  const history = () => rec.payments.length
    ? `<div class="hist"><b>Payment history</b>${rec.payments.map((p, i) => `<div><span>${fmtDate(p.date)} · <b>${inr(p.amount)}</b>${p.note ? ' · ' + esc(p.note) : ''}</span>
        <button type="button" class="btn danger small" data-act="del-payment" data-kind="${kind}" data-id="${esc(id)}" data-idx="${i}">Remove</button></div>`).join('')}</div>`
    : '<div class="hist sub">No payments recorded yet.</div>';
  openForm({
    title: kind === 'sale' ? `Payments from ${partyOf(kind, rec)}` : `Payments to ${partyOf(kind, rec)}`,
    ok: kind === 'sale' ? 'Record receipt' : 'Record payment',
    fields: bal > 0 ? [
      { name: 'amount', label: 'Amount (₹)', type: 'number', value: bal },
      { name: 'date', label: 'Date', type: 'date', value: today() },
      { name: 'note', label: 'Note (optional) – cash, UPI, cheque no.', wide: true },
    ] : [],
    calc: () => `${esc(id)} · total ${inr(total)} · ${word} ${inr(rec[field])} · <b>balance ${inr(bal)}</b><br><span class="sub">Manual record only – no money is moved.</span>${history()}`,
    submit: v => {
      if (!(v.amount > 0)) return 'Amount must be more than 0';
      if (v.amount > bal) return `Amount cannot be more than the balance (${inr(bal)})`;
      if (!v.date) return 'Please fill in: Date';
      rec.payments.push({ date: v.date, amount: v.amount, note: v.note });
      rec[field] = sum(rec.payments, p => p.amount);
      toast(kind === 'sale' ? 'Receipt recorded' : 'Payment recorded');
    },
  });
}
function delPayment(kind, id, idx) {
  const rec = findRec(kind, id), p = rec.payments[idx];
  if (!p || !confirm(`Remove the payment of ${inr(p.amount)} dated ${fmtDate(p.date)}?`)) return;
  rec.payments.splice(idx, 1);
  rec[PAID_FIELD[kind]] = sum(rec.payments, x => x.amount);
  save(); render(); payForm(kind, id); toast('Payment removed');
}

// ───────── Printable documents ─────────
function showDoc(kind, id) {
  const r = findRec(kind, id), lot = kind === 'lot' ? r : lotById(r.lotId), co = state.company;
  const total = totalOf(kind, r), paid = r[PAID_FIELD[kind]], ex = r.market === 'Export';
  const title = { lot: 'Purchase slip', trip: 'Transport slip', sale: ex ? 'Export sale bill' : 'Sale bill' }[kind];
  const partyLabel = { lot: 'Farmer', trip: 'Transporter', sale: 'Buyer' }[kind];
  const partyPlace = { lot: r.village, trip: r.vehicle, sale: r.place }[kind];
  const lines = {
    lot: [['Crop', lot.commodity], ['Quantity', qtl(r.qty)], ['Rate', inr(r.rate) + ' per quintal']],
    trip: [['Lot / crop', `${lot.id} · ${lot.commodity}`], ['Route', `${r.from} → ${r.to}`], ['Quantity loaded', qtl(r.qty)], ['Status', r.status]],
    sale: [['Crop', lot.commodity], ['Quantity', `${qtl(r.qty)} (${+(r.qty / 10).toFixed(2)} tonnes)`],
      ['Rate', ex ? usd(r.rate) + ' per tonne' : inr(r.rate) + ' per quintal'],
      ...(ex ? [['Value in USD', usd(saleUsd(r))], ['USD rate used (simulated unless you typed the real one)', '₹' + r.fx]] : [])],
  }[kind];
  const word = kind === 'sale' ? 'Received' : 'Paid';
  const doc = document.getElementById('doc');
  doc.innerHTML = `
    <div class="doc-bar"><button class="btn" data-act="doc-print">Print / save as PDF</button><button class="btn ghost" data-act="doc-close">Close</button></div>
    <div class="doc-page">
      <div class="doc-top">
        <div><h1>AG Farmedge Global</h1>
          <div>${co.address ? esc(co.address) : '<span class="sub">(Add your address under "Company details")</span>'}</div>
          <div>${[co.phone && 'Phone: ' + esc(co.phone), co.gstin && 'GSTIN: ' + esc(co.gstin)].filter(Boolean).join(' · ')}</div></div>
        <div style="text-align:right"><b id="docNo">No. ${esc(r.id)}</b><br>Date: ${fmtDate(r.date)}${kind !== 'lot' ? `<br>Lot: ${esc(lot.id)}` : ''}</div>
      </div>
      <h2 id="docTitle">${title}</h2>
      <div>${partyLabel}: <b>${esc(partyOf(kind, r))}</b>${partyPlace ? ' · ' + esc(partyPlace) : ''}</div>
      <table><tbody>${lines.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${esc(v)}</td></tr>`).join('')}
        <tr><td><b>${kind === 'trip' ? 'Freight' : 'Total'}</b></td><td class="n"><b id="docTotal">${inr(total)}</b></td></tr></tbody></table>
      ${r.payments.length ? `<table><thead><tr><th>Payment date</th><th>Note</th><th class="n">${word}</th></tr></thead><tbody>
        ${r.payments.map(p => `<tr><td>${fmtDate(p.date)}</td><td>${esc(p.note)}</td><td class="n">${inr(p.amount)}</td></tr>`).join('')}</tbody></table>` : ''}
      <table><tbody><tr><td>${word} so far</td><td class="n">${inr(paid)}</td></tr>
        <tr><td><b>Balance</b></td><td class="n"><b>${inr(total - paid)}</b></td></tr></tbody></table>
      <div class="doc-sign"><span>${partyLabel}'s signature</span><span>For AG Farmedge Global</span></div>
      <div class="doc-note">${state.sample ? '<b>SAMPLE DATA – not a real transaction.</b> ' : ''}Simple record made by the prototype. This is <b>not a GST tax invoice</b> and not an export document. Taxes are not calculated.</div>
    </div>`;
  doc.hidden = false; doc.scrollTop = 0;
}

function companyForm() {
  const co = state.company;
  openForm({
    title: 'Company details (shown on bills and slips)',
    fields: [
      { name: 'address', label: 'Address', value: co.address, wide: true },
      { name: 'phone', label: 'Phone', value: co.phone },
      { name: 'gstin', label: 'GSTIN', value: co.gstin },
    ],
    submit: v => { state.company = v; toast('Company details saved'); },
  });
}

// ───────── Backup and restore ─────────
function downloadBackup() {
  const blob = new Blob([JSON.stringify({ app: KEY, exported: today(), ...state }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `agfarmedge-trading-backup-${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup file downloaded – keep it somewhere safe');
}
document.getElementById('restoreFile').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  let s;
  try { s = JSON.parse(await file.text()); } catch (err) { s = null; }
  if (!validData(s) || s.app !== KEY) return toast('This is not a backup file from this app');
  if (!confirm(`Restore the backup from ${s.exported || 'unknown date'} (${s.lots.length} purchases, ${s.sales.length} sales)? It replaces everything now in the app.`)) return;
  delete s.app; delete s.exported;
  state = normalize(s); save(); render(); toast('Backup restored');
});

// ───────── Actions ─────────
function del(kind, id) {
  if (kind === 'lot' && ['trips', 'sales', 'costs'].some(k => state[k].some(x => x.lotId === id)))
    return toast(`Lot ${id} has trucks, sales or costs linked. Delete those first.`);
  if (!confirm(`Delete ${id}? This cannot be undone.`)) return;
  state[LISTS[kind]] = state[LISTS[kind]].filter(x => x.id !== id);
  save(); render(); toast('Deleted');
}

const FORMS = { lot: lotForm, trip: tripForm, sale: saleForm, cost: costForm };
document.addEventListener('click', e => {
  const tabBtn = e.target.closest('#tabs button');
  if (tabBtn) { tab = tabBtn.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const { act, id, kind, idx } = b.dataset;
  if (act === 'dlg-cancel') dlg.close();
  else if (act.startsWith('new-')) FORMS[act.slice(4)]();
  else if (act.startsWith('edit-')) FORMS[act.slice(5)](id);
  else if (act === 'del-payment') delPayment(kind, id, Number(idx));
  else if (act.startsWith('del-')) del(act.slice(4), id);
  else if (act === 'pay') payForm(kind, id);
  else if (act === 'doc') showDoc(kind, id);
  else if (act === 'doc-print') window.print();
  else if (act === 'doc-close') document.getElementById('doc').hidden = true;
  else if (act === 'company') companyForm();
  else if (act === 'backup') downloadBackup();
  else if (act === 'restore') document.getElementById('restoreFile').click();
  else if (act === 'trip-next') {
    const t = state.trips.find(x => x.id === id);
    t.status = STATUSES[STATUSES.indexOf(t.status) + 1] || t.status;
    save(); render(); toast(`${t.id} is now: ${t.status}`);
  } else if (act === 'reset-sample') {
    if (confirm('Replace everything with the sample data? Your entries will be lost.')) { state = sampleData(); save(); render(); toast('Sample data loaded'); }
  } else if (act === 'clear-all') {
    if (confirm('Delete everything and start with an empty app?')) {
      const keep = { fx: state.fx, company: state.company };
      state = Object.assign(emptyData(), keep); save(); render(); toast('Empty app ready – start with a purchase');
    }
  }
});

document.getElementById('fxInput').addEventListener('change', e => {
  const n = Number(e.target.value);
  if (n > 0) { state.fx = n; save(); toast('USD rate updated – used for new export sales'); }
  else e.target.value = state.fx;
});

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

state = load();
render();
