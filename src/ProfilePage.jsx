// src/ProfilePage.jsx
import { useState, useEffect } from 'react';
import { Trophy, Flame, Star } from 'lucide-react';

export default function ProfilePage({ user, onUpdateUser }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // initialize form from user
  useEffect(() => {
    if (!user) return;
    const nameParts = (user.name || '').split(' ');
    setFirstName(nameParts[0] || '');
    setLastName(nameParts.slice(1).join(' ') || '');
    setEmail(user.email || '');
    setAvatarUrl(user.avatarUrl || '');
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <p className="text-gray-600">
          You need to be logged in to view your profile.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const newName =
        [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') ||
        user.name;

      onUpdateUser({
        name: newName,
        email: email.trim() || user.email,
        avatarUrl: avatarUrl.trim() || undefined,
      });

      // When backend profile endpoint exists, call it here.
      // For now it's local-only.
    } finally {
      setSaving(false);
    }
  };

  const displayName =
    [firstName || '', lastName || ''].filter(Boolean).join(' ') ||
    user.name ||
    'Haylingua learner';

  const initials =
    (firstName?.[0] || user.name?.[0] || user.email?.[0] || 'U').toUpperCase();

  const level = user.level ?? 1;
  const xp = user.xp ?? 0;
  const streak = user.streak ?? 1;

  // Fake tiny “last 7 days” completion data for now
  const weeklyProgress = [
    { day: 'M', value: 2 },
    { day: 'T', value: 3 },
    { day: 'W', value: 1 },
    { day: 'T', value: 4 },
    { day: 'F', value: 0 },
    { day: 'S', value: 5 },
    { day: 'S', value: 2 },
  ];

  const maxVal = Math.max(...weeklyProgress.map((d) => d.value), 1);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top section: avatar + basic stats */}
      <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-2xl font-semibold shadow-md">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-gray-900">
              {displayName}
            </h1>
            <p className="text-sm text-gray-500">{email}</p>
            <p className="mt-1 text-xs text-orange-600 font-medium">
              Armenian learner • Level {level}
            </p>
          </div>
        </div>

        <div className="flex gap-3 md:gap-4">
          <div className="flex flex-col items-center bg-orange-50 rounded-xl px-3 py-2">
            <Trophy className="w-4 h-4 text-orange-500 mb-1" />
            <span className="text-sm font-semibold text-gray-900">
              Lv {level}
            </span>
            <span className="text-[11px] text-gray-500">Level</span>
          </div>
          <div className="flex flex-col items-center bg-yellow-50 rounded-xl px-3 py-2">
            <Star className="w-4 h-4 text-yellow-500 mb-1" />
            <span className="text-sm font-semibold text-gray-900">
              {xp}
            </span>
            <span className="text-[11px] text-gray-500">XP</span>
          </div>
          <div className="flex flex-col items-center bg-red-50 rounded-xl px-3 py-2">
            <Flame className="w-4 h-4 text-red-500 mb-1" />
            <span className="text-sm font-semibold text-gray-900">
              {streak}
            </span>
            <span className="text-[11px] text-gray-500">Day streak</span>
          </div>
        </div>
      </section>

      {/* Profile form */}
      <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
          Profile details
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                First name
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Armen"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Last name
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Petrosyan"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Used to log in to Haylingua.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Profile picture URL
              </label>
              <input
                type="url"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…/avatar.png"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Paste a direct image link. We’ll show it in your avatar.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      {/* Progress overview */}
      <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
          Recent learning activity
        </h2>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-2">
              Exercises completed in the last 7 days
            </p>
            <div className="flex items-end gap-2 h-28">
              {weeklyProgress.map((d) => (
                <div
                  key={d.day}
                  className="flex flex-col items-center justify-end flex-1"
                >
                  <div
                    className="w-6 rounded-full bg-orange-100 overflow-hidden flex items-end"
                    style={{ height: '80px' }}
                  >
                    <div
                      className="w-full bg-gradient-to-t from-orange-600 to-yellow-400"
                      style={{
                        height: `${(d.value / maxVal) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="mt-1 text-[11px] text-gray-500">
                    {d.day}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-60 space-y-3">
            <div className="flex justify-between items-center bg-orange-50 rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-600">
                Total lessons completed
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {user.completedLessons?.length || 0}
              </span>
            </div>
            <div className="flex justify-between items-center bg-green-50 rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-600">
                Best streak
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {streak} days
              </span>
            </div>
            <div className="flex justify-between items-center bg-blue-50 rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-600">
                Lifetime XP
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {xp}
              </span>
            </div>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-gray-400">
          Note: these stats are currently stored on this device. Next step is
          wiring them to the backend&apos;s progress model so they follow you
          everywhere.
        </p>
      </section>
    </div>
  );
}
