// src/components/SocialSignInModal.js — Google/Telegram sign-in via a
// full-screen WebView that runs the web app's OWN, already-working OAuth
// flow. AuthCallback.jsx (/auth/google/callback) and TelegramCallback.jsx
// (/auth/telegram/callback) already do the real token exchange / HMAC
// verification and store the result in localStorage before redirecting to
// /dashboard or /onboarding — we don't re-implement any of that here, we
// just watch the WebView land on one of those two paths (meaning the web
// flow succeeded) and read the token straight out of localStorage via
// injected JS.
//
// Telegram specifically can't use a local HTML string the way
// TurnstileChallenge.js does — the Login Widget validates the page's origin
// against the domain configured in BotFather, so it has to load a real page
// served from haylingua.am (see src/MobileTelegramLogin.jsx on the web
// side, registered at /mobile/telegram-login).
import React, { useRef } from 'react';
import { Modal, View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { X } from 'lucide-react-native';
import Pressable3D from './Pressable3D';

const WEB_BASE = 'https://haylingua.am';
// PUBLIC value — same fallback web ships in src/LoginModal.jsx. OAuth
// security lives in the client *secret*, which stays server-side.
const GOOGLE_CLIENT_ID = '387340156498-udb3h083d3mcnj135kvbfcstsdslbe64.apps.googleusercontent.com';

function googleEntryUrl() {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${WEB_BASE}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

const PROVIDERS = {
  google: { label: 'Google', entryUrl: googleEntryUrl },
  telegram: { label: 'Telegram', entryUrl: () => `${WEB_BASE}/mobile/telegram-login` },
};

const EXTRACT_JS = `
(function () {
  var token = window.localStorage.getItem('access_token');
  var raw = window.localStorage.getItem('hay_user');
  var user = null;
  try { user = raw ? JSON.parse(raw) : null; } catch (e) {}
  window.ReactNativeWebView.postMessage(JSON.stringify({ token: token, user: user }));
})();
true;
`;

// Mount/unmount this whole component to open/close it (rather than a
// `visible` prop) so every open gets a fresh OAuth `state` and fresh nav
// tracking — provider is fixed for the component's lifetime.
export default function SocialSignInModal({ provider, onSuccess, onCancel }) {
  const config = PROVIDERS[provider];
  const webviewRef = useRef(null);
  // Two distinct guards: `extractingRef` stops us from re-injecting the
  // localStorage-read script on every subsequent nav-state event once we've
  // spotted arrival at /dashboard or /onboarding; `resultRef` stops
  // onSuccess/onCancel from ever firing twice (e.g. a stray nav-change
  // landing on "/" after the extract message already resolved things).
  const extractingRef = useRef(false);
  const resultRef = useRef(false);
  const entryUrlRef = useRef(config?.entryUrl());

  if (!config) return null;

  function finish(fn, arg) {
    if (resultRef.current) return;
    resultRef.current = true;
    fn(arg);
  }

  function handleNavChange(navState) {
    const { url, loading } = navState;
    if (loading || extractingRef.current || resultRef.current) return;
    if (url.startsWith(`${WEB_BASE}/dashboard`) || url.startsWith(`${WEB_BASE}/onboarding`)) {
      extractingRef.current = true;
      webviewRef.current?.injectJavaScript(EXTRACT_JS);
    } else if (url === `${WEB_BASE}/` || url === WEB_BASE) {
      // Bounced back to the landing page — the web flow hit an error and
      // its own "Back to home" already ran, or the user cancelled.
      finish(onCancel, 'Sign-in was cancelled or failed.');
    }
  }

  function handleMessage(event) {
    let payload;
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch {
      finish(onCancel, 'Sign-in failed — please try again.');
      return;
    }
    if (payload.token) {
      finish(() => onSuccess(payload.token, payload.user?.email || null));
    } else {
      finish(onCancel, 'Sign-in failed — please try again.');
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={() => finish(onCancel, null)}>
      <View className="flex-1 bg-white" style={{ paddingTop: 54 }}>
        <View className="flex-row items-center justify-between px-4 pb-3">
          <Text className="text-base font-extrabold text-stone-800">Continue with {config.label}</Text>
          <Pressable3D onPress={() => finish(onCancel, null)} pressDepth={2} className="h-8 w-8 items-center justify-center rounded-full bg-stone-100">
            <X size={16} color="#57534e" />
          </Pressable3D>
        </View>
        <WebView
          ref={webviewRef}
          source={{ uri: entryUrlRef.current }}
          onNavigationStateChange={handleNavChange}
          onMessage={handleMessage}
          startInLoadingState
          renderLoading={() => (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#FF7A1A" />
            </View>
          )}
        />
      </View>
    </Modal>
  );
}
