// src/Leaderboard.jsx
import { Trophy, Crown, Medal, Flame, Star } from 'lucide-react';

export default function Leaderboard({ user }) {
  // Fake leaderboard data for now – later we’ll fetch from backend
  const currentUserName = user?.name || user?.email?.split('@')[0] || 'You';

  const entries = [
    {
      id: 1,
      name: 'Armen Petrosyan',
      xp: 4200,
      streak: 21,
      level: 10,
    },
    {
      id: 2,
      name: 'Lusine Hovhannisyan',
      xp: 3900,
      streak: 18,
      level: 9,
    },
    {
      id: 3,
      name: 'Tigran Sargsyan',
      xp: 3650,
      streak: 15,
      level: 9,
    },
    {
      id: 4,
      name: currentUserName,
      xp: user?.xp ?? 1500,
      streak: user?.streak ?? 5,
      level: user?.level ?? 4,
      isYou: true,
    },
    {
      id: 5,
      name: 'Anahit Grigoryan',
      xp: 1300,
      streak: 3,
      level: 4,
    },
    {
      id: 6,
      name: 'Davit Mkrtchyan',
      xp: 1100,
      streak: 4,
      level: 3,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4 pb-6 space-y-6">
      {/* Header */}
      <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center text-white shadow-md">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-gray-900">
              Weekly Leaderboard
            </h1>
            <p className="text-xs text-gray-500">
              Compete with other learners and climb the ranks.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex items-center gap-1.5 bg-orange-50 rounded-xl px-3 py-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium text-gray-800">
              Streak: {user?.streak ?? 1} days
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-yellow-50 rounded-xl px-3 py-2">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-medium text-gray-800">
              XP: {user?.xp ?? 0}
            </span>
          </div>
        </div>
      </section>

      {/* Podium for top 3 */}
      <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Top learners this week
        </h2>
        <div className="grid grid-cols-3 gap-3 md:gap-4 items-end">
          {/* 2nd */}
          <PodiumCard
            place={2}
            name={entries[1].name}
            xp={entries[1].xp}
            streak={entries[1].streak}
            level={entries[1].level}
            heightClass="h-28 md:h-32"
          />
          {/* 1st */}
          <PodiumCard
            place={1}
            name={entries[0].name}
            xp={entries[0].xp}
            streak={entries[0].streak}
            level={entries[0].level}
            heightClass="h-32 md:h-40"
            highlight
          />
          {/* 3rd */}
          <PodiumCard
            place={3}
            name={entries[2].name}
            xp={entries[2].xp}
            streak={entries[2].streak}
            level={entries[2].level}
            heightClass="h-24 md:h-28"
          />
        </div>
      </section>

      {/* Full list */}
      <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          All rankings
        </h2>
        <div className="divide-y divide-gray-100">
          {entries.map((entry, index) => (
            <RowEntry
              key={entry.id}
              rank={index + 1}
              entry={entry}
            />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-gray-400">
          This is placeholder leaderboard data stored on the frontend.
          Later we&apos;ll plug this into a real backend endpoint that
          aggregates XP and streaks across users.
        </p>
      </section>
    </div>
  );
}

function PodiumCard({
  place,
  name,
  xp,
  streak,
  level,
  heightClass,
  highlight = false,
}) {
  const placeColors = {
    1: 'from-yellow-400 via-orange-500 to-red-500',
    2: 'from-gray-300 to-gray-400',
    3: 'from-amber-500 to-orange-500',
  };

  const icon =
    place === 1 ? (
      <Crown className="w-5 h-5" />
    ) : (
      <Medal className="w-5 h-5" />
    );

  const [firstName] = name.split(' ');

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-12 h-12 rounded-full bg-gradient-to-br ${
          placeColors[place]
        } flex items-center justify-center text-white text-sm font-semibold shadow-md`}
      >
        {firstName[0]?.toUpperCase() ?? '?'}
      </div>
      <span className="text-xs font-medium text-gray-800 truncate max-w-[80px] text-center">
        {firstName}
      </span>
      <div
        className={`mt-1 w-full rounded-xl bg-gray-100 flex flex-col items-center justify-end ${heightClass} relative overflow-hidden`}
      >
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t ${
            placeColors[place]
          }`}
          style={{ height: '70%' }}
        />
        <div className="relative z-10 flex flex-col items-center pb-1">
          <div className="flex items-center gap-1 text-white text-xs font-semibold">
            {icon}
            <span>#{place}</span>
          </div>
          <span className="text-[11px] text-white/90">
            Lv {level} · {xp} XP
          </span>
        </div>
      </div>
      <span className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
        <Flame className="w-3 h-3 text-orange-500" />
        {streak}d
      </span>
    </div>
  );
}

function RowEntry({ rank, entry }) {
  const badgeColors = entry.isYou
    ? 'bg-orange-100 text-orange-700 border-orange-200'
    : 'bg-gray-50 text-gray-600 border-gray-100';

  const initial =
    entry.name?.[0]?.toUpperCase() ?? entry.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div
      className={`flex items-center gap-3 py-3 ${
        entry.isYou ? 'bg-orange-50/60' : 'hover:bg-gray-50'
      } transition-colors`}
    >
      <div className="w-8 text-center text-xs font-semibold text-gray-500">
        #{rank}
      </div>

      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-sm font-semibold">
        {initial}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {entry.name}
          </span>
          {entry.isYou && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeColors}`}
            >
              You
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-[11px] text-gray-500 mt-0.5">
          <span className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-yellow-500" />
            Lv {entry.level}
          </span>
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-500" />
            {entry.xp} XP
          </span>
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            {entry.streak} day streak
          </span>
        </div>
      </div>
    </div>
  );
}
