import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firestoreMock, store, Timestamp } from './firebaseMock';
vi.mock('firebase/firestore', () => firestoreMock());
vi.mock('../src/firebase/config', () => ({ db: {}, default: {} }));
const b = await import('../src/lib/backup');

const file = { app: 'marian-edutrack', format: 1, createdAt: '2026-11-11T10:00:00Z', docs: {
  'students/s1': { surname: 'A' }, 'students/s2': { surname: 'B' }, 'users/u1': { roles: ['teacher'] },
  'teachingGroups/g1': { name: 'X' }, 'teachingGroups/g1/assessments/a1': { maxMark: 10 },
  'teachingGroups/g1/assessments/a1/marks/entries': { entries: { s1: { raw: 7 } } },
  'auditLog/x': { who: 'u1' }, 'teachingGroups/g1/schemeEntries/e1': { topic: 'T' } } };

beforeEach(() => { store.writes.length = 0; store.existing = new Set(['students/s1']); });

describe('backup', () => {
  it('round-trips timestamps through JSON', () => {
    const ts = new Timestamp(1700000000, 5);
    const dec = b.decode(JSON.parse(JSON.stringify(b.encode({ a: ts, list: [ts, 1], n: { t: ts } }))));
    expect(dec.a).toBeInstanceOf(Timestamp);
    expect(dec.n.t.seconds).toBe(1700000000);
    expect(dec.list[1]).toBe(1);
  });
  it('reads and groups a backup file', () => {
    const { byGroup } = b.readBackup(JSON.stringify(file));
    expect(byGroup).toMatchObject({ students: 2, marks: 1, assessments: 1, schemeEntries: 1, teachingGroups: 1 });
  });
  it('rejects other files', () => {
    expect(() => b.readBackup('nope')).toThrow(/not valid JSON/);
    expect(() => b.readBackup('{"x":1}')).toThrow(/not an EduTrack backup/);
    expect(() => b.readBackup(JSON.stringify({ ...file, format: 99 }))).toThrow(/newer version/);
  });
  it("'missing' mode only re-creates deleted records and never writes logs", async () => {
    const r = await b.restoreBackup(file, ['students', 'teachingGroups', 'assessments', 'marks', 'auditLog'], 'missing');
    const paths = store.writes.map(([p]) => p);
    expect(paths).not.toContain('students/s1');
    expect(paths).toContain('students/s2');
    expect(paths).not.toContain('auditLog/x');
    expect(r.skipped).toBe(1);
    expect(paths.indexOf('teachingGroups/g1')).toBeLessThan(paths.indexOf('teachingGroups/g1/assessments/a1/marks/entries'));
  });
  it("'overwrite' rewrites existing records", async () => {
    const r = await b.restoreBackup(file, ['students'], 'overwrite');
    expect(r.written).toBe(2);
  });
});
