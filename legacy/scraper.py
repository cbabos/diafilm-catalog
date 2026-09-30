#!/usr/bin/env python3
"""Scrape all products from diafilm.hu - all 11 pages."""
import json
import re
import urllib.request
import time
import os

BASE_URL = "https://diafilm.hu/collections/osszes-diafilm?sort_by=title-ascending&page={}"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "products.json")

def fetch_page(page_num):
    """Fetch a single page and extract product data using regex on the HTML."""
    url = BASE_URL.format(page_num)
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'hu,en-US;q=0.9,en;q=0.8',
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        html = resp.read().decode('utf-8')
    return html

def extract_products(html):
    """Extract product data from HTML using regex patterns."""
    products = []
    
    # Pattern: each product has a form with action="/cart/add" and an input name="id" value="VARIANT_ID"
    # and input name="product-id" value="PRODUCT_ID"
    # The product link is nearby with href="/products/SLUG"
    
    # Find all product forms
    form_pattern = re.compile(
        r'<form[^>]*action="/cart/add"[^>]*>.*?<input[^>]*name="id"[^>]*value="(\d+)"[^>]*>.*?'
        r'<input[^>]*name="product-id"[^>]*value="(\d+)"[^>]*>',
        re.DOTALL
    )
    
    # Find product links and prices
    # Product links: <a href="/products/SLUG" ...>TITLE</a>
    link_pattern = re.compile(
        r'<a[^>]*href="/products/([^"?]+)"[^>]*class="[^"]*product-item__[^"]*"[^>]*>\s*([^<]+)\s*</a>',
        re.DOTALL
    )
    
    # Also try a broader link pattern
    link_pattern2 = re.compile(
        r'<a[^>]*href="/products/([^"?]+)"[^>]*>([^<]+)</a>',
        re.DOTALL
    )
    
    # Price pattern: "X.XXX Ft"
    price_pattern = re.compile(r'([\d.]+)\s*Ft')
    
    # Discount label
    discount_pattern = re.compile('Kedvezményes ár')
    
    # Sold out
    soldout_pattern = re.compile('Elfogy|sold.?out', re.IGNORECASE)
    
    # Find all forms with their variant/product IDs
    forms = form_pattern.findall(html)
    
    # Find all product links (deduplicated by slug)
    links = link_pattern2.findall(html)
    # Filter out non-product links (like /collections)
    product_links = [(slug, title.strip()) for slug, title in links if not slug.startswith('collections')]
    # Deduplicate preserving order
    seen_slugs = set()
    unique_links = []
    for slug, title in product_links:
        if slug not in seen_slugs:
            seen_slugs.add(slug)
            unique_links.append((slug, title))
    
    # Find all prices in order
    prices = price_pattern.findall(html)
    
    # Find all discount markers
    discount_positions = [m.start() for m in discount_pattern.finditer(html)]
    
    # Now we need to associate forms with links and prices
    # The structure is: product card contains link + price + form
    
    # Let's try a different approach: find product card blocks
    # Split by product-item patterns
    
    # Find positions of all product links
    link_positions = []
    for m in re.finditer(r'<a[^>]*href="/products/([^"?]+)"[^>]*>([^<]+)</a>', html):
        slug = m.group(1)
        if not slug.startswith('collections'):
            link_positions.append((m.start(), m.end(), slug, m.group(2).strip()))
    
    # Find positions of all forms
    form_positions = []
    for m in re.finditer(r'<form[^>]*action="/cart/add"[^>]*>.*?<input[^>]*name="id"[^>]*value="(\d+)"[^>]*>.*?<input[^>]*name="product-id"[^>]*value="(\d+)"', html, re.DOTALL):
        form_positions.append((m.start(), m.end(), m.group(1), m.group(2)))
    
    # Find positions of all prices
    price_positions = []
    for m in price_pattern.finditer(html):
        price_positions.append((m.start(), m.end(), m.group(1)))
    
    # Associate: for each product link, find the nearest form and price
    used_forms = set()
    used_prices = set()
    
    for link_start, link_end, slug, title in link_positions:
        # Find nearest form after this link (within reasonable distance)
        best_form = None
        best_form_dist = float('inf')
        for i, (fstart, fend, vid, pid) in enumerate(form_positions):
            if i in used_forms:
                continue
            dist = abs(fstart - link_start)
            if dist < best_form_dist and dist < 5000:
                best_form_dist = dist
                best_form = i
        
        # Find nearest price after this link
        best_price = None
        best_price_dist = float('inf')
        for i, (pstart, pend, price) in enumerate(price_positions):
            if i in used_prices:
                continue
            dist = abs(pstart - link_start)
            if dist < best_price_dist and dist < 5000:
                best_price_dist = dist
                best_price = i
        
        product = {
            'title': title,
            'slug': slug,
            'url': f'https://diafilm.hu/products/{slug}',
        }
        
        if best_form is not None:
            used_forms.add(best_form)
            product['variantId'] = form_positions[best_form][2]
            product['productId'] = form_positions[best_form][3]
        
        if best_price is not None:
            used_prices.add(best_price)
            product['price'] = price_positions[best_price][2]
        else:
            product['price'] = None
        
        # Check for discount near this product
        product['hasDiscount'] = False
        for dpos in discount_positions:
            if abs(dpos - link_start) < 3000:
                product['hasDiscount'] = True
                break
        
        products.append(product)
    
    return products

def main():
    all_products = []
    seen_titles = set()
    
    for page in range(1, 12):
        print(f"Fetching page {page}...")
        try:
            html = fetch_page(page)
            products = extract_products(html)
            print(f"  Found {len(products)} products")
            
            for p in products:
                if p['title'] not in seen_titles:
                    seen_titles.add(p['title'])
                    all_products.append(p)
            
            time.sleep(1)  # Be polite
        except Exception as e:
            print(f"  Error: {e}")
    
    print(f"\nTotal unique products: {len(all_products)}")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_products, f, ensure_ascii=False, indent=2)
    
    print(f"Saved to {OUTPUT_FILE}")
    
    # Print sample
    if all_products:
        print("\nFirst 3 products:")
        for p in all_products[:3]:
            print(f"  {p['title']} - {p.get('price', 'N/A')} Ft (variant: {p.get('variantId', 'N/A')})")
        print("\nLast 3 products:")
        for p in all_products[-3:]:
            print(f"  {p['title']} - {p.get('price', 'N/A')} Ft (variant: {p.get('variantId', 'N/A')})")

if __name__ == '__main__':
    main()