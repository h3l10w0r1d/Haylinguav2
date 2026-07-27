// src/screens/auth/SignupScreen.js — real signup (POST /signup). The backend
// issues a token immediately but marks email_verified: false and emails a
// verification code; the web app gates the dashboard behind verifying that
// code. Phase 0 skips building that verify-code screen and signs the user
// in directly — fine for proving the pipeline, but note this is a real gap
// before shipping (see plan's "explicitly deferred" list).
import React, { useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { api, ApiError } from '../../lib/api';
import { useAuthStore } from '../../lib/authStore';
import Pressable3D from '../../components/Pressable3D';
import TurnstileChallenge from '../../components/TurnstileChallenge';

export default function SignupScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const signIn = useAuthStore((s) => s.signIn);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      const res = await api.post(
        '/signup',
        { username: username.trim(), email: email.trim(), password, turnstile_token: turnstileToken },
        { auth: false }
      );
      await signIn(res.access_token, res.email);
    } catch (e) {
      // A stale/expired token can't be reused — force a fresh challenge.
      setTurnstileToken(null);
      setTurnstileKey((k) => k + 1);
      if (e instanceof ApiError && e.detail?.errors) {
        setError(e.detail.errors.join(' '));
      } else if (e instanceof ApiError) {
        setError(typeof e.detail === 'string' ? e.detail : e.message || 'Signup failed.');
      } else {
        setError('Could not reach the server. Check your connection.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-[#f5f4f1]">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-6 py-10">
          <View className="mb-8 items-center">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand-500">
              <Text className="text-2xl font-extrabold text-white">Հ</Text>
            </View>
            <Text className="mt-3 text-2xl font-extrabold text-stone-900">Create your account</Text>
            <Text className="mt-1 text-sm font-medium text-stone-500">14 days of Premium free — no card</Text>
          </View>

          <Text className="mb-1.5 text-sm font-bold text-stone-700">Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="your_username"
            placeholderTextColor="#a8a29e"
            className="mb-4 rounded-2xl bg-white px-4 py-3.5 text-base text-stone-900 ring-1 ring-stone-200"
          />

          <Text className="mb-1.5 text-sm font-bold text-stone-700">Email</Text>
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
            placeholder="At least 8 characters"
            placeholderTextColor="#a8a29e"
            className="mb-2 rounded-2xl bg-white px-4 py-3.5 text-base text-stone-900 ring-1 ring-stone-200"
          />

          <TurnstileChallenge
            key={turnstileKey}
            style={{ marginTop: 8 }}
            onVerify={setTurnstileToken}
          />

          {!!error && <Text className="mb-2 text-sm font-semibold text-cardinal-600">{error}</Text>}

          <Pressable3D
            onPress={submit}
            disabled={loading || !turnstileToken}
            className={'mt-4 items-center rounded-2xl py-4 ' + (turnstileToken ? 'bg-brand-500' : 'bg-stone-300')}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-extrabold text-white">Create account</Text>}
          </Pressable3D>

          <Pressable3D onPress={() => navigation.navigate('Login')} className="mt-5 items-center">
            <Text className="text-sm font-bold text-stone-500">
              Already have an account? <Text className="text-brand-600">Log in</Text>
            </Text>
          </Pressable3D>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
