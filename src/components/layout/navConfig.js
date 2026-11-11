import {
  LayoutGrid, BookOpen, ClipboardList, BarChart2, FileText,
  Users, Bell, GraduationCap, Calendar, Shield,
  BookMarked, Layers, ChevronRight,
  Target, UserX, CalendarCheck2, BedDouble, Contact, MessageSquareText, ScrollText, ClipboardCheck, ListTodo, DatabaseBackup,
} from 'lucide-react';

// Keys are stored role names (see src/lib/roles.js). Legacy "head"/"tutor"
// are mapped to vicePrincipal/classTeacher before this is used.
export const NAV_BY_ROLE = {
  superAdmin: [
    { label: 'Users',        path: '/admin/users',     icon: Users },
    { label: 'Syllabi',      path: '/admin/syllabi',   icon: BookMarked },
    { label: 'Classes',      path: '/admin/groups',    icon: Layers },
    { label: 'Guardians',    path: '/admin/guardians', icon: Contact },
    { label: 'Comment bank', path: '/admin/comments',  icon: MessageSquareText },
    { label: 'Imports',      path: '/admin/imports',   icon: ClipboardList },
    { label: 'Audit log',    path: '/admin/audit',     icon: ScrollText },
    { label: 'Backup',       path: '/admin/backup',    icon: DatabaseBackup },
  ],
  teacher: [
    { label: 'Today',       path: '/',              icon: LayoutGrid },
    { label: 'Markbook',    path: '/markbook',      icon: BookOpen },
    { label: 'Exam tasks',  path: '/exam-tasks',    icon: ListTodo },
    { label: 'Register',    path: '/register',      icon: ClipboardList },
    { label: 'Analysis',    path: '/analysis',      icon: BarChart2 },
    { label: 'Reports',     path: '/reports',       icon: FileText },
    { label: 'Predictions', path: '/predictions',   icon: Target },
    { label: 'Schemes',     path: '/hod/schemes',   icon: Layers },
    { label: 'Syllabi',     path: '/admin/syllabi', icon: BookMarked },   // read-only for teachers
    { label: 'Bookings',    path: '/bookings',      icon: CalendarCheck2 },
    { label: 'Notices',     path: '/notices',       icon: Bell },
    { label: 'AI Tools',    path: '/ai',            icon: GraduationCap },
  ],
  classTeacher: [
    { label: 'Today',     path: '/',              icon: LayoutGrid },
    { label: 'Register',  path: '/register',      icon: ClipboardList },
    { label: 'Reports',   path: '/reports',       icon: FileText },
    { label: 'Conduct',   path: '/conduct',       icon: Shield },
    { label: 'Notices',   path: '/notices',       icon: Bell },
  ],
  hod: [
    { label: 'Today',        path: '/',               icon: LayoutGrid },
    { label: 'Dept Marks',   path: '/hod/marks',      icon: BookOpen },
    { label: 'End of term',  path: '/exams/term',     icon: ClipboardCheck },
    { label: 'Syllabi',      path: '/admin/syllabi',  icon: BookMarked },
    { label: 'Comment bank', path: '/admin/comments', icon: MessageSquareText },
    { label: 'Schemes',      path: '/hod/schemes',    icon: Layers },
    { label: 'Analysis',     path: '/analysis',       icon: BarChart2 },
    { label: 'Predictions',  path: '/predictions',    icon: Target },
    { label: 'Notices',      path: '/notices',        icon: Bell },
  ],
  vicePrincipal: [
    { label: 'Dashboard',    path: '/',               icon: LayoutGrid },
    { label: 'Approvals',    path: '/head/approve',   icon: FileText },
    { label: 'End of term',  path: '/exams/term',     icon: ClipboardCheck },
    { label: 'Analytics',    path: '/head/analytics', icon: BarChart2 },
    { label: 'Cover',        path: '/cover',          icon: UserX },
    { label: 'Comment bank', path: '/admin/comments', icon: MessageSquareText },
    { label: 'Notices',      path: '/notices',        icon: Bell },
  ],
  boardingMaster: [
    { label: 'Boarding',  path: '/boarding',       icon: BedDouble },
    { label: 'Notices',   path: '/notices',        icon: Bell },
  ],
  examsOfficer: [
    { label: 'End of term', path: '/exams/term',      icon: ClipboardCheck },
    { label: 'Timetable',  path: '/exams/timetable',  icon: Calendar },
    { label: 'Seating',    path: '/exams/seating',    icon: Layers },
    { label: 'Entries',    path: '/exams/entries',    icon: GraduationCap },
    { label: 'Boundaries', path: '/exams/boundaries', icon: ChevronRight },
  ],
  parent: [
    { label: 'Reports',  path: '/parent/reports',  icon: FileText },
    { label: 'Notices',  path: '/parent/notices',  icon: Bell },
  ],
};

// Most senior first; a person with several roles gets the union of their menus.
const ORDER = ['vicePrincipal', 'superAdmin', 'hod', 'teacher', 'classTeacher', 'examsOfficer', 'boardingMaster', 'parent'];

function merge(keys) {
  const seen = new Set();
  return keys.flatMap((r) => NAV_BY_ROLE[r] ?? [])
    .filter((l) => (seen.has(l.path) ? false : seen.add(l.path)));
}

/**
 * `roles` = effective roles (AuthContext). The Principal and System Admin see
 * every page; others see the combined menus of the roles they hold.
 */
export function navForRoles(roles = []) {
  if (roles.includes('superAdmin')) return merge(ORDER.filter((r) => r !== 'parent'));
  const held = ORDER.filter((r) => roles.includes(r));
  return held.length ? merge(held) : [{ label: 'Today', path: '/', icon: LayoutGrid }];
}
