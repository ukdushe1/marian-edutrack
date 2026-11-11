/**
 * DEVELOPMENT ONLY — the app layout with a fake signed-in Principal, for
 * checking the menus at phone and desktop sizes without logging in.
 * Open http://localhost:5173/?preview=shell (never included in production builds).
 */
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { effectiveRoles } from '../lib/roles';
import AppShell from '../components/layout/AppShell';

function SamplePage() {
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-bold">Markbook</h1>
      <p className="text-sm text-slate-500">Sample content to check spacing, wide tables and scrolling.</p>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="text-sm min-w-[640px]">
          <thead><tr>{['Student', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Total'].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody>{Array.from({ length: 12 }, (_, i) => <tr key={i} className="border-t border-slate-100"><td className="px-3 py-1.5">Student {i + 1}</td>{[1, 2, 3, 4, 5, 6, 7].map((q) => <td key={q} className="px-3">{(i * q) % 10}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm">Card {i + 1}</div>)}
    </div>
  );
}

// ?preview=shell&open=menu opens the mobile menu (for screenshots)
if (new URLSearchParams(location.search).get('open') === 'menu') {
  setTimeout(() => document.querySelector('[aria-label="Open menu"]')?.click(), 600);
}

export default function ShellPreview() {
  const roles = effectiveRoles(['principal']);
  const auth = {
    firebaseUser: { uid: 'preview' }, profile: { name: 'Kuda Ushe', roles: ['principal'] }, roles,
    hasRole: (...c) => c.some((r) => roles.includes(r)), loading: false,
  };
  return (
    <ThemeProvider>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/markbook']}>
          <Routes><Route path="/" element={<AppShell />}><Route path="*" element={<SamplePage />} /></Route></Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}
