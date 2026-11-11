/** Shared stand-ins for the Firebase SDK so pure logic can be tested without a backend. */
import { vi } from 'vitest';

export class Timestamp {
  constructor(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  static now() { return new Timestamp(1700000000, 0); }
  static fromDate(d) { return new Timestamp(Math.floor(d.getTime() / 1000), 0); }
}

export const store = { writes: [], existing: new Set() };

export const firestoreMock = () => ({
  Timestamp,
  serverTimestamp: () => 'SERVER_TS',
  doc: (_db, ...path) => path.join('/'),
  collection: (_db, ...path) => path.join('/'),
  query: (...a) => a, where: (...a) => a, orderBy: (...a) => a, limit: (...a) => a,
  getDocs: vi.fn(async () => ({ docs: [], size: 0, forEach() {} })),
  getDoc: vi.fn(async (p) => ({ exists: () => store.existing.has(p), data: () => ({}) })),
  setDoc: vi.fn(async (p, d) => { store.writes.push([p, d]); }),
  updateDoc: vi.fn(async () => {}), deleteDoc: vi.fn(async () => {}), addDoc: vi.fn(async () => ({ id: 'new' })),
  onSnapshot: vi.fn(() => () => {}), writeBatch: vi.fn(() => ({ set() {}, commit: async () => {} })),
  increment: (n) => n, arrayUnion: (...a) => a,
});
