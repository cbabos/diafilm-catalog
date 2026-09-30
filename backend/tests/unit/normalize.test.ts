import { describe, it, expect } from 'vitest';
import { normalize, compareHungarian, sortByTitle } from '../../src/utils/normalize.js';

describe('normalize', () => {
  it('lowercases text', () => {
    expect(normalize('HELLO')).toBe('hello');
  });

  it('removes Hungarian accents (á→a, é→e, í→i, ó→o, ö→o, ő→o, ú→u, ü→u, ű→u)', () => {
    expect(normalize('á')).toBe('a');
    expect(normalize('é')).toBe('e');
    expect(normalize('í')).toBe('i');
    expect(normalize('ó')).toBe('o');
    expect(normalize('ö')).toBe('o');
    expect(normalize('ő')).toBe('o');
    expect(normalize('ú')).toBe('u');
    expect(normalize('ü')).toBe('u');
    expect(normalize('ű')).toBe('u');
  });

  it('removes uppercase Hungarian accents', () => {
    expect(normalize('Á')).toBe('a');
    expect(normalize('É')).toBe('e');
    expect(normalize('Ő')).toBe('o');
    expect(normalize('Ű')).toBe('u');
  });

  it('handles mixed accented and non-accented text', () => {
    expect(normalize('Árvíztűrő tükörfúrógép')).toBe('arvizturo tukorfurogep');
  });

  it('preserves non-accented characters', () => {
    expect(normalize('abcdefgh')).toBe('abcdefgh');
  });

  it('handles empty string', () => {
    expect(normalize('')).toBe('');
  });

  it('handles numbers and special chars', () => {
    expect(normalize('A 7 kis törpe')).toBe('a 7 kis torpe');
  });
});

describe('compareHungarian', () => {
  it('returns 0 for identical strings', () => {
    expect(compareHungarian('alma', 'alma')).toBe(0);
  });

  it('returns 0 for accent-only differences', () => {
    expect(compareHungarian('álma', 'alma')).toBe(0);
    expect(compareHungarian('törpe', 'torpe')).toBe(0);
  });

  it('returns negative when a < b', () => {
    expect(compareHungarian('alma', 'banán')).toBeLessThan(0);
  });

  it('returns positive when a > b', () => {
    expect(compareHungarian('banán', 'alma')).toBeGreaterThan(0);
  });

  it('sorts accent-insensitively: alma before árvíz', () => {
    // Both normalize to "al..." — "alma" < "arvizturo"
    expect(compareHungarian('alma', 'árvíztűrő')).toBeLessThan(0);
  });
});

describe('sortByTitle', () => {
  it('sorts array by title accent-insensitively', () => {
    const items = [
      { title: 'Árvíztűrő', id: 3 },
      { title: 'Alma', id: 1 },
      { title: 'Éva', id: 2 },
    ];
    const sorted = sortByTitle(items, (i) => i.title);
    expect(sorted[0].title).toBe('Alma');
    expect(sorted[1].title).toBe('Árvíztűrő');
    expect(sorted[2].title).toBe('Éva');
  });

  it('does not mutate original array', () => {
    const items = [
      { title: 'Zebra', id: 2 },
      { title: 'Alma', id: 1 },
    ];
    const sorted = sortByTitle(items, (i) => i.title);
    expect(items[0].title).toBe('Zebra'); // Original unchanged
    expect(sorted[0].title).toBe('Alma');
  });
});