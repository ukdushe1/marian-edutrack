import {
  LayoutGrid, BookOpen, ClipboardList, BarChart2, FileText,
  Users, Bell, GraduationCap, Calendar, Shield,
  BookMarked, Layers, ChevronRight,
  Target, UserX, CalendarCheck2, BedDouble, Contact,
} from 'lucide-react';

export const NAV_BY_ROLE = {
  superAdmin: [
    { label: 'Users',    path: '/admin/users',    icon: Users },
    { label: 'Syllabi',  path: '/admin/syllabi',  icon: BookMarked },
    { label: 'Groups',   path: '/admin/groups',   icon: Layers },
    { label: 'Guardians', path: '/admin/guardians', icon: Contact },
    { label: 'Imports',  path: '/admin/imports',  icon: ClipboardList },
  ],
  teacher: [
    { label: 'Today',       path: '/',              icon: LayoutGrid },
    { label: 'Markbook',    path: '/markbook',      icon: BookOpen },
    { label: 'Register',    path: '/register',      icon: ClipboardList },
    { label: 'Analysis',    path: '/analysis',      icon: BarChart2 },
    { label: 'Reports',     path: '/reports',       icon: FileText },
    { label: 'Predictions', path: '/predictions',   icon: Target },
    { label: 'Schemes',     path: '/hod/schemes',   icon: Layers },
    { label: 'Bookings',    path: '/bookings',      icon: CalendarCheck2 },
    { label: 'Notices',     path: '/notices',       icon: Bell },
    { label: 'AI Tools',    path: '/ai',            icon: GraduationCap },
  ],
  tutor: [
    { label: 'Today',     path: '/',              icon: LayoutGrid },
    { label: 'Register',  path: '/register',      icon: ClipboardList },
    { label: 'Reports',   path: '/reports',       icon: FileText },
    { label: 'Conduct',   path: '/conduct',       icon: Shield },
    { label: 'Notices',   path: '/notices',       icon: Bell },
  ],
  hod: [
    { label: 'Today',       path: '/',              icon: LayoutGrid },
    { label: 'Dept Marks',  path: '/hod/marks',    icon: BookOpen },
    { label: 'Schemes',     path: '/hod/schemes',   icon: Layers },
    { label: 'Analysis',    path: '/analysis',      icon: BarChart2 },
    { label: 'Predictions', path: '/predictions',   icon: Target },
    { label: 'Notices',     path: '/notices',       icon: Bell },
  ],
  head: [
    { label: 'Dashboard', path: '/',               icon: LayoutGrid },
    { label: 'Approvals', path: '/head/approve',   icon: FileText },
    { label: 'Analytics', path: '/head/analytics', icon: BarChart2 },
    { label: 'Cover',     path: '/cover',          icon: UserX },
    { label: 'Notices',   path: '/notices',        icon: Bell },
  ],
  boardingMaster: [
    { label: 'Boarding',  path: '/boarding',       icon: BedDouble },
    { label: 'Notices',   path: '/notices',        icon: Bell },
  ],
  examsOfficer: [
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

/** Every staff page, deduplicated by path (dashboard first). */
function allStaffNav() {
  const seen = new Set();
  return ['head', 'superAdmin', 'teacher', 'hod', 'tutor', 'boardingMaster', 'examsOfficer']
    .flatMap((r) => NAV_BY_ROLE[r])
    .filter((l) => (seen.has(l.path) ? false : seen.add(l.path)));
}

/** Super admins see every page; others get their first matching role's nav. */
export function navForRoles(roles = []) {
  if (roles.includes('superAdmin')) return allStaffNav();
  const priority = ['superAdmin', 'head', 'examsOfficer', 'hod', 'boardingMaster', 'tutor', 'teacher', 'parent'];
  for (const r of priority) {
    if (roles.includes(r)) return NAV_BY_ROLE[r];
  }
  return NAV_BY_ROLE.teacher;
}
