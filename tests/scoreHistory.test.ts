import { describe, it, expect } from 'vitest';
import {
  todayBucket,
  bucketToIso,
  isoToBucket,
} from '../src/lib/scoreHistory.js';

describe('scoreHistory helpers (pure)', () => {
  it('todayBucket returns YYYYMMDD in UTC', () => {
    const bucket = todayBucket(new Date('2026-07-20T13:37:00Z'));
    expect(bucket).toBe('20260720');
    expect(bucket).toMatch(/^\d{8}$/);
  });

  it('bucketToIso converts YYYYMMDD → YYYY-MM-DD', () => {
    expect(bucketToIso('20260720')).toBe('2026-07-20');
  });

  it('isoToBucket converts ISO date → YYYYMMDD', () => {
    expect(isoToBucket('2026-07-20')).toBe('20260720');
    expect(isoToBucket('2026-07-20T00:00:00Z')).toBe('20260720');
    expect(isoToBucket('2026-07-20T23:59:59.999Z')).toBe('20260720');
  });

  it('roundtrips via bucketToIso ↔ isoToBucket', () => {
    for (const b of ['20260101', '20261231', '20240229']) {
      expect(isoToBucket(bucketToIso(b))).toBe(b);
    }
  });

  it('bucketToIso on malformed input returns a best-effort string', () => {
    // We don't validate length; the helper just slices. 5-char input gives
    // "2026-0-" which is ugly but deterministic and not a runtime exception.
    expect(bucketToIso('20260')).toBe('2026-0-');
  });
});