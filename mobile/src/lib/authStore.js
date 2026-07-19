// src/lib/authStore.js — JWT storage (Keychain, the RN equivalent of the
// web's localStorage `hay_token`) + a tiny Zustand slice for auth state.
// RN has no `window`, so this store is also what replaces the web's
// window.dispatchEvent/addEventListener cross-component sync pattern for
// anything auth-related.
import * as Keychain from 'react-native-keychain';
import { create } from 'zustand';

const SERVICE = 'haylingua.auth';

export async function getToken() {
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    return creds ? creds.password : null;
  } catch {
    return null;
  }
}

async function persistToken(token) {
  if (token) {
    await Keychain.setGenericPassword('hay_token', token, { service: SERVICE });
  } else {
    await Keychain.resetGenericPassword({ service: SERVICE });
  }
}

export const useAuthStore = create((set) => ({
  status: 'loading', // 'loading' | 'signedOut' | 'signedIn'
  token: null,
  email: null,

  async bootstrap() {
    const token = await getToken();
    set({ token, status: token ? 'signedIn' : 'signedOut' });
  },

  async signIn(token, email) {
    await persistToken(token);
    set({ token, email, status: 'signedIn' });
  },

  async signOut() {
    await persistToken(null);
    set({ token: null, email: null, status: 'signedOut' });
  },
}));
