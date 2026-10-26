import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '../src/server/api.js';

describe('limite de recherches par minute', () => {
  it('bloque au-delà de la limite, client par client, en indiquant le délai', () => {
    const check = createRateLimiter(2);
    check('a');
    check('a');
    check('b');
    let error;
    try {
      check('a');
    } catch (err) {
      error = err;
    }
    expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    expect(error.details.retryAfter).toBeGreaterThan(0);
  });
});
