// src/lib/haptics.js — thin wrapper around react-native-haptic-feedback so
// call sites never import the library directly (same defensive pattern as
// playExerciseAudio: never let a haptics failure crash the calling screen).
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const options = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

function safeTrigger(type) {
  try {
    ReactNativeHapticFeedback.trigger(type, options);
  } catch {
    // no-op — haptics are a nice-to-have, never worth crashing over
  }
}

export const haptics = {
  impact: () => safeTrigger('impactLight'),
  success: () => safeTrigger('notificationSuccess'),
  error: () => safeTrigger('notificationError'),
};
