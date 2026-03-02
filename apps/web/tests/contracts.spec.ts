import { describe, expect, it } from 'vitest';
import { BFF_PUBLIC_PATHS } from '@dexera/api-types/openapi';

describe('generated api contracts', () => {
  it('exposes expected public paths', () => {
    expect(BFF_PUBLIC_PATHS).toContain('/health');
    expect(BFF_PUBLIC_PATHS).toContain('/api/v1/placeholder');
  });
});
