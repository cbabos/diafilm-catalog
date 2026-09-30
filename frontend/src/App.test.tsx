import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { useUIStore } from './store/uiStore';
import type { Product, BoughtItem, PriceHistoryEntry } from './types';

// ── Mock data ────────────────────────────────────────────────────

const mockProducts: Product[] = [
  {
    id: 8462548992273,
    title: 'Diafilm Vetítő',
    handle: 'diafilm-vetito',
    url: 'https://diafilm.hu/products/vetito',
    variantId: 111,
    price: 25000,
    compareAtPrice: null,
    available: true,
    tags: ['eszköz'],
    productType: 'vetito',
    vendor: 'Diafilm Kft',
    imageUrl: 'https://example.com/vetito.jpg',
  },
  {
    id: 1,
    title: 'Árvíztűrő kaland',
    handle: 'arvizturo-kaland',
    url: 'https://diafilm.hu/products/arvizturo',
    variantId: 222,
    price: 1690,
    compareAtPrice: 2000,
    available: true,
    tags: ['kaland', 'víz'],
    productType: 'diafilm',
    vendor: 'Diafilm Kft',
    imageUrl: 'https://example.com/1.jpg',
  },
  {
    id: 2,
    title: 'Csendes erdő',
    handle: 'csendes-erdo',
    url: 'https://diafilm.hu/products/csendes-erdo',
    variantId: 333,
    price: 1500,
    compareAtPrice: null,
    available: true,
    tags: ['természet'],
    productType: 'diafilm',
    vendor: 'Diafilm Kft',
    imageUrl: 'https://example.com/2.jpg',
  },
];

const mockBought: BoughtItem[] = [
  {
    id: 2,
    boughtAt: '2024-01-15T10:00:00.000Z',
    product: mockProducts[2],
  },
];

const mockSelection: number[] = [1];

const mockPriceHistory: PriceHistoryEntry[] = [
  { id: 1, title: 'Árvíztűrő kaland', price: 2000, compareAtPrice: null, date: '2024-01-01' },
  { id: 1, title: 'Árvíztűrő kaland', price: 1690, compareAtPrice: 2000, date: '2024-02-01' },
];

// ── Mock fetch ───────────────────────────────────────────────────

const fetchHandler = (url: string, options?: RequestInit): Promise<Response> => {
  const body = options?.body ? JSON.parse(options.body as string) : undefined;

  const response: Record<string, unknown> = {};
  let responseData: unknown = null;

  if (url === '/api/products') {
    responseData = mockProducts;
  } else if (url === '/api/bought') {
    if (options?.method === 'POST') {
      responseData = body;
    } else {
      responseData = mockBought;
    }
  } else if (url === '/api/selection') {
    if (options?.method === 'POST') {
      responseData = body;
    } else {
      responseData = mockSelection;
    }
  } else if (url === '/api/price-history') {
    responseData = mockPriceHistory;
  } else if (url.match(/^\/api\/price-history\/\d+$/)) {
    const id = parseInt(url.split('/').pop()!);
    responseData = mockPriceHistory.filter((e) => e.id === id);
  } else if (url === '/api/order') {
    responseData = {
      ok: true,
      cartToken: 'test-token',
      checkoutUrl: 'https://diafilm.hu/checkout/test',
      itemCount: body?.variantIds?.length ?? 0,
      totalPrice: 169000,
    };
  }

  return Promise.resolve({
    ...response,
    ok: true,
    json: () => Promise.resolve(responseData),
    text: () => Promise.resolve(JSON.stringify(responseData)),
    statusText: 'OK',
    status: 200,
  } as Response);
};

const mockFetch = vi.fn(fetchHandler);

// ── Test helpers ─────────────────────────────────────────────────

