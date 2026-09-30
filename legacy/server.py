#!/usr/bin/env python3
"""
Diafilm Catalog — Local web app for browsing and ordering diafilms.
- Auto-rescrapes products.json if older than 1 day on startup
- Tracks price history (append-only, only on changes)
- Tracks disappeared products
- Bought items stored as full snapshots with timestamps
- Selection persistence (server-side, shared family-wide)
- Automated cart assembly via diafilm.hu Shopify API
"""
import json
import os
import time
import datetime
import urllib.request
import urllib.parse
import http.cookiejar
from http.server import HTTPServer, SimpleHTTPRequestHandler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DIAFILM_DATA_DIR", BASE_DIR)
PRODUCTS_FILE = os.path.join(DATA_DIR, "products.json")
BOUGHT_FILE = os.path.join(DATA_DIR, "bought.json")
SELECTED_FILE = os.path.join(DATA_DIR, "selected.json")
PRICE_HISTORY_FILE = os.path.join(DATA_DIR, "price_history.json")
DISAPPEARED_FILE = os.path.join(DATA_DIR, "products_seen.json")
PORT = int(os.environ.get("DIAFILM_PORT", "8765"))
RESCRAPE_MAX_AGE_SECONDS = 86400  # 1 day

# ── Scraping ──────────────────────────────────────────────────

def scrape_products():
    """Scrape all products from diafilm.hu via Shopify products.json API."""
    import unicodedata
    all_products = []
    page = 1
    seen_ids = set()

    while True:
        url = f"https://diafilm.hu/products.json?limit=250&page={page}"
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/json",
        })
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"  Scrape error page {page}: {e}")
            break

        products = data.get("products", [])
        if not products:
            break

        for p in products:
            pid = p["id"]
            if pid in seen_ids:
                continue
            seen_ids.add(pid)
            variant = p.get("variants", [{}])[0]
            images = p.get("images", [])
            price_str = variant.get("price", "0")
            compare_at = variant.get("compare_at_price")

            all_products.append({
                "id": pid,
                "title": p["title"],
                "handle": p["handle"],
                "url": f'https://diafilm.hu/products/{p["handle"]}',
                "variantId": variant.get("id"),
                "price": float(price_str) if price_str else 0.0,
                "compareAtPrice": float(compare_at) if compare_at else None,
                "available": variant.get("available", True),
                "tags": p.get("tags", []),
                "productType": p.get("product_type", ""),
                "vendor": p.get("vendor", ""),
                "imageUrl": images[0]["src"] if images else None,
            })

        page += 1
        time.sleep(0.5)

    def hun_normalize(s):
        s = s.lower()
        s = unicodedata.normalize("NFD", s)
        return "".join(c for c in s if unicodedata.category(c) != "Mn")

    all_products.sort(key=lambda p: hun_normalize(p["title"]))
    return all_products

# ── Price history ─────────────────────────────────────────────

