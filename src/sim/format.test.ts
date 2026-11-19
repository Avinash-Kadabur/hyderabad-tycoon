import { describe, expect, it } from 'vitest';
import { formatRupees } from './format';

describe('formatRupees', () => {
  it('groups digits the Indian way', () => {
    expect(formatRupees(0)).toBe('₹0');
    expect(formatRupees(500)).toBe('₹500');
    expect(formatRupees(2000)).toBe('₹2,000');
    expect(formatRupees(100000)).toBe('₹1,00,000');
    expect(formatRupees(1000000)).toBe('₹10,00,000');
    expect(formatRupees(123456789)).toBe('₹12,34,56,789');
  });

  it('handles spending and rounds to whole rupees', () => {
    expect(formatRupees(-2500)).toBe('-₹2,500');
    expect(formatRupees(1999.6)).toBe('₹2,000');
  });
});