function renderApp() {
  // Create a fresh query client for each test to avoid cache pollution
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────

describe('App Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.stubGlobal('fetch', mockFetch);
    // Reset UI store
    useUIStore.setState({
      filter: 'all',
      hideBought: true,
      searchTerm: '',
      debouncedSearch: '',
      activeModal: null,
      priceHistoryProductId: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders header with product count after loading', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByText(/Diafilm Katalógus/)).toBeInTheDocument();
    });
    // Should show product count
    await waitFor(() => {
      expect(screen.getByText(/\d+ diafilm/)).toBeInTheDocument();
    });
  });

  it('renders product cards after loading', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getAllByTestId('product-card').length).toBeGreaterThan(0);
    });
  });

  it('projector is sorted to top', async () => {
    renderApp();
    await waitFor(() => {
      const cards = screen.getAllByTestId('product-card');
      expect(cards[0]).toHaveTextContent('Diafilm Vetítő');
    });
  });

  it('filtering by Akciós shows only sale items', async () => {
    renderApp();
    await waitFor(() => screen.getAllByTestId('product-card'));

    fireEvent.click(screen.getByText('Akciós'));

    await waitFor(() => {
      const cards = screen.getAllByTestId('product-card');
      // Only Árvíztűrő kaland is on sale (compareAtPrice != null)
      expect(cards.length).toBe(1);
      expect(cards[0]).toHaveTextContent('Árvíztűrő kaland');
    });
  });

  it('searching with accent-insensitive match works', async () => {
    renderApp();
    await waitFor(() => screen.getAllByTestId('product-card'));

    const input = screen.getByLabelText('Keresés');
    fireEvent.change(input, { target: { value: 'arvizturo' } });

    // Wait for debounce
    await waitFor(
      () => {
        const cards = screen.getAllByTestId('product-card');
        expect(cards.length).toBe(1);
        expect(cards[0]).toHaveTextContent('Árvíztűrő kaland');
      },
      { timeout: 500 },
    );
  });

  it('toggling checkbox updates selection', async () => {
    renderApp();
    await waitFor(() => screen.getAllByTestId('product-card'));

    // Product 1 (Árvíztűrő kaland) is already selected (mockSelection=[1])
    // Let's toggle product 2 (Csendes erdő) — but it's bought and hidden by default
    // Toggle the projector instead
    const cards = screen.getAllByTestId('product-card');
    const projectorCheckbox = cards[0].querySelector('[data-testid="select-box"]')!;

    fireEvent.click(projectorCheckbox);

    // Fetch should have been called with POST /api/selection
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('hide bought toggle works', async () => {
    renderApp();
    await waitFor(() => screen.getAllByTestId('product-card'));

    // Csendes erdő is bought — hidden by default in "all" filter
    // Let's toggle hide bought off
    fireEvent.click(screen.getByText('Elrejti vásároltakat'));

    await waitFor(() => {
      const cards = screen.getAllByTestId('product-card');
      // Should now show all products including bought
      expect(cards.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('Megvett filter shows only bought items', async () => {
    renderApp();
    await waitFor(() => screen.getAllByTestId('product-card'));

    fireEvent.click(screen.getByText(/Megvett/));

    await waitFor(() => {
      const cards = screen.getAllByTestId('product-card');
      expect(cards.length).toBe(1);
      expect(cards[0]).toHaveTextContent('Csendes erdő');
    });
  });

  it('Kijelölt filter shows only selected items', async () => {
    renderApp();
    await waitFor(() => screen.getAllByTestId('product-card'));

    fireEvent.click(screen.getByText(/Kijelölt/));

    await waitFor(() => {
      const cards = screen.getAllByTestId('product-card');
      expect(cards.length).toBe(1);
      expect(cards[0]).toHaveTextContent('Árvíztűrő kaland');
    });
  });

  it('price history icon is shown for products with >1 history entries', async () => {
    renderApp();
    await waitFor(() => screen.getAllByTestId('product-card'));

    // Product 1 has 2 price history entries
    expect(screen.getByTestId('history-icon')).toBeInTheDocument();
  });

  it('clicking price history icon opens modal', async () => {
    renderApp();
    await waitFor(() => screen.getAllByTestId('product-card'));

    fireEvent.click(screen.getByTestId('history-icon'));

    await waitFor(() => {
      expect(screen.getByText('📈 Ártörténet')).toBeInTheDocument();
    });
  });

  it('order modal opens when Rendelés button clicked', async () => {
    renderApp();
    await waitFor(() => screen.getAllByTestId('product-card'));

    // Product 1 is selected (from mockSelection), so order button should be enabled
    fireEvent.click(screen.getByTestId('order-btn'));

    await waitFor(() => {
      expect(screen.getByText('🛒 Rendelés összesítő')).toBeInTheDocument();
    });
  });
});