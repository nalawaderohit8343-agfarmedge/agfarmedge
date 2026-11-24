#!/usr/bin/env python3
"""Fetch today's Agmarknet onion prices from data.gov.in and update market-data/onion/.

Run by .github/workflows/onion-prices.yml. Needs the API key in the
DATA_GOV_IN_KEY environment variable (a GitHub Actions secret).

Outputs (all under market-data/onion/):
  latest.json         today's all-India onion records + tracked-market summary
  watch-history.json  daily modal/min/max for tracked markets (for trends)
  history.csv         every onion record ever fetched, de-duplicated
  markets-seen.json   market names Agmarknet used today, by state (to fix matching)

Local test without the API:  python scripts/fetch_onion_prices.py --fixture sample.json
"""
import argparse, csv, json, os, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070"  # Current Daily Price of Various Commodities from Various Markets (Mandi)
API = "https://api.data.gov.in/resource/" + RESOURCE
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "market-data", "onion")
IST = timezone(timedelta(hours=5, minutes=30))
PAGE = 1000
KEEP_DAYS = 400
FIELDS = ["arrival_date", "state", "district", "market", "variety", "grade", "min_price", "max_price", "modal_price"]


def get_json(params, tries=3):
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "agfarmedge-onion-feed/1.0", "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:300]
            if e.code in (401, 403):
                sys.exit(f"API key rejected (HTTP {e.code}): {body}")
            err = f"HTTP {e.code}: {body}"
        except Exception as e:  # network hiccup, bad JSON
            err = repr(e)
        print(f"  attempt {i + 1} failed: {err}")
        time.sleep(5 * (i + 1))
    sys.exit("Could not reach data.gov.in after retries")


def fetch_all(key, filt):
    """Page through the API with one filter dict; returns raw records."""
    out, offset = [], 0
    while True:
        params = {"api-key": key, "format": "json", "limit": PAGE, "offset": offset}
        params.update(filt)
        d = get_json(params)
        if isinstance(d, dict) and d.get("status") == "error":
            sys.exit("API error: " + str(d.get("message")))
        recs = d.get("records") or []
        out.extend(recs)
        total = int(d.get("total") or 0)
        offset += PAGE
        if not recs or offset >= total or offset > 60000:
            return out


def norm_key(k):
    return k.strip().lower().replace("_x0020_", "_").replace(" ", "_")


def to_num(v):
    try:
        return float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def to_iso(s):
    s = str(s or "").strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def normalise(raw):
    rows = []
    for r in raw:
        r = {norm_key(k): v for k, v in r.items()}
        if "onion" not in str(r.get("commodity", "")).lower():
            continue
        date, modal = to_iso(r.get("arrival_date")), to_num(r.get("modal_price"))
        if not date or not modal or modal <= 0:
            continue
        rows.append({
            "arrival_date": date,
            "state": str(r.get("state", "")).strip(),
            "district": str(r.get("district", "")).strip(),
            "market": str(r.get("market", "")).strip(),
            "variety": str(r.get("variety", "")).strip(),
            "grade": str(r.get("grade", "")).strip(),
            "min_price": to_num(r.get("min_price")) or modal,
            "max_price": to_num(r.get("max_price")) or modal,
            "modal_price": modal,
        })
    return rows


def matches(rec, spec):
    if rec["state"].lower() != spec["state"].lower():
        return False
    hay = (rec["market"] + " " + rec["district"]).lower()
    return any(m.lower() in hay for m in spec["match"])


