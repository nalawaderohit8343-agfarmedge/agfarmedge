# AG Farmedge Global – Cotton & Onion Trading (prototype)

A small office web app to manage the three steps of a trade:

1. **Purchases** – buy cotton or onion from a farmer. Each purchase becomes a **lot** (e.g. `O-002`).
2. **Transport** – book a hired truck for a lot and track it: Booked → In transit → Delivered.
3. **Sales** – sell from a lot to a trader in India (₹ per quintal) or abroad (USD per tonne).

The **Dashboard** shows profit per lot, money you owe / are owed, and unsold stock.
**Payments due** lists every open balance and lets you record a payment.

This folder is separate from the main app in the repo root. It does not read or change that app's data.

## How to run

No install needed. Either:

- double-click `index.html`, or
- run a small local server (recommended):

  ```
  cd trading-prototype
  python3 -m http.server 8080
  ```
  then open <http://localhost:8080>.

The app opens with sample data. Click **Start empty** (bottom of the page) to enter your own.

## What is simulated

| Item | Status |
|---|---|
| Farmers, transporters, buyers, amounts on first open | **Sample data – made up** (yellow banner shows while it is loaded) |
| USD → ₹ rate (default 88) | **Simulated, not live.** Type the real rate at the bottom of the page or in each export sale |
| Payments | **Manual record only.** No bank or UPI is connected |
| Truck status | **Updated by hand.** No GPS |
| Login / users | None. Anyone who opens the app in this browser sees the data |

## How the numbers work

- Quantity is in quintals (1 qtl = 100 kg). All money is stored in rupees.
- Export sale value = tonnes × USD rate per tonne × ₹ per USD.
- **Profit of a lot** = sales value − (quantity sold × purchase rate) − all freight of that lot.
- Unsold stock = quantity bought − quantity sold.

## Test

`tests/journey.js` runs the whole journey in a real browser (buy → truck → sell in India → export sale → payments → dashboard → reload).

```
python3 -m http.server 8080 &      # inside trading-prototype
node tests/journey.js              # needs Playwright (npm i playwright)
```

## Known limits

- Data is saved only in this browser (localStorage). Clearing browser data deletes it. No backup, no sync between computers.
- A payment only adds to the "paid" total. There is no dated payment history.
- Costs other than purchase and freight (labour, packing, commission, mandi tax, GST, export duty) are not included in profit.
- No invoices, weighbridge slips or export documents.
- Storage loss, grading and moisture loss are not tracked.
- If this folder is published on the same GitHub Pages site as the main app, the main app's offline cache (`sw.js`) may keep showing an old copy of the prototype after an update.
