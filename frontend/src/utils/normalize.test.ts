import { describe, it, expect } from 'vitest';
import { normalize, matchesSearch, PROJECTOR_ID } from './normalize';

describe('normalize', () => {
  it('strips Hungarian diacritics (á→a, é→e, ö→o, ő→o, ü→u, ű→u)', () => {
    expect(normalize('árvíztűrő tükörfúrógép')).toBe('arvizturo tukorfurogep');
  });

  it('converts to lowercase', () => {
    expect(normalize('ABCDEF')).toBe('abcdef');
  });

  it('trims whitespace', () => {
    expect(normalize('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(normalize('')).toBe('');
  });

  it('handles all Hungarian vowels with diacritics', () => {
    // All Hungarian accented vowels should be stripped to their base form
    expect(normalize('ÁÉÍÓÖŐÚÜŰ')).toBe('aeiooouuu');
  });

  it('preserves non-accented characters', () => {
    expect(normalize('hello world')).toBe('hello world');
  });

  it('handles numbers and special characters', () => {
    expect(normalize('test 123 !')).toBe('test 123 !');
  });

  it('PROJECTOR_ID is the correct constant', () => {
    expect(PROJECTOR_ID).toBe(8462548992273);
  });
});

describe('matchesSearch', () => {
  const product = { title: 'Árvíztűrő diafilm', tags: ['kaland', 'őrült'] };

  it('matches title with accents when searching without accents', () => {
    expect(matchesSearch(product, 'arvizturo')).toBe(true);
  });

  it('matches tags accent-insensitively', () => {
    expect(matchesSearch(product, 'orult')).toBe(true);
  });

  it('returns true for empty search term', () => {
    expect(matchesSearch(product, '')).toBe(true);
  });

  it('returns true for whitespace-only search term', () => {
    expect(matchesSearch(product, '   ')).toBe(true);
  });

  it('returns false for non-matching term', () => {
    expect(matchesSearch(product, 'xyz')).toBe(false);
  });

  it('handles products with empty tags array', () => {
    expect(matchesSearch({ title: 'Test', tags: [] }, 'test')).toBe(true);
  });
});