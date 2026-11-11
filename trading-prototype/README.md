# AG Farmedge Global – Cotton & Onion Trading (prototype)

A small office web app to manage the three steps of a trade:

1. **Purchases** – buy cotton or onion from a farmer. Each purchase becomes a **lot** (e.g. `O-002`).
2. **Transport** – book a hired truck for a lot and track it: Booked → In transit → Delivered.
3. **Sales** – sell from a lot to a trader in India (₹ per quintal) or abroad (USD per tonne).

Also included:

- **Other costs** – labour, packing, commission, mandi fee, GST, export duty. Each cost is charged to a lot.
- **Weight loss** – record quintals lost to drying, grading or rot on a lot (Edit the purchase).
- **Payments due** – every open balance. Each payment is kept with its date and a note, and a wrong entry can be removed.
- **Bills and slips** – a printable purchase slip, transport slip and sale bill (Print / save as PDF).
- **Backup** – download all data as a file and restore it on this or another computer.
- **Dashboard** – profit per lot, money you owe / are owed, and unsold stock.
- Works on phones: tables turn into cards.

This folder is separate from the main app in the repo root and never changes that app's data.
When both run on the same website, farmer and trader names from the main app appear as suggestions while typing.

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
| Bills and slips | **Simple records.** Not GST tax invoices, not export documents |
| GST, mandi fee, duty | **Typed in by you** as a cost. Nothing is calculated automatically |
| Truck status | **Updated by hand.** No GPS |
| Login / users | None. Anyone who opens the app in this browser sees the data |

## How the numbers work

- Quantity is in quintals (1 qtl = 100 kg). All money is stored in rupees.
- Export sale value = tonnes × USD rate per tonne × ₹ per USD.
- **Profit of a lot** = sales value − (quantity sold + weight loss) × purchase rate − freight − other costs.
- Unsold stock = quantity bought − quantity sold − weight loss.

## Test

`tests/journey.js` runs the whole journey in a real browser (buy → truck → sell in India → export sale → payments and history → costs → weight loss → bill → dashboard → backup and restore → phone layout).

```
python3 -m http.server 8080 &      # inside trading-prototype
node tests/journey.js              # needs Playwright (npm i playwright)
```

## Known limits

- Data is still saved in one browser. Backup and restore is by hand; there is no login and no automatic sync between computers. That needs an online account (for example the Firebase project the main app uses).
- Bills are simple records. A real GST invoice (HSN codes, tax split, invoice series) and export documents (shipping bill, packing list, certificate of origin) are not produced.
- Taxes and fees are typed in as costs; the app does not work them out from a percentage.
- Other costs are treated as paid when entered; there is no "due" tracking for them.
- The main app and this prototype share name suggestions only, not transactions.