def load_price_history():
    if os.path.exists(PRICE_HISTORY_FILE):
        with open(PRICE_HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_price_history(history):
    with open(PRICE_HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

def update_price_history(old_products, new_products):
    """Compare prices, append entries only for changed products."""
    history = load_price_history()
    today = datetime.date.today().isoformat()

    old_map = {p["id"]: p for p in old_products}
    new_map = {p["id"]: p for p in new_products}

    # Build a quick lookup of the last entry per product
    last_entries = {}
    for entry in history:
        pid = entry["id"]
        last_entries[pid] = entry

    changes = 0
    for pid, new_p in new_map.items():
        old_p = old_map.get(pid)
        last = last_entries.get(pid)

        # Determine if price changed vs either old scrape or last history entry
        ref_price = None
        ref_compare = None
        if last:
            ref_price = last["price"]
            ref_compare = last.get("compareAtPrice")
        elif old_p:
            ref_price = old_p["price"]
            ref_compare = old_p.get("compareAtPrice")

        if ref_price is None:
            # First time seeing this product — log it
            history.append({
                "id": pid,
                "title": new_p["title"],
                "price": new_p["price"],
                "compareAtPrice": new_p.get("compareAtPrice"),
                "date": today,
            })
            changes += 1
        elif ref_price != new_p["price"] or ref_compare != new_p.get("compareAtPrice"):
            history.append({
                "id": pid,
                "title": new_p["title"],
                "price": new_p["price"],
                "compareAtPrice": new_p.get("compareAtPrice"),
                "date": today,
            })
            changes += 1

    if changes > 0:
        save_price_history(history)
    return changes

# ── Disappeared products ──────────────────────────────────────

def load_disappeared():
    if os.path.exists(DISAPPEARED_FILE):
        with open(DISAPPEARED_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_disappeared(disappeared):
    with open(DISAPPEARED_FILE, "w", encoding="utf-8") as f:
        json.dump(disappeared, f, ensure_ascii=False, indent=2)

def check_disappeared(old_products, new_products):
    """Log products that were in old scrape but not in new scrape."""
    disappeared = load_disappeared()
    dis_ids = {d["id"] for d in disappeared}

    old_ids = {p["id"] for p in old_products}
    new_ids = {p["id"] for p in new_products}
    gone = old_ids - new_ids

    today = datetime.date.today().isoformat()
    new_count = 0
    for p in old_products:
        if p["id"] in gone and p["id"] not in dis_ids:
            disappeared.append({
                "id": p["id"],
                "title": p["title"],
                "lastPrice": p["price"],
                "lastSeen": today,
                "disappearedOn": today,
            })
            new_count += 1

    if new_count > 0:
        save_disappeared(disappeared)
    return new_count

# ── Rescrape with history tracking ────────────────────────────

def maybe_rescrape():
    """Re-scrape if products.json is missing or older than 1 day."""
    if not os.path.exists(PRODUCTS_FILE):
        print("📦 products.json not found, scraping...")
        products = scrape_products()
        with open(PRODUCTS_FILE, "w", encoding="utf-8") as f:
            json.dump(products, f, ensure_ascii=False, indent=2)
        print(f"   Scraped {len(products)} products.")
        # First scrape — log all as initial price history
        update_price_history([], products)
        return

    age = time.time() - os.path.getmtime(PRODUCTS_FILE)
    if age > RESCRAPE_MAX_AGE_SECONDS:
        print(f"📦 products.json is {age/3600:.1f}h old, re-scraping...")
        try:
            old_products = load_products()
            new_products = scrape_products()
            with open(PRODUCTS_FILE, "w", encoding="utf-8") as f:
                json.dump(new_products, f, ensure_ascii=False, indent=2)
            print(f"   Re-scraped {len(new_products)} products.")

            # Track price changes
            price_changes = update_price_history(old_products, new_products)
            if price_changes > 0:
                print(f"   📈 {price_changes} price change(s) logged.")

            # Track disappeared products
            gone = check_disappeared(old_products, new_products)
            if gone > 0:
                print(f"   👻 {gone} product(s) disappeared.")

        except Exception as e:
            print(f"   ⚠️ Re-scrape failed ({e}), using existing data.")
    else:
        print(f"📦 products.json is {age/3600:.1f}h old (fresh enough).")

# ── Data helpers ──────────────────────────────────────────────

def load_products():
    with open(PRODUCTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def load_bought():
    if os.path.exists(BOUGHT_FILE):
        with open(BOUGHT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_bought(bought_data):
    with open(BOUGHT_FILE, "w", encoding="utf-8") as f:
        json.dump(bought_data, f, ensure_ascii=False, indent=2)

def load_selected():
    if os.path.exists(SELECTED_FILE):
        with open(SELECTED_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_selected(selected_ids):
    with open(SELECTED_FILE, "w", encoding="utf-8") as f:
        json.dump(selected_ids, f, ensure_ascii=False, indent=2)

def migrate_bought():
    """Upgrade bare-ID bought.json to enriched snapshot format."""
    bought = load_bought()
    if not bought:
        return
    # Check if already migrated (first item is a dict with "id" key)
    if isinstance(bought[0], dict) and "boughtAt" in bought[0]:
        return  # Already enriched

    print("🔄 Migrating bought.json to snapshot format...")
    products = load_products()
    prod_map = {p["id"]: p for p in products}
    disappeared = load_disappeared()
    dis_map = {d["id"]: d for d in disappeared}

    now = datetime.datetime.now().isoformat()
    enriched = []
    for item in bought:
        if isinstance(item, dict):
            # Already partially enriched, skip
            enriched.append(item)
            continue
        pid = item  # bare ID
        prod = prod_map.get(pid)
        if prod:
            snapshot = {k: prod[k] for k in ("id", "title", "handle", "url", "variantId",
                                              "price", "compareAtPrice", "tags", "vendor", "imageUrl")}
        elif pid in dis_map:
            d = dis_map[pid]
            snapshot = {"id": pid, "title": d["title"], "handle": "", "url": "",
                        "variantId": None, "price": d.get("lastPrice", 0),
                        "compareAtPrice": None, "tags": [], "vendor": "Diafilm", "imageUrl": None}
        else:
            snapshot = {"id": pid, "title": "Ismeretlen (törölve)", "handle": "", "url": "",
                        "variantId": None, "price": 0, "compareAtPrice": None,
                        "tags": [], "vendor": "", "imageUrl": None}
        enriched.append({"id": pid, "boughtAt": now, "product": snapshot})

    save_bought(enriched)
    print(f"   Migrated {len(enriched)} bought item(s).")

# ── Cart assembly (Shopify AJAX API) ──────────────────────────

def add_to_cart(variant_ids):
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

    params = []
    for i, vid in enumerate(variant_ids):
        params.append(f"items[{i}][id]={vid}")
        params.append(f"items[{i}][quantity]=1")
    body = "&".join(params)

    req = urllib.request.Request(
        "https://diafilm.hu/cart/add.js",
        data=body.encode("utf-8"),
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
        method="POST",
    )
    resp = opener.open(req, timeout=30)
    resp.read()

    req2 = urllib.request.Request("https://diafilm.hu/cart.js")
    resp2 = opener.open(req2, timeout=15)
    cart_data = json.loads(resp2.read().decode("utf-8"))

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    opener_nr = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cookie_jar), NoRedirect(),
    )
    try:
        resp3 = opener_nr.open(urllib.request.Request("https://diafilm.hu/checkout"), timeout=15)
        checkout_url = resp3.url
    except urllib.error.HTTPError as e:
        checkout_url = e.headers.get("Location", "")

    return cart_data.get("token", ""), checkout_url, cart_data.get("item_count", 0), cart_data.get("total_price", 0)

# ── HTTP Server ───────────────────────────────────────────────

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/products":
            self._json_response(load_products()); return
        if path == "/api/bought":
            self._json_response(load_bought()); return
        if path == "/api/selection":
            self._json_response(load_selected()); return
        if path == "/api/price-history":
            self._json_response(load_price_history()); return
        if path.startswith("/api/price-history/"):
            pid = int(path.split("/")[-1])
            history = load_price_history()
            entries = [e for e in history if e["id"] == pid]
            self._json_response(entries); return
        if path == "/api/disappeared":
            self._json_response(load_disappeared()); return
        if path == "/":
            self.path = "/index.html"
            super().do_GET(); return
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/bought":
            # Accept enriched format (list of {id, boughtAt, product})
            body = self._read_body()
            data = json.loads(body) if body else []
            save_bought(data)
            self._json_response({"ok": True, "count": len(data)}); return

        if path == "/api/selection":
            body = self._read_body()
            ids = json.loads(body) if body else []
            save_selected(ids)
            self._json_response({"ok": True, "count": len(ids)}); return

        if path == "/api/order":
            body = self._read_body()
            data = json.loads(body) if body else {}
            variant_ids = data.get("variantIds", [])
            if not variant_ids:
                self._json_response({"error": "No items selected"}, status=400); return
            try:
                token, checkout_url, count, total = add_to_cart(variant_ids)
                self._json_response({
                    "ok": True, "cartToken": token, "checkoutUrl": checkout_url,
                    "itemCount": count, "totalPrice": total,
                })
            except Exception as e:
                self._json_response({"error": str(e)}, status=500)
            return

        self._json_response({"error": "Not found"}, status=404)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length).decode("utf-8") if length else ""

    def _json_response(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass

# ── Main ──────────────────────────────────────────────────────

def main():
    maybe_rescrape()
    migrate_bought()
    products = load_products()
    print(f"Loaded {len(products)} products from {PRODUCTS_FILE}")
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"📡 Diafilm Catalog running on http://0.0.0.0:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()

if __name__ == "__main__":
    main()