// src/navigation/MainTabs.js — bottom-tab bar mirroring the web's mobile
// bottom nav (src/HeaderLayout.jsx: Learn, Friends, Leaderboard, Profile).
// Only Learn is real in Phase 0; the rest are placeholders (see plan).
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Users, Trophy, User } from 'lucide-react-native';
import DashboardScreen from '../screens/DashboardScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';

const Tab = createBottomTabNavigator();

const ICONS = { Learn: Home, Friends: Users, Leaderboard: Trophy, Profile: User };

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#FF7A1A',
        tabBarInactiveTintColor: '#a8a29e',
        tabBarIcon: ({ color, size }) => {
          const Icon = ICONS[route.name] || Home;
          return <Icon color={color} size={size ?? 22} />;
        },
      })}
    >
      <Tab.Screen name="Learn" component={DashboardScreen} />
      <Tab.Screen name="Friends" component={PlaceholderScreen} />
      <Tab.Screen name="Leaderboard" component={PlaceholderScreen} />
      <Tab.Screen name="Profile" component={PlaceholderScreen} />
    </Tab.Navigator>
  );
}
