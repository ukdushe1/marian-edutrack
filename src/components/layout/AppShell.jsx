import { Suspense, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Moon, Sun, WifiOff, Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { logout } from '../../firebase/auth';
import { navForRoles } from './navConfig';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import clsx from 'clsx';
import { primaryRoleLabel } from '../../lib/roles';

// Menu sections (only shown as headings when the menu is long)
const SECTIONS = [
  ['Teaching',   ['/markbook', '/exam-tasks', '/register', '/reports', '/analysis', '/predictions', '/hod/marks', '/hod/schemes', '/bookings', '/ai']],
  ['Pastoral',   ['/conduct', '/boarding']],
  ['Exams',      ['/exams/term', '/exams/timetable', '/exams/entries', '/exams/boundaries']],
  ['Leadership', ['/head/approve', '/head/analytics', '/cover']],
  ['School',     ['/notices', '/admin/syllabi', '/admin/comments']],
  ['Admin',      ['/admin/users', '/admin/groups', '/admin/guardians', '/admin/imports', '/admin/audit', '/admin/backup']],
];

function groupLinks(links) {
  if (links.length <= 10) return [[null, links]];
  const home = links.filter((l) => l.path === '/');
  const used = new Set(home.map((l) => l.path));
  const groups = SECTIONS.map(([title, paths]) => {
    const items = paths.map((p) => links.find((l) => l.path === p)).filter(Boolean);
    items.forEach((l) => used.add(l.path));
    return [title, items];
  }).filter(([, items]) => items.length);
  const rest = links.filter((l) => !used.has(l.path));
  return [[null, home], ...groups, ...(rest.length ? [['More', rest]] : [])];
}

function NavList({ links, onNavigate, large }) {
  return groupLinks(links).map(([title, items]) => (
    <div key={title ?? 'home'} className="space-y-0.5">
      {title && <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>}
      {items.map(({ label, path, icon: Icon }) => (
        <NavLink
          key={path} to={path} end={path === '/'} onClick={onNavigate}
          className={({ isActive }) =>
            clsx('flex items-center gap-3 px-3 rounded-lg font-medium transition-colors',
              large ? 'py-2.5 text-[15px]' : 'py-2 text-sm',
              isActive
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-700 dark:hover:text-white')
          }
        >
          <Icon size={large ? 18 : 16} className="shrink-0" />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </div>
  ));
}

export default function AppShell() {
  const { profile, roles } = useAuth();
  const { dark, toggle }   = useTheme();
  const online             = useOnlineStatus();
  const nav                = useNavigate();
  const location           = useLocation();
  const links              = navForRoles(roles);
  const isAdmin            = roles.includes('superAdmin');
  const [backupAge, setBackupAge] = useState(null); // days since last backup; Infinity = never
  const [menuOpen, setMenuOpen]   = useState(false);

  // Admins: remind when no backup in 7 days (the free plan has no automatic backups)
  useEffect(() => {
    if (!isAdmin) return undefined;
    return onSnapshot(doc(db, 'settings', 'backup'), (d) => {
      const t = d.exists() ? d.data().lastBackupAt?.toDate?.() : null;
      setBackupAge(t ? Math.floor((Date.now() - t.getTime()) / 864e5) : Infinity);
    }, () => {});
  }, [isAdmin]);

  // Close the mobile menu on navigation, and with Escape; stop the page scrolling behind it
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [menuOpen]);

  const initials = profile
    ? (profile.name ?? 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const roleLabel = primaryRoleLabel(profile?.roles ?? roles);

  async function handleLogout() {
    await logout();
    nav('/login');
  }

  const brand = (small) => (
    <div className="flex items-center gap-2.5 min-w-0">
      <img src="/crest.png" alt="Marian High School crest" className={clsx('w-auto shrink-0', small ? 'h-8' : 'h-10')} />
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate text-ink dark:text-white">Marian <span className="text-brand-600 dark:text-brand-400">EduTrack</span></p>
        {!small && <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">Seize the moment</p>}
      </div>
    </div>
  );

  const userBlock = (large) => (
    <div className="space-y-1">
      <div className="flex items-center gap-2.5 px-2 py-1">
        <div className={clsx('rounded-full bg-brand-600 text-white flex items-center justify-center font-bold shrink-0', large ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs')}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className={clsx('font-medium truncate', large ? 'text-sm' : 'text-xs')}>{profile?.name ?? 'User'}</p>
          <p className="text-xs text-slate-400 truncate">{roleLabel}</p>
        </div>
      </div>
      <div className="flex gap-1">
        <button onClick={toggle} aria-label={dark ? 'Light mode' : 'Dark mode'}
          className={clsx('flex-1 flex items-center justify-center gap-2 rounded-lg hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-700 dark:hover:text-white text-slate-500', large ? 'py-2.5 text-sm' : 'p-1.5')}>
          {dark ? <Sun size={large ? 16 : 14} /> : <Moon size={large ? 16 : 14} />}{large && (dark ? 'Light mode' : 'Dark mode')}
        </button>
        {!online && <WifiOff size={14} className="text-amber-500 self-center mx-1" aria-label="Offline" />}
        <button onClick={handleLogout} aria-label="Sign out"
          className={clsx('flex-1 flex items-center justify-center gap-2 rounded-lg hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-700 dark:hover:text-white text-slate-500', large ? 'py-2.5 text-sm' : 'p-1.5')}>
          <LogOut size={large ? 16 : 14} />{large && 'Sign out'}
        </button>
      </div>
    </div>
  );

  // Bottom bar: the first four pages + Menu
  const tabs = links.slice(0, 4);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-[inset_-3px_0_0_theme(colors.brand.600)]">
        <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-700">{brand(false)}</div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1" aria-label="Main menu">
          <NavList links={links} />
        </nav>
        <div className="p-3 border-t border-slate-200 dark:border-slate-700">{userBlock(false)}</div>
      </aside>

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar — mobile */}
        <header className="md:hidden flex items-center justify-between gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 print:hidden">
          {brand(true)}
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}
            className="p-2 -mr-1 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
            <Menu size={22} />
          </button>
        </header>

        {!online && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-xs text-center py-1 px-4 flex items-center justify-center gap-1.5">
            <WifiOff size={12} />
            Offline — changes will sync when connected
          </div>
        )}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
          {isAdmin && backupAge != null && backupAge >= 7 && (
            <div className="mb-4 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-2 print:hidden">
              {backupAge === Infinity ? 'No backup has been taken yet.' : `Last backup was ${backupAge} days ago.`}
              <NavLink to="/admin/backup" className="font-semibold underline">Download a backup</NavLink>
            </div>
          )}
          {profile && roles.length === 0 && (
            <div className="mb-4 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-xl px-4 py-3">
              Your account is set up but has no role yet. Ask the Principal to assign your role under <strong>Users</strong>.
            </div>
          )}
          <Suspense fallback={<div className="flex justify-center py-16"><div className="w-6 h-6 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" /></div>}>
            <Outlet />
          </Suspense>
        </main>

        {/* Bottom tab bar — mobile */}
        <nav className="md:hidden flex border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pb-[env(safe-area-inset-bottom,0px)] print:hidden" aria-label="Quick links">
          {tabs.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path} to={path} end={path === '/'}
              className={({ isActive }) =>
                clsx('flex-1 min-w-0 flex flex-col items-center pt-2 pb-1.5 gap-0.5 text-[11px] font-medium transition-colors',
                  isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400')
              }
            >
              <Icon size={20} />
              <span className="truncate max-w-full px-1">{label}</span>
            </NavLink>
          ))}
          <button onClick={() => setMenuOpen(true)} aria-label="All pages"
            className={clsx('flex-1 min-w-0 flex flex-col items-center pt-2 pb-1.5 gap-0.5 text-[11px] font-medium',
              menuOpen ? 'text-brand-600' : 'text-slate-500 dark:text-slate-400')}>
            <Menu size={20} />
            <span>Menu</span>
          </button>
        </nav>
      </div>

      {/* Slide-out menu — mobile: every page, scrollable, plus account */}
      <div className={clsx('md:hidden fixed inset-0 z-50 print:hidden', menuOpen ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!menuOpen}>
        <div onClick={() => setMenuOpen(false)}
          className={clsx('absolute inset-0 bg-black/40 transition-opacity', menuOpen ? 'opacity-100' : 'opacity-0')} />
        <div role="dialog" aria-label="Menu"
          className={clsx('absolute inset-y-0 left-0 w-[86%] max-w-xs flex flex-col bg-white dark:bg-slate-800 shadow-xl transition-transform duration-200',
            menuOpen ? 'translate-x-0' : '-translate-x-full')}>
          <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] border-b border-slate-200 dark:border-slate-700">
            {brand(true)}
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="p-2 -mr-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><X size={20} /></button>
          </div>
          <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-2 space-y-1">
            <NavList links={links} large onNavigate={() => setMenuOpen(false)} />
          </nav>
          <div className="p-3 border-t border-slate-200 dark:border-slate-700 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
            {userBlock(true)}
          </div>
        </div>
      </div>
    </div>
  );
}
