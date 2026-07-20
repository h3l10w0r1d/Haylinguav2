// src/navigation/MainTabs.js — bottom-tab bar mirroring the web's mobile
// bottom nav (src/HeaderLayout.jsx: Learn, Friends, Leaderboard, Profile).
// Only Learn is real in Phase 0; the rest are placeholders (see plan).
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Users, Trophy, User } from 'lucide-react-native';
import DashboardScreen from '../screens/DashboardScreen';
import FriendsScreen from '../screens/FriendsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { haptics } from '../lib/haptics';

const Tab = createBottomTabNavigator();

const ICONS = { Learn: Home, Friends: Users, Leaderboard: Trophy, Profile: User };

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#FF7A1A',
        tabBarInactiveTintColor: '#a8a29e',
        // Chunky bordered bar + bold uppercase-ish labels, mirrors Duolingo's
        // flat (no shadow) bottom nav rather than the platform-default
        // floating/elevated tab bar.
        tabBarStyle: {
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
          borderTopWidth: 2,
          borderTopColor: '#e7e5e4',
          backgroundColor: '#ffffff',
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800' },
        tabBarIcon: ({ color, size }) => {
          const Icon = ICONS[route.name] || Home;
          return <Icon color={color} size={size ?? 24} strokeWidth={2.4} />;
        },
      })}
      screenListeners={{
        tabPress: () => haptics.impact(),
      }}
    >
      <Tab.Screen name="Learn" component={DashboardScreen} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
