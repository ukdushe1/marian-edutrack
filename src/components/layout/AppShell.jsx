import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun, WifiOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { logout } from '../../firebase/auth';
import { navForRoles } from './navConfig';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import clsx from 'clsx';

export default function AppShell() {
  const { profile, roles } = useAuth();
  const { dark, toggle }   = useTheme();
  const online             = useOnlineStatus();
  const nav                = useNavigate();
  const links              = navForRoles(roles);

  const initials = profile
    ? (profile.name ?? 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  async function handleLogout() {
    await logout();
    nav('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Sidebar — hidden on mobile */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-[inset_-3px_0_0_theme(colors.brand.600)]">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-200 dark:border-slate-700">
          <img src="/crest.png" alt="Marian High School crest" className="h-10 w-auto shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-ink dark:text-white">Marian <span className="text-brand-600 dark:text-brand-400">EduTrack</span></p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">Seize the moment</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {links.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path} to={path} end={path === '/'}
              className={({ isActive }) =>
                clsx('flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-700 dark:hover:text-white')
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 space-y-1">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{profile?.name ?? 'User'}</p>
              <p className="text-xs text-slate-400 truncate">{roles[0] ?? ''}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={toggle} className="flex-1 flex items-center justify-center p-1.5 rounded-lg hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-700 dark:hover:text-white text-slate-500">
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            {!online && <WifiOff size={14} className="text-amber-500 self-center mx-1" />}
            <button onClick={handleLogout} className="flex-1 flex items-center justify-center p-1.5 rounded-lg hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-700 dark:hover:text-white text-slate-500">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Offline banner */}
        {!online && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-xs text-center py-1 px-4 flex items-center justify-center gap-1.5">
            <WifiOff size={12} />
            Offline — changes will sync when connected
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>

        {/* Bottom tab bar — mobile only */}
        <nav className="md:hidden flex border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pb-[env(safe-area-inset-bottom)]">
          {links.slice(0, 5).map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path} to={path} end={path === '/'}
              className={({ isActive }) =>
                clsx('flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-slate-500 dark:text-slate-400')
              }
            >
              <Icon size={18} />
              <span className="truncate max-w-[52px]">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
