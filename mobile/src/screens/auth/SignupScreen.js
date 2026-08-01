// src/screens/auth/SignupScreen.js — real signup (POST /signup) followed by
// the email-verification step web has always gated the dashboard behind
// (src/Signup.jsx's step 1 -> step 2 flow) — POST /auth/verify-email with
// the code emailed to the user, POST /auth/resend-verification if it never
// arrives. Backend endpoints like /friends actively 403 unverified accounts
// (_require_verified in backend/routes.py), so signing the user straight
// into the app before verifying — which is what this screen used to do —
// left them stuck with broken API calls everywhere. signIn() now only
// fires once verification actually succeeds.
import React, { useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { api, ApiError } from '../../lib/api';
import { useAuthStore } from '../../lib/authStore';
import Pressable3D from '../../components/Pressable3D';
import TurnstileChallenge from '../../components/TurnstileChallenge';
import SocialSignInModal from '../../components/SocialSignInModal';
import { GoogleIcon, TelegramIcon } from '../../components/BrandIcons';

function VerifyEmailStep({ email, token, onVerified, onBack }) {
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function verify() {
    const trimmed = code.trim();
    if (trimmed.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setVerifyLoading(true);
    setError('');
    try {
      await api.post('/auth/verify-email', { code: trimmed }, { auth: false, headers: { Authorization: `Bearer ${token}` } });
      await onVerified();
    } catch (e) {
      const detail = e instanceof ApiError ? e.detail : null;
      if (detail === 'INVALID_CODE') setError('Invalid code. Please check and try again.');
      else if (detail === 'CODE_EXPIRED') setError('This code has expired. Request a new one below.');
      else if (detail === 'NO_CODE') setError('No verification code found. Request a new one below.');
      else if (detail === 'TOO_MANY_ATTEMPTS') setError('Too many failed attempts. Request a new code.');
      else setError(typeof detail === 'string' ? detail : 'Verification failed. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  }

  async function resend() {
    if (cooldown > 0) return;
    setVerifyLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/resend-verification', undefined, { auth: false, headers: { Authorization: `Bearer ${token}` } });
      if (res?.verification_code) setDevCode(res.verification_code);
      setCooldown(Number(res?.retry_after_s) || 60);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        const seconds = Number(e.detail?.retry_after_s) || 60;
        setCooldown(seconds);
        setError(`Please wait ${seconds}s before requesting another code.`);
      } else if (e instanceof ApiError && e.detail === 'ALREADY_VERIFIED') {
        await onVerified();
      } else {
        setError('Could not resend the code. Please try again.');
      }
    } finally {
      setVerifyLoading(false);
    }
  }

  return (
    <View className="flex-1 justify-center px-6 py-10">
      <View className="mb-8 items-center">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand-500">
          <Text className="text-2xl font-extrabold text-white">Հ</Text>
        </View>
        <Text className="mt-3 text-2xl font-extrabold text-stone-900">Verify your email</Text>
        <Text className="mt-1 text-center text-sm font-medium text-stone-500">
          We sent a 6-digit code to{'\n'}
          <Text className="font-bold text-stone-700">{email}</Text>
        </Text>
      </View>

      {!!devCode && (
        <View className="mb-4 rounded-2xl bg-gold-50 p-4">
          <Text className="text-xs font-extrabold uppercase tracking-wide text-gold-700">Dev mode — email sending not configured</Text>
          <View className="mt-2 items-center rounded-xl bg-white py-3">
            <Text className="text-2xl font-extrabold tracking-[0.3em] text-stone-900">{devCode}</Text>
          </View>
          <Pressable3D onPress={() => setCode(devCode)} pressDepth={2} className="mt-2 items-center rounded-xl bg-gold-600 py-2.5">
            <Text className="text-sm font-extrabold text-white">Use this code</Text>
          </Pressable3D>
        </View>
      )}

      <TextInput
        value={code}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, 6);
          setCode(digits);
          if (error && digits.length === 6) setError('');
        }}
        placeholder="000000"
        placeholderTextColor="#a8a29e"
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        className="mb-2 rounded-2xl bg-white px-4 py-4 text-center text-2xl font-extrabold tracking-[0.3em] text-stone-900 ring-1 ring-stone-200"
      />

      {!!error && <Text className="mb-2 text-sm font-semibold text-cardinal-600">{error}</Text>}

      <Pressable3D
        onPress={verify}
        disabled={verifyLoading || code.length !== 6}
        className={'mt-4 items-center rounded-2xl py-4 ' + (code.length === 6 ? 'bg-brand-500' : 'bg-stone-300')}
      >
        {verifyLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-extrabold text-white">Verify email</Text>}
      </Pressable3D>

      <Pressable3D onPress={resend} disabled={verifyLoading || cooldown > 0} className="mt-4 items-center">
        <Text className="text-sm font-bold text-stone-500">
          {cooldown > 0 ? `Resend code (${cooldown}s)` : "Didn't get it? "}
          {cooldown === 0 && <Text className="text-brand-600">Resend code</Text>}
        </Text>
      </Pressable3D>

      <Pressable3D onPress={onBack} className="mt-2 items-center">
        <Text className="text-xs font-bold text-stone-400">Back to sign up</Text>
      </Pressable3D>
    </View>
  );
}

export default function SignupScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [socialProvider, setSocialProvider] = useState(null);
  const [pendingVerify, setPendingVerify] = useState(null); // { token, email }
  const signIn = useAuthStore((s) => s.signIn);

  async function handleSocialSuccess(token, socialEmail) {
    setSocialProvider(null);
    await signIn(token, socialEmail);
  }

  function handleSocialCancel(message) {
    setSocialProvider(null);
    if (message) setError(message);
  }

  async function submit() {
    setError('');
    setLoading(true);
    try {
      const res = await api.post(
        '/signup',
        { username: username.trim(), email: email.trim(), password, turnstile_token: turnstileToken },
        { auth: false }
      );
      setPendingVerify({ token: res.access_token, email: res.email || email.trim(), devCode: res.verification_code || '' });
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

  if (pendingVerify) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-[#f5f4f1]">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <VerifyEmailStep
            email={pendingVerify.email}
            token={pendingVerify.token}
            onVerified={() => signIn(pendingVerify.token, pendingVerify.email)}
            onBack={() => setPendingVerify(null)}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
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

          <View className="mb-4 flex-row" style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Pressable3D
                onPress={() => setSocialProvider('google')}
                pressDepth={2}
                className="flex-row items-center justify-center rounded-2xl bg-white py-3.5"
                style={{ borderWidth: 1, borderColor: '#e7e5e4' }}
              >
                <GoogleIcon size={17} />
                <Text className="text-sm font-bold text-stone-700" style={{ marginLeft: 8 }}>Google</Text>
              </Pressable3D>
            </View>
            <View style={{ flex: 1 }}>
              <Pressable3D
                onPress={() => setSocialProvider('telegram')}
                pressDepth={2}
                className="flex-row items-center justify-center rounded-2xl bg-white py-3.5"
                style={{ borderWidth: 1, borderColor: '#e7e5e4' }}
              >
                <TelegramIcon size={17} />
                <Text className="text-sm font-bold text-stone-700" style={{ marginLeft: 8 }}>Telegram</Text>
              </Pressable3D>
            </View>
          </View>

          <View className="mb-4 flex-row items-center" style={{ gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e7e5e4' }} />
            <Text className="text-xs font-bold text-stone-400">OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e7e5e4' }} />
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
      {socialProvider && (
        <SocialSignInModal provider={socialProvider} onSuccess={handleSocialSuccess} onCancel={handleSocialCancel} />
      )}
    </KeyboardAvoidingView>
  );
}
