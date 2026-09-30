import { config } from '../config.js';
import type { OrderResponse } from '../types.js';

export interface CartFetchFn {
  (url: string, init?: RequestInit): Promise<Response>;
}

export class CartService {
  private fetchFn: CartFetchFn;

  constructor(fetchFn?: CartFetchFn) {
    this.fetchFn = fetchFn ?? ((url: string, init?: RequestInit) => fetch(url, init));
  }

  /**
   * Assemble a Shopify cart with the given variant IDs.
   * 1. POST to /cart/add.js with batch items format
   * 2. GET /cart.js to get cart token, item count, total price
   * 3. GET /checkout with no-redirect to capture 302 Location
   * Returns the checkout URL and cart details.
   */
  async assembleCart(variantIds: number[]): Promise<OrderResponse> {
    if (!variantIds || variantIds.length === 0) {
      throw new Error('No items selected');
    }

    // Build form-encoded body: items[0][id]=VARIANT_ID&items[0][quantity]=1&...
    const params: string[] = [];
    for (let i = 0; i < variantIds.length; i++) {
      params.push(`items[${i}][id]=${variantIds[i]}`);
      params.push(`items[${i}][quantity]=1`);
    }
    const body = params.join('&');

    // Step 1: Add items to cart
    const addResp = await this.fetchFn(`${config.shopifyBase}/cart/add.js`, {
      method: 'POST',
      headers: {
        'User-Agent': config.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    if (!addResp.ok) {
      throw new Error(`Cart add failed: HTTP ${addResp.status}`);
    }

    // We need cookies from the add response for subsequent requests
    // Node's fetch doesn't handle cookies automatically, so we extract Set-Cookie
    const cookies = this.extractCookies(addResp);

    // Step 2: Get cart details
    const cartResp = await this.fetchFn(`${config.shopifyBase}/cart.js`, {
      headers: {
        'User-Agent': config.userAgent,
        Accept: 'application/json',
        Cookie: cookies,
      },
    });

    if (!cartResp.ok) {
      throw new Error(`Cart fetch failed: HTTP ${cartResp.status}`);
    }

    const cartData = (await cartResp.json()) as {
      token: string;
      item_count: number;
      total_price: number;
    };

    // Step 3: Get checkout URL (follow redirect manually to capture 302 Location)
    const checkoutResp = await this.fetchFn(`${config.shopifyBase}/checkout`, {
      method: 'GET',
      headers: {
        'User-Agent': config.userAgent,
        Accept: 'text/html,application/xhtml+xml',
        Cookie: cookies,
      },
      redirect: 'manual', // Don't follow redirects
    });

    // The checkout URL is in the Location header (302 redirect)
    let checkoutUrl = '';
    if (checkoutResp.status >= 300 && checkoutResp.status < 400) {
      checkoutUrl = checkoutResp.headers.get('location') ?? '';
    }

    return {
      ok: true,
      cartToken: cartData.token ?? '',
      checkoutUrl,
      itemCount: cartData.item_count ?? 0,
      totalPrice: cartData.total_price ?? 0,
    };
  }

  private extractCookies(resp: Response): string {
    const setCookieHeaders = resp.headers.getSetCookie?.() ?? [];
    if (setCookieHeaders.length === 0) return '';
    // Extract just the name=value part from each Set-Cookie header
    return setCookieHeaders
      .map((h) => h.split(';')[0])
      .join('; ');
  }
}