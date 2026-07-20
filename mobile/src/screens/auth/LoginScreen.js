// src/screens/auth/LoginScreen.js — email/password login against the real
// backend (POST /login). 2FA / Turnstile / OAuth are out of scope for Phase 0
// (see plan) — if the backend demands either, we surface a plain error asking
// the user to use the web app for now instead of half-building those flows.
import React, { useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { api, ApiError } from '../../lib/api';
import { useAuthStore } from '../../lib/authStore';
import Pressable3D from '../../components/Pressable3D';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const signIn = useAuthStore((s) => s.signIn);

  async function submit() {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/login', { email: email.trim(), password }, { auth: false });
      await signIn(res.access_token, res.email);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.detail?.requires_2fa) {
          setError('This account has 2FA enabled — not supported in the app yet. Use haylingua.am to log in.');
        } else if (e.detail?.requires_captcha) {
          setError('Too many attempts — please log in on haylingua.am to verify you’re human, then try the app again.');
        } else if (e.detail?.locked) {
          setError(e.detail.message || 'Too many failed attempts. Try again later.');
        } else {
          setError(typeof e.detail === 'string' ? e.detail : e.message || 'Login failed.');
        }
      } else {
        setError('Could not reach the server. Check your connection.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#f5f4f1]"
    >
      <View className="flex-1 justify-center px-6">
        <View className="mb-8 items-center">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand-500">
            <Text className="text-2xl font-extrabold text-white">Հ</Text>
          </View>
          <Text className="mt-3 text-2xl font-extrabold text-stone-900">Welcome back</Text>
          <Text className="mt-1 text-sm font-medium text-stone-500">Log in to keep your streak alive</Text>
        </View>

        <Text className="mb-1.5 text-sm font-bold text-stone-700">Email or username</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#a8a29e"
          className="mb-4 rounded-2xl bg-white px-4 py-3.5 text-base text-stone-900 ring-1 ring-stone-200"
        />

        <Text className="mb-1.5 text-sm font-bold text-stone-700">Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#a8a29e"
          className="mb-2 rounded-2xl bg-white px-4 py-3.5 text-base text-stone-900 ring-1 ring-stone-200"
        />

        {!!error && <Text className="mb-2 text-sm font-semibold text-cardinal-600">{error}</Text>}

        <Pressable3D
          onPress={submit}
          disabled={loading}
          className="mt-4 items-center rounded-2xl bg-brand-500 py-4"
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-extrabold text-white">Log in</Text>}
        </Pressable3D>

        <Pressable3D onPress={() => navigation.navigate('Signup')} className="mt-5 items-center">
          <Text className="text-sm font-bold text-stone-500">
            Don&rsquo;t have an account? <Text className="text-brand-600">Sign up</Text>
          </Text>
        </Pressable3D>
      </View>
    </KeyboardAvoidingView>
  );
}