def summarise(rows, spec):
    hit = [r for r in rows if matches(r, spec)]
    if not hit:
        return None
    latest = max(r["arrival_date"] for r in hit)
    hit = [r for r in hit if r["arrival_date"] == latest]
    modals = sorted(r["modal_price"] for r in hit)
    mid = len(modals) // 2
    median = modals[mid] if len(modals) % 2 else (modals[mid - 1] + modals[mid]) / 2
    return {
        "date": latest,
        "modal": round(median),
        "min": round(min(r["min_price"] for r in hit)),
        "max": round(max(r["max_price"] for r in hit)),
        "n": len(hit),
        "markets": sorted({f'{r["market"]} ({r["variety"]})' for r in hit}),
    }


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json(path, obj, indent=None):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent, separators=None if indent else (",", ":"))
        f.write("\n")
    os.replace(tmp, path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixture", help="JSON file with raw API records, for testing without the API")
    a = ap.parse_args()

    if a.fixture:
        raw = load_json(a.fixture, [])
        raw = raw.get("records", raw) if isinstance(raw, dict) else raw
    else:
        key = os.environ.get("DATA_GOV_IN_KEY", "").strip()
        if not key:
            sys.exit("DATA_GOV_IN_KEY is not set. Add it under repo Settings > Secrets and variables > Actions.")
        raw = []
        for filt in ({"filters[commodity]": "Onion"}, {"filters[commodity.keyword]": "Onion"}, {}):
            print("Fetching with", filt or "no filter (all commodities)")
            raw = fetch_all(key, filt)
            if normalise(raw):
                break

    rows = normalise(raw)
    print(f"{len(raw)} raw records, {len(rows)} usable onion records")
    if not rows:
        print("No onion records today (holiday or data not yet published). Nothing changed.")
        return

    cfg = load_json(os.path.join(ROOT, "market-data", "markets.json"), {"markets": []})
    os.makedirs(OUT, exist_ok=True)
    now = datetime.now(IST).isoformat(timespec="minutes")

    watch = {}
    for m in cfg.get("markets", []):
        s = summarise(rows, m)
        if s:
            s["name"] = m["name"]
            watch[m["id"]] = s
    local = summarise(rows, cfg["local"]) if cfg.get("local") else None
    print("Tracked markets found today:", ", ".join(watch) or "none", "| local:", "yes" if local else "no")

    rows.sort(key=lambda r: (r["state"], r["district"], r["market"], r["variety"]))
    write_json(os.path.join(OUT, "latest.json"), {
        "fetched_at": now,
        "source": "Agmarknet via data.gov.in resource " + RESOURCE,
        "records_total": len(rows),
        "watch": watch,
        "local": local,
        "records": rows,
    })

    # Tracked-market history for trend lines (keyed by Agmarknet arrival date).
    hpath = os.path.join(OUT, "watch-history.json")
    hist = load_json(hpath, {"days": {}})
    days = hist.get("days", {})
    for mid, s in list(watch.items()) + ([("local", local)] if local else []):
        days.setdefault(s["date"], {})[mid] = {"modal": s["modal"], "min": s["min"], "max": s["max"]}
    cutoff = (datetime.now(IST).date() - timedelta(days=KEEP_DAYS)).isoformat()
    days = {d: v for d, v in sorted(days.items()) if d >= cutoff}
    write_json(hpath, {"updated": now, "days": days})

    # Full de-duplicated archive of every onion record, for long-term analysis.
    cpath = os.path.join(OUT, "history.csv")
    seen = set()
    if os.path.exists(cpath):
        with open(cpath, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                seen.add(tuple(r[k] for k in FIELDS[:6]))
    new = [r for r in rows if tuple(str(r[k]) for k in FIELDS[:6]) not in seen]
    first = not os.path.exists(cpath)
    with open(cpath, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if first:
            w.writeheader()
        for r in new:
            w.writerow({k: (round(r[k]) if k.endswith("price") else r[k]) for k in FIELDS})
    print(f"history.csv: {len(new)} new rows")

    seen_m = {}
    for r in rows:
        seen_m.setdefault(r["state"], set()).add(f'{r["market"]} ({r["district"]})')
    write_json(os.path.join(OUT, "markets-seen.json"),
               {"updated": now, "states": {k: sorted(v) for k, v in sorted(seen_m.items())}}, indent=1)


if __name__ == "__main__":
    main()
