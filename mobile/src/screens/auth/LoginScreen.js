// src/screens/auth/LoginScreen.js — email/password login against the real
// backend (POST /login), plus Google/Telegram via SocialSignInModal (a
// WebView running the web app's own already-working OAuth flow — see that
// component for why). 2FA stays out of scope for Phase 0 — if the backend
// demands 2FA we surface a plain error pointing at the web app.
// Turnstile is adaptive (mirrors src/AuthModal.jsx's needsCaptcha flow): a
// normal login sends no token; only after the backend responds 403 with
// detail.requires_captcha do we show the challenge and retry with a token.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { api, ApiError } from '../../lib/api';
import { useAuthStore } from '../../lib/authStore';
import Pressable3D from '../../components/Pressable3D';
import TurnstileChallenge from '../../components/TurnstileChallenge';
import SocialSignInModal from '../../components/SocialSignInModal';
import { GoogleIcon, TelegramIcon } from '../../components/BrandIcons';

// Fade + slide-up entrance, staggered by `delay` — the same shape used
// across the app's other "first paint" moments (DashboardScreen's HeroCard,
// LessonCompleteScreen's stat tiles).
function FadeInUp({ delay = 0, children, style }) {
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withDelay(delay, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 14 }],
  }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

// Logo gets its own spring pop-in (bouncier than the fade-ups below it) and
// then settles into a slow, gentle idle float — the one thing on the screen
// that's still moving once everything else has landed.
function AnimatedLogo() {
  const enter = useSharedValue(0);
  const idle = useSharedValue(0);

  useEffect(() => {
    enter.value = withSpring(1, { damping: 9, stiffness: 120 });
    idle.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { scale: 0.5 + enter.value * 0.5 },
      { rotate: `${(1 - enter.value) * -25}deg` },
      { translateY: -idle.value * 6 },
    ],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <LinearGradient
        colors={['#FF9342', '#E11D48']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ height: 64, width: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text className="text-3xl font-extrabold text-white">Հ</Text>
      </LinearGradient>
    </Animated.View>
  );
}

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [socialProvider, setSocialProvider] = useState(null);
  const signIn = useAuthStore((s) => s.signIn);

  async function submit() {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (needsCaptcha && !turnstileToken) {
      setError('Complete the security check below.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(
        '/login',
        { email: email.trim(), password, turnstile_token: needsCaptcha ? turnstileToken : null },
        { auth: false }
      );
      await signIn(res.access_token, res.email);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.detail?.requires_2fa) {
          setError('This account has 2FA enabled — not supported in the app yet. Use haylingua.am to log in.');
        } else if (e.detail?.requires_captcha) {
          setNeedsCaptcha(true);
          setTurnstileToken(null);
          setTurnstileKey((k) => k + 1);
          setError('Security check required — complete the challenge below and try again.');
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

  async function handleSocialSuccess(token, socialEmail) {
    setSocialProvider(null);
    await signIn(token, socialEmail);
  }

  function handleSocialCancel(message) {
    setSocialProvider(null);
    if (message) setError(message);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
      <LinearGradient
        colors={['#FFF3EA', '#FFF8F3', '#f5f4f1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View className="flex-1 justify-center px-6">
        <View className="mb-7 items-center">
          <AnimatedLogo />
          <FadeInUp delay={220}>
            <Text className="mt-4 text-2xl font-extrabold text-stone-900">Welcome back</Text>
          </FadeInUp>
          <FadeInUp delay={300}>
            <Text className="mt-1 text-sm font-medium text-stone-500">Log in to keep your streak alive</Text>
          </FadeInUp>
        </View>

        <FadeInUp delay={380} style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
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
        </FadeInUp>

        <FadeInUp delay={420} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: '#e7e5e4' }} />
          <Text className="text-xs font-bold text-stone-400">OR</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#e7e5e4' }} />
        </FadeInUp>

        <FadeInUp delay={460}>
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
        </FadeInUp>

        <FadeInUp delay={520}>
          <Text className="mb-1.5 text-sm font-bold text-stone-700">Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="#a8a29e"
            className="mb-2 rounded-2xl bg-white px-4 py-3.5 text-base text-stone-900 ring-1 ring-stone-200"
          />
        </FadeInUp>

        {needsCaptcha && (
          <TurnstileChallenge key={turnstileKey} style={{ marginBottom: 12 }} onVerify={setTurnstileToken} />
        )}

        {!!error && <Text className="mb-2 text-sm font-semibold text-cardinal-600">{error}</Text>}

        <FadeInUp delay={580}>
          <Pressable3D
            onPress={submit}
            disabled={loading || (needsCaptcha && !turnstileToken)}
            className={'mt-4 items-center rounded-2xl py-4 ' + (needsCaptcha && !turnstileToken ? 'bg-stone-300' : 'bg-brand-500')}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-extrabold text-white">Log in</Text>}
          </Pressable3D>

          <Pressable3D onPress={() => navigation.navigate('Signup')} className="mt-5 items-center">
            <Text className="text-sm font-bold text-stone-500">
              Don&rsquo;t have an account? <Text className="text-brand-600">Sign up</Text>
            </Text>
          </Pressable3D>
        </FadeInUp>
      </View>

      {socialProvider && (
        <SocialSignInModal provider={socialProvider} onSuccess={handleSocialSuccess} onCancel={handleSocialCancel} />
      )}
    </KeyboardAvoidingView>
  );
}
