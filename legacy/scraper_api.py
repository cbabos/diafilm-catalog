#!/usr/bin/env python3
"""Scrape all products from diafilm.hu via Shopify products.json API."""
import json
import urllib.request
import time
import os

BASE_URL = "https://diafilm.hu/products.json?limit=250&page={}"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "products.json")

def fetch_page(page_num):
    url = BASE_URL.format(page_num)
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode('utf-8'))

def main():
    all_products = []
    page = 1
    seen_ids = set()

    while True:
        print(f"Fetching page {page}...")
        try:
            data = fetch_page(page)
            products = data.get('products', [])
            if not products:
                print(f"  No more products at page {page}")
                break

            count_new = 0
            for p in products:
                pid = p['id']
                if pid in seen_ids:
                    continue
                seen_ids.add(pid)

                variant = p.get('variants', [{}])[0]
                images = p.get('images', [])
                image_url = images[0]['src'] if images else None

                # Parse price
                price_str = variant.get('price', '0')
                price = float(price_str) if price_str else 0.0
                compare_at = variant.get('compare_at_price')
                compare_at_price = float(compare_at) if compare_at else None

                all_products.append({
                    'id': pid,
                    'title': p['title'],
                    'handle': p['handle'],
                    'url': f'https://diafilm.hu/products/{p["handle"]}',
                    'variantId': variant.get('id'),
                    'price': price,
                    'compareAtPrice': compare_at_price,
                    'available': variant.get('available', True),
                    'tags': p.get('tags', []),
                    'productType': p.get('product_type', ''),
                    'vendor': p.get('vendor', ''),
                    'imageUrl': image_url,
                })
                count_new += 1

            print(f"  Got {len(products)} products ({count_new} new)")
            page += 1
            time.sleep(0.5)
        except Exception as e:
            print(f"  Error: {e}")
            break

    # Sort alphabetically by title
    all_products.sort(key=lambda x: x['title'].lower())

    print(f"\nTotal unique products: {len(all_products)}")
    print(f"Saved to {OUTPUT_FILE}")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_products, f, ensure_ascii=False, indent=2)

    # Summary stats
    prices = [p['price'] for p in all_products if p['price'] > 0]
    print(f"\nPrice range: {min(prices):.0f} - {max(prices):.0f} Ft")
    print(f"Available: {sum(1 for p in all_products if p['available'])}")
    print(f"Unavailable: {sum(1 for p in all_products if not p['available'])}")
    print(f"With discount: {sum(1 for p in all_products if p['compareAtPrice'])}")
    print(f"With image: {sum(1 for p in all_products if p['imageUrl'])}")

    # First and last few
    print("\nFirst 3:")
    for p in all_products[:3]:
        print(f"  {p['title']} - {p['price']:.0f} Ft (variant: {p['variantId']})")
    print("\nLast 3:")
    for p in all_products[-3:]:
        print(f"  {p['title']} - {p['price']:.0f} Ft (variant: {p['variantId']})")

if __name__ == '__main__':
    main()