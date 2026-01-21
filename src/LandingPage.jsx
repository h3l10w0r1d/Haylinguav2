// src/LandingPage.jsx
import { useState } from 'react';
import { Lock, Mail, User, Sparkles } from 'lucide-react';

export default function LandingPage({ onLogin, onSignup }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await onLogin(email.trim(), password);
      } else {
        // signup
        await onSignup(name.trim(), email.trim(), password);
      }
    } catch (err) {
      console.error('Auth error', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 flex items-center justify-center px-4">
      <div className="max-w-5xl w-full grid lg:grid-cols-2 gap-10 items-center">
        {/* Left: hero */}
        <div className="hidden lg:block">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 bg-white/80 rounded-full shadow-sm border border-orange-100">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium text-orange-700">
              Learn Armenian the fun way
            </span>
          </div>

          <h1 className="text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
            Welcome to <span className="text-orange-600">Haylingua</span>
          </h1>
          <p className="text-gray-600 text-lg mb-8">
            Bite-sized lessons, friendly characters, and a touch of Armenian culture.
            Start from the alphabet and build your skills step by step.
          </p>

          <div className="flex items-center gap-6 text-sm text-gray-600">
            <div>
              <div className="text-xl font-bold text-gray-900">5 min / day</div>
              <div className="text-gray-500">Small lessons, big progress</div>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">Gamified</div>
              <div className="text-gray-500">XP, streaks, and challenges</div>
            </div>
          </div>
        </div>

        {/* Right: auth card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-orange-100 p-6 sm:p-8">
          {/* Tabs */}
          <div className="flex mb-6 bg-orange-50 rounded-xl p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                mode === 'login'
                  ? 'bg-white shadow text-orange-600'
                  : 'text-gray-500 hover:text-gray-700'
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
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                mode === 'signup'
                  ? 'bg-white shadow text-orange-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Create account
            </button>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {mode === 'login' ? 'Welcome back 👋' : 'Get started for free 🎉'}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {mode === 'login'
              ? 'Log in to continue your Armenian learning journey.'
              : 'Create an account to save your progress and streaks.'}
          </p>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="How should we call you?"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? 'Your password' : 'Min 6 characters'}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
              {mode === 'signup' && (
                
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex justify-center items-center gap-2 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                  {mode === 'login' ? 'Logging in…' : 'Creating account…'}
                </>
              ) : (
                <>{mode === 'login' ? 'Log in' : 'Create account'}</>
              )}
            </button>
          </form>

          {mode === 'login' && (
            
          )}
        </div>
      </div>
    </div>
  );
}
