/**
 * Haylingua — React Native app, Phase 0.
 * @format
 */
import './global.css';
import './src/lib/defaultFont';
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { Sentry, initSentry } from './src/lib/sentry';

initSentry();

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f4f1" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
