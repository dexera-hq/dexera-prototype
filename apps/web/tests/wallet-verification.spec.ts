import { describe, expect, it, vi } from 'vitest';

import { requestWalletChallenge, verifyWalletOwnership } from '../lib/wallet/verification';

describe('wallet verification API decoding', () => {
  it('returns plain text server errors instead of JSON parse failures', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('challengeId is required', {
          status: 400,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        }),
      );

    await expect(
      verifyWalletOwnership(
        {
          address: '0x0000000000000000000000000000000000000002',
          challengeId: 'challenge-123',
          signature: `0x${'11'.repeat(65)}`,
          venue: 'aster',
        },
        { fetchImpl },
      ),
    ).rejects.toThrow('challengeId is required');
  });

  it('still decodes successful JSON payloads', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            challengeId: 'challenge-123',
            message: 'Dexera verification challenge',
            issuedAt: '2026-03-04T12:00:00Z',
            expiresAt: '2026-03-04T12:05:00Z',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

    await expect(
      requestWalletChallenge(
        {
          address: '0x0000000000000000000000000000000000000002',
        },
        { fetchImpl },
      ),
    ).resolves.toMatchObject({
      challengeId: 'challenge-123',
      message: 'Dexera verification challenge',
    });
  });
});
