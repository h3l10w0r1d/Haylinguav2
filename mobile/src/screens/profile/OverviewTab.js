// src/screens/profile/OverviewTab.js — 30-day activity heatmap, learning
// stats, achievements, share-profile row. Read-only, driven entirely by
// props ProfileScreen already fetched.
import React from 'react';
import { View, Text, Share } from 'react-native';
import { Award, Share2, Calendar, BookOpen, Flame, Zap, Target, Activity, CheckCircle2 } from 'lucide-react-native';
import Pressable3D from '../../components/Pressable3D';

function HeatmapDay({ value }) {
  const opacity = value > 0 ? Math.min(1, value / 3) : 0;
  return (
    <View
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        backgroundColor: value > 0 ? `rgba(255, 122, 26, ${0.25 + opacity * 0.75})` : '#e7e5e4',
      }}
    />
  );
}

function StatCell({ icon: Icon, tint, color, label, value }) {
  return (
    <View className="w-[31%] items-center rounded-2xl bg-white py-3" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
      <View className="mb-1 h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: tint }}>
        <Icon size={13} color={color} />
      </View>
      <Text className="text-lg font-extrabold text-stone-900">{value}</Text>
      <Text className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">{label}</Text>
    </View>
  );
}

export default function OverviewTab({ profile, stats, achievements, activityDays, learningSummary }) {
  const activeDays = activityDays.filter((d) => d.value > 0).length;
  const totalExercises = activityDays.reduce((sum, d) => sum + d.value, 0);

  async function shareProfile() {
    if (!profile?.username) return;
    try {
      await Share.share({ message: `https://haylingua.am/u/${profile.username}` });
    } catch {
      // user cancelled or share failed — non-fatal
    }
  }

  return (
    <View>
      {/* 30-day heatmap */}
      <View className="rounded-2xl bg-white p-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
        <View className="mb-3 flex-row items-center gap-2">
          <Calendar size={14} color="#a8a29e" />
          <Text className="text-xs font-extrabold uppercase tracking-wide text-stone-400">Last 30 days</Text>
        </View>
        <View className="flex-row flex-wrap" style={{ gap: 4 }}>
          {activityDays.map((d) => (
            <HeatmapDay key={d.date} value={d.value} />
          ))}
        </View>
        <Text className="mt-3 text-xs font-semibold text-stone-400">
          {activeDays} active days · {totalExercises} exercises
        </Text>
      </View>

      {/* Stats grid */}
      <View className="mt-4 flex-row flex-wrap justify-between" style={{ gap: 8 }}>
        <StatCell icon={BookOpen} tint="#FFF5EC" color="#FF7A1A" label="Lessons" value={stats?.lessons_completed ?? '–'} />
        <StatCell icon={Flame} tint="#FFF5EC" color="#FF7A1A" label="Best streak" value={profile?.best_streak ?? 0} />
        <StatCell icon={Zap} tint="#E7F7FF" color="#1899D6" label="Lifetime XP" value={profile?.total_xp ?? 0} />
        <StatCell icon={Target} tint="#EFFCE3" color="#58CC02" label="Accuracy (14d)" value={learningSummary ? `${Math.round(learningSummary.accuracy)}%` : '–'} />
        <StatCell icon={Activity} tint="#FFF8E1" color="#E0A800" label="Exercises (14d)" value={learningSummary?.attempts ?? '–'} />
        <StatCell icon={CheckCircle2} tint="#EFFCE3" color="#58CC02" label="Correct (14d)" value={learningSummary?.correct ?? '–'} />
      </View>

      {/* Achievements */}
      <View className="mt-4 rounded-2xl bg-white p-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
        <View className="mb-3 flex-row items-center gap-2">
          <Award size={16} color="#E0A800" />
          <Text className="text-xs font-extrabold uppercase tracking-wide text-stone-400">Achievements</Text>
        </View>
        {achievements.length === 0 ? (
          <Text className="text-sm font-semibold text-stone-400">No achievements earned yet.</Text>
        ) : (
          achievements.map((a) => (
            <View key={a.id} className="flex-row items-center gap-3 border-b border-stone-100 py-2.5 last:border-b-0">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-gold-50">
                <Award size={14} color="#E0A800" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-stone-800">{a.title}</Text>
                {!!a.desc && <Text className="text-xs font-medium text-stone-400">{a.desc}</Text>}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Share profile */}
      {!!profile?.username && (
        <Pressable3D onPress={shareProfile} className="mt-4 flex-row items-center gap-3 rounded-2xl bg-white p-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
          <View className="h-9 w-9 items-center justify-center rounded-full bg-feather-50">
            <Share2 size={16} color="#1899D6" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-stone-800">Share your profile</Text>
            <Text className="text-xs font-semibold text-stone-400">haylingua.am/u/{profile.username}</Text>
          </View>
        </Pressable3D>
      )}
    </View>
  );
}
