// src/navigation/RootNavigator.js — Auth stack (signed out) vs Main app
// (signed in), following React Navigation's conditional-screens pattern
// (no separate nested navigator needed for auth).
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../lib/authStore';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import MainTabs from './MainTabs';
import LessonScreen from '../screens/LessonScreen';
import LessonCompleteScreen from '../screens/LessonCompleteScreen';

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
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Lesson" component={LessonScreen} options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="LessonComplete" component={LessonCompleteScreen} options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
