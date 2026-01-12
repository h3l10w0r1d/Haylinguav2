// src/LandingPage.jsx
import { useState } from 'react';
import { Mail, Lock, User, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import characterTeacher from './assets/character-teacher.png';

export default function LandingPage({ onLogin, onSignup }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isLogin = mode === 'login';

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        if (!form.email || !form.password) {
          throw new Error('Please enter your email and password.');
        }
        await onLogin(form.email, form.password);
      } else {
        if (!form.name || !form.email || !form.password) {
          throw new Error('Please fill in all fields.');
        }
        await onSignup(form.name, form.email, form.password);
      }
    } catch (err) {
      console.error('Auth error', err);
      setError(err?.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 flex flex-col">
      {/* Top nav (brand only for now) */}
      <header className="w-full flex items-center justify-between px-6 py-4 md:px-10 md:py-6">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-2xl bg-orange-600 flex items-center justify-center text-white font-semibold shadow-md">
            Հ
          </div>
          <span className="font-semibold text-gray-900 text-lg tracking-tight">
            Haylingua
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center px-6 pb-12 lg:px-10 lg:pb-16 gap-10 lg:gap-16">
        {/* Left side: Hero */}
        <section className="w-full lg:w-1/2 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-orange-100 px-3 py-1 mb-4 shadow-sm">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium text-gray-700">
              Learn Armenian the playful way
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-4">
            Turn Armenian letters into
            <span className="text-orange-600"> daily wins.</span>
          </h1>

          <p className="text-gray-600 text-sm md:text-base mb-6 max-w-md">
            Bite-sized exercises, smart character training, and a streak system
            that keeps you coming back. Just like Duolingo—but for Armenian.
          </p>

          <ul className="space-y-2 mb-8 text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Letter-focused drills with instant feedback
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Smart pronunciation practice powered by TTS
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              XP, streaks, and levels to keep you motivated
            </li>
          </ul>

          <div className="hidden lg:flex items-end gap-4">
            <img
              src={characterTeacher}
              alt="Friendly Armenian teacher character"
              className="w-40 h-40 object-contain drop-shadow-lg"
            />
            <div className="bg-white/80 border border-orange-100 rounded-2xl px-4 py-3 shadow-sm text-xs text-gray-700 max-w-xs">
              <p className="font-medium mb-1">Tip of the day</p>
              <p>
                Start with 5 minutes. A short, focused session every day beats
                a 2-hour marathon once a month.
              </p>
            </div>
          </div>
        </section>

        {/* Right side: Auth card */}
        <section className="w-full lg:w-[420px] max-w-md">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg shadow-orange-100 border border-orange-100 p-6 md:p-8">
            {/* Tabs */}
            <div className="flex mb-6 bg-gray-50 rounded-2xl p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-2xl transition-all ${
                  isLogin
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-2xl transition-all ${
                  !isLogin
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Sign up
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {isLogin ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-xs text-gray-500">
                {isLogin
                  ? 'Log in to continue your Armenian learning journey.'
                  : 'Start from the Armenian alphabet and build your streak.'}
              </p>
            </div>

            {error && (
              <div className="mb-4 text-xs rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    First name or nickname
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={form.name}
                      onChange={handleChange('name')}
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="e.g. Armen"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={handleChange('email')}
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={handleChange('password')}
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="At least 8 characters"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                </div>
              </div>

              {!isLogin && (
                <p className="text-[11px] text-gray-500">
                  By creating an account, you agree to learn at least one
                  Armenian letter this week. No scary legal text here.
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 text-white text-sm font-medium py-2.5 shadow-md shadow-orange-200 hover:bg-orange-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isLogin ? 'Logging you in…' : 'Creating your account…'}
                  </>
                ) : (
                  <>
                    {isLogin ? 'Log in to Haylingua' : 'Start learning Armenian'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between text-[11px] text-gray-500">
              <span>
                {isLogin
                  ? "New here? Switch to “Sign up” to get started."
                  : 'Already have an account? Use the “Log in” tab.'}
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
