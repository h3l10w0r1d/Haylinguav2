// src/lib/defaultFont.js — side-effect-only module, imported once from
// App.js. Sets Nunito-Bold as the fallback font for every <Text> in the
// app (matching how bold/chunky the web app's Nunito-driven type generally
// reads), instead of the OS system font every screen was silently
// rendering in — the app's tailwind.config.js has referenced
// BalooTwo-ExtraBold/Nunito-* font-family classes since day one, but the
// actual .ttf files were never bundled/linked into the iOS project, so
// those classes always fell through to the platform default with no error.
// A NativeWind class that sets its own fontFamily (font-display,
// font-sans, font-sans-extrabold, ...) always wins over this default —
// this only fills in text that never asked for a specific family.
import { Text } from 'react-native';

Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = [{ fontFamily: 'Nunito-Bold' }, Text.defaultProps.style];
