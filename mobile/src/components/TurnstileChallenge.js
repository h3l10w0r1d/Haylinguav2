// src/components/TurnstileChallenge.js — Cloudflare Turnstile has no
// official React Native SDK, so this hosts the same widget web uses
// (src/lib/Turnstile.jsx) inside a WebView: a tiny local HTML page loads
// Cloudflare's turnstile script, renders the challenge, and posts the
// resulting token back to RN via window.ReactNativeWebView.postMessage.
//
// SITE_KEY is a PUBLIC value (Turnstile's security lives in the secret key,
// verified server-side in backend/routes.py's _verify_turnstile) — safe to
// hardcode, but this is the fallback "always passes" Cloudflare test key.
// Replace with the real production site key (same one src/lib/Turnstile.jsx
// uses via VITE_TURNSTILE_SITE_KEY) before shipping.
import React, { useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

const SITE_KEY = '1x00000000000000000000AA'; // TODO: swap for the real production site key

const HTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body { margin: 0; padding: 0; background: transparent; display: flex; align-items: center; justify-content: center; }
    </style>
  </head>
  <body>
    <div id="cf-turnstile"></div>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
    <script>
      function post(msg) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
      function render() {
        if (!window.turnstile) { setTimeout(render, 100); return; }
        window.turnstile.render('#cf-turnstile', {
          sitekey: '${SITE_KEY}',
          callback: function (token) { post({ type: 'verify', token: token }); },
          'expired-callback': function () { post({ type: 'expired' }); },
          'error-callback': function () { post({ type: 'error' }); },
        });
      }
      render();
    </script>
  </body>
</html>
`;

export default function TurnstileChallenge({ onVerify, style }) {
  const webviewRef = useRef(null);

  function handleMessage(event) {
    let payload;
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (payload.type === 'verify') onVerify?.(payload.token);
    else onVerify?.(null);
  }

  return (
    <View style={[{ height: 76, borderRadius: 12, overflow: 'hidden' }, style]}>
      <WebView
        ref={webviewRef}
        source={{ html: HTML }}
        onMessage={handleMessage}
        style={{ backgroundColor: 'transparent' }}
        startInLoadingState
        renderLoading={() => (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color="#FF7A1A" />
          </View>
        )}
      />
    </View>
  );
}
