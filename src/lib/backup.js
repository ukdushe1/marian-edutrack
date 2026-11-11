/**
 * Full backup / restore of the Firestore database from the browser
 * (the Spark plan has no automatic backups).
 *
 * Backup file: { app, format, createdAt, createdBy, projectId, counts, docs: { [path]: data } }
 * Timestamps are stored as { __type: 'timestamp', seconds, nanoseconds }.
 */
import { collection, doc, getDocs, setDoc, getDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export const BACKUP_FORMAT = 1;

/** Every top-level collection the app uses. */
export const COLLECTIONS = [
  'users', 'terms', 'classes', 'students', 'syllabi', 'teachingGroups', 'registers', 'reports',
  'conduct', 'notices', 'guardians', 'commentBank', 'predictions', 'resources', 'resourceBookings',
  'coverRequests', 'examSessions', 'cambridgeEntries', 'exeats', 'houseRollCall', 'sickBay',
  'gradeBoundaries', 'gradingScales', 'examWindows', 'examPapers', 'examSittings', 'resultSnapshots',
  'settings', 'auditLog', 'messageLog',
];
/** Append-only logs: kept in the backup file, never written back by restore. */
export const APPEND_ONLY = ['auditLog', 'messageLog'];

// ── (de)serialisation ────────────────────────────────────────────────────
export function encode(v) {
  if (v instanceof Timestamp) return { __type: 'timestamp', seconds: v.seconds, nanoseconds: v.nanoseconds };
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)]));
  return v;
}
export function decode(v) {
  if (v && typeof v === 'object' && v.__type === 'timestamp') return new Timestamp(v.seconds, v.nanoseconds);
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x)]));
  return v;
}

/** Collection name of a document path, e.g. teachingGroups/g1/assessments/a1 → 'assessments'. */
export const collectionOf = (path) => path.split('/').at(-2);
export const topOf = (path) => path.split('/')[0];

/** Read everything. onProgress(text). */
export async function createBackup({ uid, projectId, onProgress }) {
  const docs = {};
  const counts = {};
  for (const name of COLLECTIONS) {
    onProgress?.(`Reading ${name}…`);
    const snap = await getDocs(collection(db, name)).catch(() => null); // a collection you can't read is skipped
    if (!snap) { counts[name] = 'not readable'; continue; }
    snap.forEach((d) => { docs[`${name}/${d.id}`] = encode(d.data()); });
    counts[name] = snap.size;
  }
  // Sub-collections of classes (teaching groups): assessments → marks, scheme entries
  const groupIds = Object.keys(docs).filter((p) => p.startsWith('teachingGroups/')).map((p) => p.split('/')[1]);
  let a = 0, m = 0, sch = 0;
  for (const [i, g] of groupIds.entries()) {
    onProgress?.(`Reading marks for class ${i + 1} of ${groupIds.length}…`);
    const [as, ss] = await Promise.all([
      getDocs(collection(db, 'teachingGroups', g, 'assessments')),
      getDocs(collection(db, 'teachingGroups', g, 'schemeEntries')),
    ]);
    ss.forEach((d) => { docs[`teachingGroups/${g}/schemeEntries/${d.id}`] = encode(d.data()); sch++; });
    await Promise.all(as.docs.map(async (ad) => {
      docs[`teachingGroups/${g}/assessments/${ad.id}`] = encode(ad.data()); a++;
      const ms = await getDocs(collection(db, 'teachingGroups', g, 'assessments', ad.id, 'marks'));
      ms.forEach((md) => { docs[`teachingGroups/${g}/assessments/${ad.id}/marks/${md.id}`] = encode(md.data()); m++; });
    }));
  }
  counts['assessments'] = a; counts['marks'] = m; counts['schemeEntries'] = sch;
  return {
    app: 'marian-edutrack', format: BACKUP_FORMAT, createdAt: new Date().toISOString(), createdBy: uid,
    projectId, counts, docs,
  };
}

/** Save the backup as a file and record when it was taken. */
export async function downloadBackup(backup, uid) {
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `edutrack-backup-${backup.createdAt.slice(0, 16).replace(':', '')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  const total = Object.keys(backup.docs).length;
  await setDoc(doc(db, 'settings', 'backup'), { lastBackupAt: serverTimestamp(), by: uid, documents: total });
  return total;
}

/** Check an uploaded file and summarise it. Throws with a readable message. */
export function readBackup(text) {
  let b;
  try { b = JSON.parse(text); } catch { throw new Error('This is not a backup file (not valid JSON).'); }
  if (b?.app !== 'marian-edutrack' || !b.docs) throw new Error('This file is not an EduTrack backup.');
  if (b.format > BACKUP_FORMAT) throw new Error('This backup was made by a newer version of EduTrack.');
  const byGroup = {};
  for (const p of Object.keys(b.docs)) {
    const key = p.includes('/marks/') ? 'marks' : p.includes('/assessments/') ? 'assessments'
      : p.includes('/schemeEntries/') ? 'schemeEntries' : topOf(p);
    byGroup[key] = (byGroup[key] ?? 0) + 1;
  }
  return { backup: b, byGroup };
}

/**
 * Restore the chosen groups. mode 'overwrite' replaces each document with the backup's copy;
 * 'missing' only re-creates documents that no longer exist. Documents created after the
 * backup are never deleted. Returns { written, skipped, errors }.
 */
export async function restoreBackup(backup, groups, mode, onProgress) {
  const keyOf = (p) => (p.includes('/marks/') ? 'marks' : p.includes('/assessments/') ? 'assessments'
    : p.includes('/schemeEntries/') ? 'schemeEntries' : topOf(p));
  // Parents before children so rule look-ups find them
  const paths = Object.keys(backup.docs)
    .filter((p) => groups.includes(keyOf(p)) && !APPEND_ONLY.includes(topOf(p)))
    .sort((x, y) => x.split('/').length - y.split('/').length);
  let written = 0, skipped = 0, done = 0;
  const errors = [];
  let next = 0;
  async function worker() {
    while (next < paths.length) {
      const p = paths[next++];
      try {
        const ref = doc(db, p);
        if (mode === 'missing' && (await getDoc(ref)).exists()) skipped++;
        else { await setDoc(ref, decode(backup.docs[p])); written++; }
      } catch (e) { errors.push(`${p}: ${e.code ?? e.message}`); }
      onProgress?.(++done, paths.length);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  return { written, skipped, errors };
}
