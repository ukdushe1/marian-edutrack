/**
 * Roles — one place for names, labels, legacy aliases and implied powers.
 *
 * Stored role values (users/{uid}.roles):
 *   superAdmin, principal, vicePrincipal, hod, teacher, classTeacher,
 *   examsOfficer, boardingMaster, parent
 *
 * Legacy values written before the 2026-11 review are still accepted and
 * mapped on read, so no data migration is required:
 *   head  → vicePrincipal   (old "Head / Deputy": approvals, not admin)
 *   tutor → classTeacher    (old "Form Tutor")
 * firestore.rules accepts the same aliases.
 */

export const ROLES = [
  { key: 'principal',      label: 'Principal',          help: 'Full administrator rights, including users and roles' },
  { key: 'superAdmin',     label: 'System Admin',       help: 'ICT administrator — full rights' },
  { key: 'vicePrincipal',  label: 'Vice Principal',     help: 'Approves and publishes reports, cover, notices' },
  { key: 'hod',            label: 'HOD',                help: 'Head of Department — manages their subjects’ syllabi, locks marks' },
  { key: 'teacher',        label: 'Subject Teacher',    help: 'Marks, registers and subject comments for their classes' },
  { key: 'classTeacher',   label: 'Class Teacher',      help: 'Roll call, conduct and class-teacher comments' },
  { key: 'examsOfficer',   label: 'Exams Officer',      help: 'Exam timetable and Cambridge entries' },
  { key: 'boardingMaster', label: 'Boarding Master',    help: 'Exeats, roll call, sick bay' },
  { key: 'parent',         label: 'Parent / Guardian',  help: 'Published reports (portal coming)' },
];

export const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.key, r.label]));

const LEGACY = { head: 'vicePrincipal', tutor: 'classTeacher' };

/** Powers a role carries on top of its own name. */
const IMPLIES = {
  principal: ['superAdmin', 'vicePrincipal'],
};

/** Map legacy names to current ones and drop duplicates (stored values). */
export function normaliseRoles(roles = []) {
  return [...new Set((roles ?? []).map((r) => LEGACY[r] ?? r))];
}

/** Stored roles plus every role they imply — what permission checks use. */
export function effectiveRoles(roles = []) {
  const base = normaliseRoles(roles);
  return [...new Set(base.flatMap((r) => [r, ...(IMPLIES[r] ?? [])]))];
}

export const roleLabel = (key) => ROLE_LABEL[LEGACY[key] ?? key] ?? key;

/** The most senior label, for showing under a user's name. */
export function primaryRoleLabel(roles = []) {
  const base = normaliseRoles(roles);
  const first = ROLES.find((r) => base.includes(r.key));
  return first ? first.label : 'No role yet';
}

/** Staff who can teach or cover lessons (cover lists, invigilators). */
export const TEACHING_ROLES = ['teacher', 'classTeacher', 'hod', 'vicePrincipal', 'principal', 'tutor', 'head'];
