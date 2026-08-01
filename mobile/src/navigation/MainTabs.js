// src/navigation/MainTabs.js — bottom-tab bar mirroring the web's mobile
// bottom nav (src/HeaderLayout.jsx: Learn, Friends, Leaderboard, Profile).
// Only Learn is real in Phase 0; the rest are placeholders (see plan).
import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Users, Trophy, User } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring, Easing } from 'react-native-reanimated';
import DashboardScreen from '../screens/DashboardScreen';
import FriendsScreen from '../screens/FriendsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { haptics } from '../lib/haptics';

const Tab = createBottomTabNavigator();

const ICONS = { Learn: Home, Friends: Users, Leaderboard: Trophy, Profile: User };

// A quick overshoot-then-settle scale, mirroring Duolingo's tab bar bounce
// on selection — a static color swap (the previous behavior) reads as
// inert next to the rest of the app's "juice."
function AnimatedTabIcon({ Icon, focused, color, size }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withTiming(1.3, { duration: 120, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 9, stiffness: 220 })
      );
    }
  }, [focused, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Icon color={color} size={size ?? 24} strokeWidth={2.4} />
    </Animated.View>
  );
}

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
        tabBarIcon: ({ focused, color, size }) => {
          const Icon = ICONS[route.name] || Home;
          return <AnimatedTabIcon Icon={Icon} focused={focused} color={color} size={size} />;
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
