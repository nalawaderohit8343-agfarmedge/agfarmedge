# Daily onion prices (Agmarknet)

A GitHub Action (`.github/workflows/onion-prices.yml`) runs `scripts/fetch_onion_prices.py`
at 11:10 and 18:10 IST. It pulls every onion record from data.gov.in resource
`9ef84268-d588-465a-a308-a864a43d0070` (Agmarknet daily mandi prices) and commits:

| File | What it holds |
|---|---|
| `onion/latest.json` | Latest fetch: all-India onion records + summary for tracked markets |
| `onion/watch-history.json` | Daily modal/min/max for tracked markets (last 400 days) — used for trends |
| `onion/history.csv` | Every onion record ever fetched, de-duplicated — for long-term analysis |
| `onion/markets-seen.json` | Exact market names Agmarknet used, by state |

`market.html` (the **📈 Markets** button in the app) reads these files.

## One-time setup
1. Register at data.gov.in and copy your API key from your account dashboard.
2. Repo **Settings → Secrets and variables → Actions → New repository secret**:
   name `DATA_GOV_IN_KEY`, value = your key.
3. **Actions** tab → *Daily onion prices* → **Run workflow** for the first fetch.

## Tracking a different mandi
Edit `markets.json`. `state` must match Agmarknet's spelling; a record counts when its
market or district name contains any `match` text. Look in `onion/markets-seen.json`
for the exact names. A new market can carry `"km": 900` (road distance from Dhule);
it then appears on the Markets page — set its freight and charges there.
