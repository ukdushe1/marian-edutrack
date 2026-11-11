import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginEmail, loginGoogle, resetPassword } from '../../firebase/auth';
import { Globe } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const nav = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [mode,     setMode]     = useState('login'); // 'login' | 'reset'

  async function handleEmail(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'reset') {
        await resetPassword(email);
        toast.success('Password-reset email sent.');
        setMode('login');
      } else {
        await loginEmail(email, password);
        nav('/');
      }
    } catch (err) {
      toast.error(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      await loginGoogle();
      nav('/');
    } catch (err) {
      toast.error(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-ink px-4 py-8 border-t-8 border-ink dark:border-brand-600">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-2">
          <img src="/logo.jpg" alt="Marian High School — Seize the moment"
            className="w-56 h-auto rounded-2xl shadow-sm ring-1 ring-black/5" />
          <h1 className="text-2xl font-bold tracking-tight mt-2">
            Marian <span className="text-brand-600">EduTrack</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">School management system</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="font-semibold text-lg">{mode === 'reset' ? 'Reset password' : 'Sign in'}</h2>

          <form onSubmit={handleEmail} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                autoComplete="email"
              />
            </div>
            {mode === 'login' && (
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  autoComplete="current-password"
                />
              </div>
            )}
            <button
              type="submit" disabled={busy}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              {busy ? 'Please wait…' : mode === 'reset' ? 'Send reset email' : 'Sign in'}
            </button>
          </form>

          <div className="relative flex items-center gap-3 text-xs text-slate-400">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            or
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>

          <button
            onClick={handleGoogle} disabled={busy}
            className="w-full flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-600 rounded-lg py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
          >
            <Globe size={16} />
            Sign in with Google
          </button>

          <button
            onClick={() => setMode(mode === 'reset' ? 'login' : 'reset')}
            className="w-full text-center text-xs text-brand-600 hover:underline"
          >
            {mode === 'reset' ? '← Back to sign in' : 'Forgot password?'}
          </button>
        </div>
      </div>
    </div>
  );
}

function friendlyError(code) {
  const map = {
    'auth/wrong-password':       'Incorrect password.',
    'auth/user-not-found':       'No account with that email.',
    'auth/too-many-requests':    'Too many attempts — try again later.',
    'auth/network-request-failed': 'Network error — check your connection.',
  };
  return map[code] ?? 'Sign-in failed. Try again.';
}
