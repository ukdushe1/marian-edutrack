/**
 * End of Year Examinations 2026 — transcribed from the printed timetable
 * (Mon 16 – Fri 20 Nov 2026). Imported into examSessions from the Exam
 * Timetable page. Session start times were chosen by the school:
 * Morning 08:00 · Mid-morning 11:00 · Afternoon 14:00.
 *
 * Where one cell lists alternatives ("F5 Bio / History P1") each is its own
 * session at the same time with the same invigilators. Durations the sheet
 * leaves out are null ("TBC" on the page).
 */
export const TIMETABLE_ID = 'eoy2026';
export const TIMETABLE_NAME = 'End of Year Examinations 2026';

export const SLOTS = {
  M:  { label: 'Morning',     start: '08:00' },
  MM: { label: 'Mid-morning', start: '11:00' },
  A:  { label: 'Afternoon',   start: '14:00' },
};

// [date, slot, form, subject, paper, minutes, invigilators]
const ROWS = [
  // ── Monday 16/11/26 ─────────────────────────────────────────────
  ['2026-11-16', 'M',  'F1',  'Accounts',          '',        90,  ['Zishura', 'Nare']],
  ['2026-11-16', 'M',  'F2',  'English',           '',        120, ['Mavhunga', 'Chinez']],
  ['2026-11-16', 'M',  'F3',  'Maths',             '',        120, ['Chidagudo', 'Chuvele', 'Shoko']],
  ['2026-11-16', 'M',  'F5',  'Biology',           '',        120, ['Chidagudo', 'Chuvele', 'Shoko']],
  ['2026-11-16', 'M',  'F5',  'History',           'P1',      90,  ['Chidagudo', 'Chuvele', 'Shoko']],
  ['2026-11-16', 'MM', 'F1',  'Geography',         '',        90,  ['Mudari', 'Chizuvane']],
  ['2026-11-16', 'MM', 'F2',  'Biology',           '',        90,  ['Muzama', 'Mapundu']],
  ['2026-11-16', 'MM', 'F3',  'Business Studies',  '',        90,  ['Nhundu', 'Chamboko', 'Ushe']],
  ['2026-11-16', 'MM', 'F5',  'Accounts',          'P2',      105, ['Nhundu', 'Chamboko', 'Ushe']],
  ['2026-11-16', 'MM', 'F5',  'Chemistry',         '',        120, ['Nhundu', 'Chamboko', 'Ushe']],
  ['2026-11-16', 'A',  'F1E', 'PE',                '',        90,  ['Mapundu']],
  ['2026-11-16', 'A',  'F3E', 'Agriculture',       '',        90,  ['Nehoma', 'Mavhunga']],
  ['2026-11-16', 'A',  'F3E', 'Literature',        '',        90,  ['Nehoma', 'Mavhunga']],
  ['2026-11-16', 'A',  'F5',  'Geography',         'P1',      null, ['Nehoma', 'Mavhunga']],

  // ── Tuesday 17/11/26 ────────────────────────────────────────────
  ['2026-11-17', 'M',  'F1',  'Business Studies',  '',        90,  ['Ushe', 'Kwangwari']],
  ['2026-11-17', 'M',  'F2',  'Physics',           '',        90,  ['Marufu', 'Watadza']],
  ['2026-11-17', 'M',  'F3',  'English',           '',        90,  ['Magrika', 'Makohliso', 'Chidagudo']],
  ['2026-11-17', 'M',  'F5',  'Business Studies',  'P2',      90,  ['Magrika', 'Makohliso', 'Chidagudo']],
  ['2026-11-17', 'M',  'F5',  'Literature',        'P2',      120, ['Magrika', 'Makohliso', 'Chidagudo']],
  ['2026-11-17', 'M',  'F5',  'Physics',           'P4',      120, ['Magrika', 'Makohliso', 'Chidagudo']],
  ['2026-11-17', 'MM', 'F1',  'History',           '',        75,  ['Moyo', 'Mapundu']],
  ['2026-11-17', 'MM', 'F2',  'Geography',         '',        90,  ['Muzama', 'Nkomo']],
  ['2026-11-17', 'MM', 'F3',  'PE',                '',        90,  ['Chamboko', 'Nhundu']],
  ['2026-11-17', 'MM', 'F5',  'Geography',         'P2',      90,  ['Chamboko', 'Nhundu']],
  ['2026-11-17', 'A',  'F2',  'Chemistry',         '',        90,  ['Ushe', 'Kwangwari']],
  ['2026-11-17', 'A',  'F3D1','Economics',         '',        90,  ['Chuvele']],
  ['2026-11-17', 'A',  'F5',  'Maths',             'Stats 1 (P5)', 90, ['Makohliso']],

  // ── Wednesday 18/11/26 ──────────────────────────────────────────
  ['2026-11-18', 'M',  'F1',  'Maths',             '',        90,  ['Chidagudo', 'Chuvele']],
  ['2026-11-18', 'M',  'F2',  'Computer Science',  '',        90,  ['Mudari', 'Shoko']],
  ['2026-11-18', 'M',  'F3',  'Physics / Combined Science', '', 90, ['Magrika', 'Nehoma', 'Makohliso']],
  ['2026-11-18', 'M',  'F5',  'Maths',             'Pure P1', 120, ['Magrika', 'Makohliso', 'Nehoma']],
  ['2026-11-18', 'M',  'F5',  'Biblical Studies',  '',        90,  ['Magrika', 'Makohliso', 'Nehoma']],
  ['2026-11-18', 'MM', 'F1',  'Chemistry',         '',        75,  ['Nkomo', 'Magrika']],
  ['2026-11-18', 'MM', 'F2',  'History',           '',        90,  ['Moyo', 'Watadza']],
  ['2026-11-18', 'MM', 'F3',  'Geography',         '',        105, ['Marufu', 'Zishura', 'Mapundu']],
  ['2026-11-18', 'MM', 'F5',  'Literature',        'P4',      120, ['Marufu', 'Zishura', 'Mapundu']],
  ['2026-11-18', 'MM', 'F5',  'Economics',         'P2',      120, ['Marufu', 'Zishura', 'Mapundu']],
  ['2026-11-18', 'A',  'F2D', 'Economics',         '',        90,  ['Makohliso', 'Ushe']],
  ['2026-11-18', 'A',  'F2E', 'Agriculture',       '',        null, ['Makohliso', 'Ushe']],
  ['2026-11-18', 'A',  'F3',  'Accounts',          'P1',      90,  ['Makohliso', 'Nehoma', 'Magrika']],
  ['2026-11-18', 'A',  'F5',  'Accounts',          '',        75,  ['Makohliso', 'Nehoma', 'Magrika']],

  // ── Thursday 19/11/26 ───────────────────────────────────────────
  ['2026-11-19', 'M',  'F1',  'Biology',           '',        90,  ['Chizuvane', 'Shoko']],
  ['2026-11-19', 'M',  'F2E', 'PE',                '',        90,  ['Chamboko', 'Kwangwari']],
  ['2026-11-19', 'M',  'F3',  'Chemistry',         '',        90,  ['Chinez', 'Mavhunga']],
  ['2026-11-19', 'M',  'F5',  'Computer Science',  'Theory',  90,  ['Mavhunga', 'Chinez']],
  ['2026-11-19', 'MM', 'F1',  'Physics',           '',        75,  ['Nhundu', 'Zishura']],
  ['2026-11-19', 'MM', 'F2',  'Business Studies',  '',        90,  ['Chuvele', 'Nare']],
  ['2026-11-19', 'MM', 'F3',  'Computer Science / ICT', '',   90,  ['Magrika', 'Makohliso']],
  ['2026-11-19', 'MM', 'F5',  'Maths',             'P4', 90, ['Magrika', 'Makohliso']],
  ['2026-11-19', 'MM', 'F5',  'History',           'P3',      120, ['Magrika', 'Makohliso']],
  ['2026-11-19', 'A',  'F3',  'Biology',           '',        90,  ['Chinez', 'Mavhunga']],
  ['2026-11-19', 'A',  'F5',  'Economics',         'P1',      60,  ['Chinez', 'Mavhunga']],

  // ── Friday 20/11/26 ─────────────────────────────────────────────
  ['2026-11-20', 'M',  'F1',  'English',           '',        90,  ['Mapundu', 'Moyo']],
  ['2026-11-20', 'M',  'F2',  'Maths',             '',        120, ['Shoko', 'Nkomo']],
  ['2026-11-20', 'M',  'F3',  'History',           '',        120, ['Nare', 'Chamboko']],
  ['2026-11-20', 'M',  'F5',  'Computer Science',  'Practical', 120, ['Nare', 'Chamboko']],
  ['2026-11-20', 'MM', 'F1',  'Computer Science',  '',        90,  ['Chidagudo', 'Marufu']],
  ['2026-11-20', 'MM', 'F2',  'Accounts',          '',        105, ['Watadza', 'Mudari']],
  ['2026-11-20', 'MM', 'F3',  'Accounts',          'P2',      105, ['Chinez', 'Nhundu']],
  ['2026-11-20', 'MM', 'F5',  'Maths',             'Stats 2 (P6)', 90, ['Chinez', 'Nhundu']],
  ['2026-11-20', 'MM', 'F5',  'History',           'P4',      90,  ['Chinez', 'Nhundu']],
  ['2026-11-20', 'A',  'F1E', 'Agriculture',       '',        75,  ['Muzama']],
  ['2026-11-20', 'A',  'F1D', 'Economics',         '',        90,  ['Kwangwari']],
  ['2026-11-20', 'A',  'F5',  'Business Studies',  'P1',      75,  ['Chizuvane']],
  ['2026-11-20', 'A',  'F5',  'Physics',           'P2',      90,  ['Chizuvane']],
];

/** examSessions documents, keyed by a stable id so a re-import overwrites instead of duplicating. */
export const SESSIONS = ROWS.map(([date, slot, form, subject, paper, duration, invigilatorNames], i) => ({
  id: `${TIMETABLE_ID}-${String(i + 1).padStart(3, '0')}`,
  timetableId: TIMETABLE_ID,
  date,
  slot: SLOTS[slot].label,
  start: SLOTS[slot].start,
  form,
  subject,
  paper,
  duration,
  invigilatorNames,
  syllabusId: '',
  invigilatorIds: [],
}));
