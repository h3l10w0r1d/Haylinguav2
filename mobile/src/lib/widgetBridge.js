// src/lib/widgetBridge.js — pushes streak/XP/hearts into the shared App
// Group UserDefaults suite so the HaylinguaWidget (WidgetKit extension,
// ios/HaylinguaWidget/HaylinguaWidget.swift) has something to show. The
// widget never talks to the network itself — it only ever reads what the
// app last wrote here, on whatever timeline WidgetKit decides to render.
import { Platform } from 'react-native';
import SharedGroupPreferences from 'react-native-shared-group-preferences';

// Must match the app group string in both HaylinguaMobile.entitlements and
// HaylinguaWidget.entitlements exactly, or the widget reads nothing.
const APP_GROUP = 'group.org.reactjs.native.example.HaylinguaMobile.shared';

export function writeWidgetStats({ streak, totalXp, heartsCurrent, isPremium }) {
  if (Platform.OS !== 'ios') return;
  const entries = [
    ['streak', streak],
    ['totalXp', totalXp],
    ['heartsCurrent', heartsCurrent],
    ['isPremium', isPremium],
  ];
  for (const [key, value] of entries) {
    if (value == null) continue;
    SharedGroupPreferences.setItem(key, value, APP_GROUP).catch(() => {
      // non-fatal — the widget just shows stale/placeholder data until
      // the next successful write
    });
  }
}
