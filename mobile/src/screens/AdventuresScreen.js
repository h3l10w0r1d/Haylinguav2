// src/screens/AdventuresScreen.js — Adventures is a Phaser (Canvas/DOM)
// game on web with zero RN-native equivalent, so this embeds the real web
// experience in a WebView instead of reimplementing a game engine in RN —
// 100% reuse of the existing Phaser scenes/Kenney art, zero duplication.
//
// Auth: web's own AppShell (src/App.jsx) only restores a session when
// BOTH `hay_token` AND a `hay_user` JSON blob are present in localStorage
// (checked together in one effect) — a token alone leaves `user` null
// forever and RequireVerified/RequireOnboarded immediately bounce to `/`
// (confirmed live: injecting just hay_token loaded the logged-out landing
// page). So this fetches /me/profile first and seeds a `hay_user` object
// shaped like the one web's own login flow writes, not just the token.
// injectedJavaScriptBeforeContentLoaded runs before the page's own scripts,
// so both are in place before AppShell's mount-time localStorage read.
//
// Completion signal: AdventurePlayer.jsx's fireWin() now also calls
// window.ReactNativeWebView?.postMessage(...) (a one-line web addition,
// a no-op on real browsers) — that's what onMessage below listens for.
//
// Deep-linking straight to /adventures on the very first load raced
// AppShell's own localStorage-read effect in testing (landed on the
// logged-out page even with both keys seeded) — so this loads `/` first,
// lets AppShell finish its normal auth boot there, then navigates to
// /adventures via injectJavaScript once that's already-authenticated app
// is stable, exactly like a real user clicking a nav link would.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ArrowLeft } from 'lucide-react-native';
import { getToken } from '../lib/authStore';
import { api, WEB_BASE_URL } from '../lib/api';
import { useStatsStore } from '../lib/statsStore';
import Pressable3D from '../components/Pressable3D';
import { haptics } from '../lib/haptics';

export default function AdventuresScreen({ navigation }) {
  const [session, setSession] = useState(undefined); // undefined = not fetched yet; null = failed
  const [webLoading, setWebLoading] = useState(true);
  const webRef = useRef(null);
  const navigatedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const [t, profile] = await Promise.all([
        getToken(),
        api.get('/me/profile').catch(() => null),
      ]);
      if (!t || !profile) {
        setSession(null);
        return;
      }
      setSession({
        token: t,
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.display_name || profile.username || (profile.email || '').split('@')[0],
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          avatarUrl: profile.avatar_url || '',
          level: 1,
          xp: 0,
          streak: profile.best_streak || 0,
          completedLessons: [],
          email_verified: !!profile.email_verified,
        },
      });
    })();
  }, []);

  function handleMessage(event) {
    let payload;
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (payload?.type === 'adventure_complete') {
      haptics.success();
      useStatsStore.getState().refresh();
      Alert.alert(
        'Adventure complete!',
        `${'⭐'.repeat(payload.stars || 0)}${payload.awardedXp ? ` · +${payload.awardedXp} XP` : ''}`
      );
    }
  }

  const injectedJavaScriptBeforeContentLoaded = session
    ? `
      window.localStorage.setItem('hay_token', ${JSON.stringify(session.token)});
      window.localStorage.setItem('access_token', ${JSON.stringify(session.token)});
      window.localStorage.setItem('hay_user', ${JSON.stringify(JSON.stringify(session.user))});
      true;
    `
    : undefined;

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-3">
        <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-white">
          <ArrowLeft size={18} color="#57534e" />
        </Pressable3D>
        <Text className="text-xl font-extrabold text-stone-900 font-display">Adventures</Text>
      </View>

      {session === undefined ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF7A1A" />
        </View>
      ) : session === null ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-base font-semibold text-stone-500">Could not load Adventures. Please check your connection and try again.</Text>
        </View>
      ) : (
        <View className="flex-1">
          <WebView
            ref={webRef}
            source={{ uri: WEB_BASE_URL }}
            injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
            onMessage={handleMessage}
            onLoadEnd={() => {
              setWebLoading(false);
              if (!navigatedRef.current) {
                navigatedRef.current = true;
                webRef.current?.injectJavaScript("window.location.assign('/adventures'); true;");
              }
            }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            style={{ flex: 1, backgroundColor: '#f5f4f1' }}
          />
          {webLoading && (
            <View className="absolute inset-0 items-center justify-center bg-[#f5f4f1]">
              <ActivityIndicator size="large" color="#FF7A1A" />
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
