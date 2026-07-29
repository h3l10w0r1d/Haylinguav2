// src/navigation/RootNavigator.js — Auth stack (signed out) vs Main app
// (signed in), following React Navigation's conditional-screens pattern
// (no separate nested navigator needed for auth).
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../lib/authStore';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import MainTabs from './MainTabs';
import LessonScreen from '../screens/LessonScreen';
import LessonCompleteScreen from '../screens/LessonCompleteScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import CheckpointScreen from '../screens/CheckpointScreen';
import PracticeScreen from '../screens/PracticeScreen';
import ReviewScreen from '../screens/ReviewScreen';
import PlacementScreen from '../screens/PlacementScreen';
import AssessmentScreen from '../screens/AssessmentScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import AvatarBuilderScreen from '../screens/AvatarBuilderScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'signedOut' ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : (
          <>
            {/* Onboarding is the real entry point after sign-in — it checks
                GET /me/onboarding itself and replaces straight to Main if
                already completed, so returning users barely notice it. */}
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Lesson" component={LessonScreen} options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="LessonComplete" component={LessonCompleteScreen} options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
            <Stack.Screen name="Checkpoint" component={CheckpointScreen} options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="Practice" component={PracticeScreen} options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="Review" component={ReviewScreen} options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="Placement" component={PlacementScreen} options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="Assessment" component={AssessmentScreen} options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="AvatarBuilder" component={AvatarBuilderScreen} options={{ presentation: 'fullScreenModal' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
