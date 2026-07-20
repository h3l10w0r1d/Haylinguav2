// src/screens/profile/EditTab.js — first/last name, username, bio, privacy
// toggles, voice preference. One explicit Save button (PUT /me/profile) —
// avatar/banner/theme autosave elsewhere and never touch this form.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Switch, ActivityIndicator } from 'react-native';
import { api, ApiError } from '../../lib/api';
import Pressable3D from '../../components/Pressable3D';
import { haptics } from '../../lib/haptics';

const VOICE_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Random', label: 'Mix both' },
];

export default function EditTab({ profile, onSaved }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [friendsPublic, setFriendsPublic] = useState(true);
  const [isHidden, setIsHidden] = useState(false);
  const [voicePref, setVoicePref] = useState('Random');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name || '');
    setLastName(profile.last_name || '');
    setUsername(profile.username || '');
    setBio(profile.bio || '');
    setFriendsPublic(profile.friends_public !== false);
    setIsHidden(!!profile.is_hidden);
    setVoicePref(profile.voice_pref || 'Random');
  }, [profile]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await api.put('/me/profile', {
        first_name: firstName,
        last_name: lastName,
        username,
        bio,
        friends_public: friendsPublic,
        is_hidden: isHidden,
        voice_pref: voicePref,
      });
      onSaved(res);
      setMessage('Saved!');
      haptics.success();
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'Could not save changes.');
      haptics.error();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View>
      <Field label="First name">
        <TextInput value={firstName} onChangeText={setFirstName} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-stone-800" style={shadow} placeholderTextColor="#a8a29e" />
      </Field>
      <Field label="Last name">
        <TextInput value={lastName} onChangeText={setLastName} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-stone-800" style={shadow} placeholderTextColor="#a8a29e" />
      </Field>
      <Field label="Username">
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-stone-800"
          style={shadow}
          placeholder="your-username"
          placeholderTextColor="#a8a29e"
        />
        {!!username && <Text className="mt-1 text-xs font-semibold text-stone-400">haylingua.am/u/{username}</Text>}
      </Field>
      <Field label="Bio">
        <TextInput
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-stone-800"
          style={[shadow, { minHeight: 80, textAlignVertical: 'top' }]}
          placeholderTextColor="#a8a29e"
        />
      </Field>

      <ToggleRow label="Show friends list publicly" value={friendsPublic} onChange={setFriendsPublic} />
      <ToggleRow label="Hide my profile from search" value={isHidden} onChange={setIsHidden} />

      <Text className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wide text-stone-400">Exercise voice</Text>
      <View className="flex-row" style={{ gap: 8 }}>
        {VOICE_OPTIONS.map((opt) => (
          <View key={opt.value} className="flex-1">
            <Pressable3D
              onPress={() => setVoicePref(opt.value)}
              pressDepth={2}
              className={'items-center rounded-xl py-2.5 ' + (voicePref === opt.value ? 'bg-brand-500' : 'bg-white')}
              style={voicePref !== opt.value ? shadow : undefined}
            >
              <Text className={'text-xs font-bold ' + (voicePref === opt.value ? 'text-white' : 'text-stone-600')}>{opt.label}</Text>
            </Pressable3D>
          </View>
        ))}
      </View>

      {!!message && <Text className="mt-4 text-sm font-semibold text-stone-500">{message}</Text>}

      <Pressable3D onPress={save} disabled={saving} className="mt-5 items-center rounded-2xl bg-brand-500 py-4">
        {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-extrabold text-white">Save changes</Text>}
      </Pressable3D>
    </View>
  );
}

const shadow = { shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 };

function Field({ label, children }) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-stone-400">{label}</Text>
      {children}
    </View>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <View className="mb-3 flex-row items-center justify-between rounded-2xl bg-white px-4 py-3" style={shadow}>
      <Text className="flex-1 text-sm font-semibold text-stone-700">{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: '#FF7A1A', false: '#e7e5e4' }} thumbColor="#fff" />
    </View>
  );
}
