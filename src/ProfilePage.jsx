// src/ProfilePage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Image as ImageIcon,
  Lock,
  Flame,
  Star,
  Trophy,
} from 'lucide-react';

const API_BASE = 'https://haylinguav2.onrender.com';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    avatar_url: '',
    email: '',
    current_password: '',
    new_password: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('hay_token');
    if (!token) {
      navigate('/');
      return;
    }

    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to load profile: ${res.status}`);
        }

        const data = await res.json();
        setProfile(data);
        setForm((prev) => ({
          ...prev,
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          avatar_url: data.avatar_url ?? '',
          email: data.email ?? '',
          current_password: '',
          new_password: '',
        }));
      } catch (err) {
        console.error(err);
        setError('Could not load your profile. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [navigate]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('hay_token');
    if (!token) {
      navigate('/');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const body = {
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        avatar_url: form.avatar_url || null,
        email: form.email || null,
        current_password: form.current_password || null,
        new_password: form.new_password || null,
      };

      const res = await fetch(`${API_BASE}/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Update failed', res.status, text);
        throw new Error(text || `Update failed: ${res.status}`);
      }

      const data = await res.json();
      setProfile(data);

      // Wipe password fields
      setForm((prev) => ({
        ...prev,
        current_password: '',
        new_password: '',
      }));

      // Optionally also update stored user email
      const storedUser = localStorage.getItem('hay_user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          parsed.email = data.email;
          localStorage.setItem('hay_user', JSON.stringify(parsed));
        } catch {
          // ignore
        }
      }

      alert('Profile updated!');
    } catch (err) {
      console.error(err);
      setError(
        'Could not save your changes. Check your current password if you tried to change it.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <p className="text-gray-600">Loading your profile…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <p className="text-red-600">
          Something went wrong loading your profile.
        </p>
      </div>
    );
  }

  const displayName =
    (profile.first_name || profile.last_name)
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
      : profile.email.split('@')[0];

  const avatarLetter = displayName.charAt(0).toUpperCase();
  const maxXpDay = Math.max(
    1,
    ...profile.last_30_days.map((d) => d.xp_earned || 0)
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pt-20 pb-12">
      <div className="max-w-5xl mx-auto px-4">
        {/* Top: Avatar + summary */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-3xl font-semibold shadow-lg">
                  {avatarLetter}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {displayName}
              </h1>
              <p className="text-gray-500 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>{profile.email}</span>
              </p>
            </div>
          </div>

          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-3 md:w-80">
            <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col items-center">
              <Flame className="w-6 h-6 text-orange-500 mb-1" />
              <div className="text-xl font-semibold text-gray-900">
                {profile.current_streak}
              </div>
              <div className="text-xs text-gray-500">Day streak</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col items-center">
              <Star className="w-6 h-6 text-yellow-500 mb-1" />
              <div className="text-xl font-semibold text-gray-900">
                {profile.total_xp}
              </div>
              <div className="text-xs text-gray-500">Total XP</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col items-center">
              <Trophy className="w-6 h-6 text-amber-600 mb-1" />
              <div className="text-xl font-semibold text-gray-900">
                {profile.level}
              </div>
              <div className="text-xs text-gray-500">Level</div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Profile form */}
          <div className="bg-white rounded-3xl shadow-sm p-6 md:p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Profile details
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  First name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={handleChange('first_name')}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    placeholder="Armen"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Last name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={handleChange('last_name')}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    placeholder="Petrosyan"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Avatar image URL
                </label>
                <div className="relative">
                  <ImageIcon className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="url"
                    value={form.avatar_url}
                    onChange={handleChange('avatar_url')}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    placeholder="https://…"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Paste a link to a square image (e.g. from your cloud storage).
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={handleChange('email')}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mt-2">
                <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Change password
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  To change your password, enter your current password and a new one.
                </p>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600">
                    Current password
                  </label>
                  <input
                    type="password"
                    value={form.current_password}
                    onChange={handleChange('current_password')}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-2 mt-2">
                  <label className="text-xs font-medium text-gray-600">
                    New password
                  </label>
                  <input
                    type="password"
                    value={form.new_password}
                    onChange={handleChange('new_password')}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Activity graph */}
          <div className="bg-white rounded-3xl shadow-sm p-6 md:p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Your last 30 days
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Each bar shows your XP earned per day. Keep the streak burning.
            </p>

            <div className="h-48 flex items-end gap-1 border border-gray-100 rounded-2xl px-3 py-3 bg-gray-50">
              {profile.last_30_days.map((day) => {
                const height = (day.xp_earned / maxXpDay) * 100;
                const isToday = day.date === new Date().toISOString().slice(0, 10);
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center justify-end"
                  >
                    <div
                      className={`w-2 rounded-full ${
                        day.xp_earned > 0
                          ? isToday
                            ? 'bg-orange-600'
                            : 'bg-orange-400'
                          : 'bg-gray-200'
                      }`}
                      style={{ height: `${Math.max(6, height)}%` }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex justify-between text-[11px] text-gray-400">
              <span>{profile.last_30_days[0]?.date}</span>
              <span>{profile.last_30_days[profile.last_30_days.length - 1]?.date}</span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
                <p className="text-gray-700 font-medium mb-1">
                  Keep your streak alive
                </p>
                <p className="text-xs text-gray-500">
                  Do at least one exercise each day to grow your streak and level faster.
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                <p className="text-gray-700 font-medium mb-1">
                  XP is your progress fuel
                </p>
                <p className="text-xs text-gray-500">
                  Every completed exercise adds XP. Harder lessons can give more XP later.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
