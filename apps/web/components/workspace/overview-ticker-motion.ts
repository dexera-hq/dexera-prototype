export const OVERVIEW_TICKER_LOOP_DURATION_MS = 24_000;
export const OVERVIEW_TICKER_EASING_MS = 220;

export function computeTickerBaseVelocity(
  sequenceDistancePx: number,
  durationMs = OVERVIEW_TICKER_LOOP_DURATION_MS,
): number {
  if (sequenceDistancePx <= 0 || durationMs <= 0) {
    return 0;
  }

  return sequenceDistancePx / durationMs;
}

export function easeTickerVelocity(
  currentVelocity: number,
  targetVelocity: number,
  deltaMs: number,
  easingMs = OVERVIEW_TICKER_EASING_MS,
): number {
  if (deltaMs <= 0) {
    return currentVelocity;
  }

  if (easingMs <= 0) {
    return targetVelocity;
  }

  const blend = 1 - Math.exp(-deltaMs / easingMs);
  return currentVelocity + (targetVelocity - currentVelocity) * blend;
}

export function wrapTickerOffset(offsetPx: number, sequenceDistancePx: number): number {
  if (sequenceDistancePx <= 0) {
    return 0;
  }

  const remainder = offsetPx % sequenceDistancePx;

  if (remainder === 0) {
    return 0;
  }

  return remainder > 0 ? remainder - sequenceDistancePx : remainder;
}
