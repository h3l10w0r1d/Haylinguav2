// src/screens/profile/SecurityTab.js — email/password change, 2FA setup,
// Telegram linking, and the account danger zone (export/delete). Mirrors
// src/ProfilePage.jsx's Security tab, minus Google/Facebook linking (needs
// its own iOS OAuth client credentials the user doesn't have yet — shown
// but disabled, not hidden, so the gap is visible).
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Modal, ActivityIndicator, Image, Share, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { Mail, Lock, ShieldCheck, Send, Download, Trash2, KeyRound, Link2, AlertTriangle } from 'lucide-react-native';
import { api, ApiError } from '../../lib/api';
import { useAuthStore } from '../../lib/authStore';
import Pressable3D from '../../components/Pressable3D';
import { haptics } from '../../lib/haptics';

const TELEGRAM_BOT_USERNAME = 'haylinguabot';

function SectionButton({ icon: Icon, label, sub, onPress, tone = 'default', disabled }) {
  return (
    <Pressable3D
      onPress={onPress}
      disabled={disabled}
      className="mb-2 flex-row items-center gap-3 rounded-2xl bg-white px-4 py-3.5"
      style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1, opacity: disabled ? 0.5 : 1 }}
    >
      <View className={'h-9 w-9 items-center justify-center rounded-full ' + (tone === 'danger' ? 'bg-cardinal-50' : 'bg-feather-50')}>
        <Icon size={16} color={tone === 'danger' ? '#E11D48' : '#1899D6'} />
      </View>
      <View className="flex-1">
        <Text className={'text-sm font-bold ' + (tone === 'danger' ? 'text-cardinal-600' : 'text-stone-800')}>{label}</Text>
        {!!sub && <Text className="text-xs font-semibold text-stone-400">{sub}</Text>}
      </View>
    </Pressable3D>
  );
}

function ModalCard({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full rounded-3xl bg-white p-5">
          <Text className="mb-3 text-lg font-extrabold text-stone-900">{title}</Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const inputStyle = 'mb-3 rounded-xl bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-800';

export default function SecurityTab({ profile }) {
  const signOut = useAuthStore((s) => s.signOut);

  const [twoFa, setTwoFa] = useState(null); // { enabled }
  useEffect(() => {
    api.get('/me/2fa/status').then(setTwoFa).catch(() => setTwoFa({ enabled: false }));
  }, []);

  const [telegramId, setTelegramId] = useState(profile?.telegram_id ?? null);
  useEffect(() => setTelegramId(profile?.telegram_id ?? null), [profile?.telegram_id]);

  // ---- Change email ----
  const [emailModal, setEmailModal] = useState(false);
  const [emailStage, setEmailStage] = useState('start'); // start | confirm
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');

  async function startEmailChange() {
    if (!newEmail.trim() || emailBusy) return;
    setEmailBusy(true);
    setEmailMsg('');
    try {
      const res = await api.post('/me/change-email/start', { new_email: newEmail.trim() });
      setEmailStage('confirm');
      setEmailMsg(res.verification_code ? `Dev code: ${res.verification_code}` : 'Check your new inbox for a code.');
    } catch (e) {
      setEmailMsg(e instanceof ApiError ? e.message : 'Could not start email change.');
    } finally {
      setEmailBusy(false);
    }
  }

  async function confirmEmailChange() {
    if (!emailCode.trim() || emailBusy) return;
    setEmailBusy(true);
    setEmailMsg('');
    try {
      await api.post('/me/change-email/confirm', { code: emailCode.trim() });
      haptics.success();
      setEmailModal(false);
      setEmailStage('start');
      setNewEmail('');
      setEmailCode('');
    } catch (e) {
      setEmailMsg(e instanceof ApiError ? e.message : 'Invalid code.');
      haptics.error();
    } finally {
      setEmailBusy(false);
    }
  }

  // ---- Change password ----
  const [pwModal, setPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  async function changePassword() {
    if (pwBusy) return;
    if (newPw !== newPw2) {
      setPwMsg("New passwords don't match.");
      return;
    }
    setPwBusy(true);
    setPwMsg('');
    try {
      await api.post('/me/change-password', { current_password: currentPw, new_password: newPw });
      haptics.success();
      setPwModal(false);
      setCurrentPw('');
      setNewPw('');
      setNewPw2('');
    } catch (e) {
      setPwMsg(e instanceof ApiError ? e.message : 'Could not change password.');
      haptics.error();
    } finally {
      setPwBusy(false);
    }
  }

  // ---- 2FA ----
  const [twoFaModal, setTwoFaModal] = useState(false);
  const [twoFaStage, setTwoFaStage] = useState('idle'); // idle | qr | recovery
  const [qrData, setQrData] = useState(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState('');
  const [disablePw, setDisablePw] = useState('');

  async function open2fa() {
    setTwoFaMsg('');
    setTwoFaStage('idle');
    setTwoFaModal(true);
  }

  async function start2faSetup() {
    setTwoFaBusy(true);
    try {
      const res = await api.post('/me/2fa/setup');
      setQrData(res);
      setTwoFaStage('qr');
    } catch (e) {
      setTwoFaMsg(e instanceof ApiError ? e.message : 'Could not start 2FA setup.');
    } finally {
      setTwoFaBusy(false);
    }
  }

  async function confirm2fa() {
    if (!twoFaCode.trim() || twoFaBusy) return;
    setTwoFaBusy(true);
    try {
      const res = await api.post('/me/2fa/confirm', { code: twoFaCode.trim() });
      setRecoveryCodes(res.recovery_codes || []);
      setTwoFaStage('recovery');
      setTwoFa({ enabled: true });
      haptics.success();
    } catch (e) {
      setTwoFaMsg(e instanceof ApiError ? e.message : 'Invalid code.');
      haptics.error();
    } finally {
      setTwoFaBusy(false);
    }
  }

  async function disable2fa() {
    setTwoFaBusy(true);
    try {
      await api.post('/me/2fa/disable', { code: twoFaCode.trim(), current_password: disablePw });
      setTwoFa({ enabled: false });
      setTwoFaModal(false);
      haptics.success();
    } catch (e) {
      setTwoFaMsg(e instanceof ApiError ? e.message : 'Could not disable 2FA.');
      haptics.error();
    } finally {
      setTwoFaBusy(false);
    }
  }

  // ---- Telegram (best-effort: reuses Telegram's own login widget script
  // inside a WebView, bridging its callback out via postMessage) ----
  const [tgModal, setTgModal] = useState(false);
  const tgHtml = `
    <html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#fff;">
      <script>
        window.onTelegramLink = function(user) {
          window.ReactNativeWebView.postMessage(JSON.stringify(user));
        };
      </script>
      <script async src="https://telegram.org/js/telegram-widget.js?22"
        data-telegram-login="${TELEGRAM_BOT_USERNAME}"
        data-size="large"
        data-onauth="onTelegramLink(user)"
        data-request-access="write"></script>
    </body></html>
  `;

  async function onTelegramMessage(event) {
    try {
      const tgUser = JSON.parse(event.nativeEvent.data);
      await api.post('/me/link/telegram', tgUser);
      setTelegramId(Number(tgUser.id) || null);
      setTgModal(false);
      haptics.success();
    } catch {
      haptics.error();
    }
  }

  async function unlinkTelegram() {
    try {
      await api.delete('/me/link/telegram');
      setTelegramId(null);
      haptics.impact();
    } catch {
      haptics.error();
    }
  }

  // ---- Danger zone ----
  const [exporting, setExporting] = useState(false);
  async function exportData() {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await api.get('/me/export');
      await Share.share({ message: JSON.stringify(data) });
    } catch {
      haptics.error();
    } finally {
      setExporting(false);
    }
  }

  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePw, setDeletePw] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');

  async function deleteAccount() {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteMsg('');
    try {
      await api.post('/me/delete', { password: deletePw });
      await signOut();
    } catch (e) {
      setDeleteMsg(e instanceof ApiError ? e.message : 'Could not delete account.');
      haptics.error();
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <View>
      <View className="mb-2 flex-row items-center gap-2">
        <KeyRound size={14} color="#a8a29e" />
        <Text className="text-xs font-extrabold uppercase tracking-wide text-stone-400">Account</Text>
      </View>
      <SectionButton icon={Mail} label="Change email" sub={profile?.email} onPress={() => setEmailModal(true)} />
      <SectionButton icon={Lock} label="Change password" onPress={() => setPwModal(true)} />
      <SectionButton
        icon={ShieldCheck}
        label={twoFa?.enabled ? 'Two-factor authentication: On' : 'Set up two-factor authentication'}
        onPress={open2fa}
      />

      <View className="mb-2 mt-5 flex-row items-center gap-2">
        <Link2 size={14} color="#a8a29e" />
        <Text className="text-xs font-extrabold uppercase tracking-wide text-stone-400">Linked accounts</Text>
      </View>
      {telegramId ? (
        <SectionButton icon={Send} label="Telegram linked" sub={`ID ${telegramId}`} onPress={unlinkTelegram} />
      ) : (
        <SectionButton icon={Send} label="Link Telegram" onPress={() => setTgModal(true)} />
      )}
      <SectionButton icon={Send} label="Google — not available in the app yet" disabled />
      <SectionButton icon={Send} label="Facebook — not available in the app yet" disabled />

      <View className="mb-2 mt-5 flex-row items-center gap-2">
        <AlertTriangle size={14} color="#FF4B4B" />
        <Text className="text-xs font-extrabold uppercase tracking-wide text-cardinal-500">Danger zone</Text>
      </View>
      <SectionButton icon={Download} label="Export my data" onPress={exportData} disabled={exporting} />
      <SectionButton icon={Trash2} label="Delete account" tone="danger" onPress={() => setDeleteModal(true)} />

      {/* Change email */}
      <ModalCard visible={emailModal} onClose={() => setEmailModal(false)} title="Change email">
        {emailStage === 'start' ? (
          <>
            <TextInput value={newEmail} onChangeText={setNewEmail} placeholder="New email" autoCapitalize="none" keyboardType="email-address" className={inputStyle} placeholderTextColor="#a8a29e" />
            {!!emailMsg && <Text className="mb-3 text-xs font-semibold text-stone-500">{emailMsg}</Text>}
            <Pressable3D onPress={startEmailChange} disabled={emailBusy} className="items-center rounded-2xl bg-brand-500 py-3.5">
              {emailBusy ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-extrabold text-white">Send code</Text>}
            </Pressable3D>
          </>
        ) : (
          <>
            <TextInput value={emailCode} onChangeText={setEmailCode} placeholder="6-digit code" keyboardType="number-pad" className={inputStyle} placeholderTextColor="#a8a29e" />
            {!!emailMsg && <Text className="mb-3 text-xs font-semibold text-stone-500">{emailMsg}</Text>}
            <Pressable3D onPress={confirmEmailChange} disabled={emailBusy} className="items-center rounded-2xl bg-brand-500 py-3.5">
              {emailBusy ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-extrabold text-white">Confirm</Text>}
            </Pressable3D>
          </>
        )}
        <Pressable3D onPress={() => setEmailModal(false)} className="mt-2 items-center py-2">
          <Text className="text-sm font-bold text-stone-400">Cancel</Text>
        </Pressable3D>
      </ModalCard>

      {/* Change password */}
      <ModalCard visible={pwModal} onClose={() => setPwModal(false)} title="Change password">
        <TextInput value={currentPw} onChangeText={setCurrentPw} placeholder="Current password" secureTextEntry className={inputStyle} placeholderTextColor="#a8a29e" />
        <TextInput value={newPw} onChangeText={setNewPw} placeholder="New password" secureTextEntry className={inputStyle} placeholderTextColor="#a8a29e" />
        <TextInput value={newPw2} onChangeText={setNewPw2} placeholder="Repeat new password" secureTextEntry className={inputStyle} placeholderTextColor="#a8a29e" />
        {!!pwMsg && <Text className="mb-3 text-xs font-semibold text-stone-500">{pwMsg}</Text>}
        <Pressable3D onPress={changePassword} disabled={pwBusy} className="items-center rounded-2xl bg-brand-500 py-3.5">
          {pwBusy ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-extrabold text-white">Update password</Text>}
        </Pressable3D>
        <Pressable3D onPress={() => setPwModal(false)} className="mt-2 items-center py-2">
          <Text className="text-sm font-bold text-stone-400">Cancel</Text>
        </Pressable3D>
      </ModalCard>

      {/* 2FA */}
      <ModalCard visible={twoFaModal} onClose={() => setTwoFaModal(false)} title="Two-factor authentication">
        {twoFa?.enabled && twoFaStage === 'idle' ? (
          <>
            <Text className="mb-3 text-sm font-semibold text-stone-500">Enter a current code or your password to disable.</Text>
            <TextInput value={twoFaCode} onChangeText={setTwoFaCode} placeholder="Authenticator code" keyboardType="number-pad" className={inputStyle} placeholderTextColor="#a8a29e" />
            <TextInput value={disablePw} onChangeText={setDisablePw} placeholder="Or current password" secureTextEntry className={inputStyle} placeholderTextColor="#a8a29e" />
            {!!twoFaMsg && <Text className="mb-3 text-xs font-semibold text-stone-500">{twoFaMsg}</Text>}
            <Pressable3D onPress={disable2fa} disabled={twoFaBusy} className="items-center rounded-2xl bg-cardinal-500 py-3.5">
              {twoFaBusy ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-extrabold text-white">Disable 2FA</Text>}
            </Pressable3D>
          </>
        ) : twoFaStage === 'idle' ? (
          <>
            <Text className="mb-3 text-sm font-semibold text-stone-500">Protect your account with an authenticator app.</Text>
            <Pressable3D onPress={start2faSetup} disabled={twoFaBusy} className="items-center rounded-2xl bg-brand-500 py-3.5">
              {twoFaBusy ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-extrabold text-white">Start setup</Text>}
            </Pressable3D>
          </>
        ) : twoFaStage === 'qr' ? (
          <>
            {!!qrData?.qr_png && <Image source={{ uri: qrData.qr_png }} style={{ width: 180, height: 180, alignSelf: 'center', marginBottom: 12 }} />}
            <Text className="mb-3 text-center text-xs font-semibold text-stone-400">{qrData?.secret}</Text>
            <TextInput value={twoFaCode} onChangeText={setTwoFaCode} placeholder="Enter the 6-digit code" keyboardType="number-pad" className={inputStyle} placeholderTextColor="#a8a29e" />
            {!!twoFaMsg && <Text className="mb-3 text-xs font-semibold text-stone-500">{twoFaMsg}</Text>}
            <Pressable3D onPress={confirm2fa} disabled={twoFaBusy} className="items-center rounded-2xl bg-brand-500 py-3.5">
              {twoFaBusy ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-extrabold text-white">Confirm</Text>}
            </Pressable3D>
          </>
        ) : (
          <>
            <Text className="mb-3 text-sm font-semibold text-stone-500">Save these recovery codes somewhere safe — each works once.</Text>
            <View className="mb-3 flex-row flex-wrap" style={{ gap: 6 }}>
              {(recoveryCodes || []).map((c) => (
                <View key={c} className="rounded-lg bg-stone-100 px-2 py-1">
                  <Text className="text-xs font-bold text-stone-700">{c}</Text>
                </View>
              ))}
            </View>
            <Pressable3D onPress={() => setTwoFaModal(false)} className="items-center rounded-2xl bg-brand-500 py-3.5">
              <Text className="text-sm font-extrabold text-white">Done</Text>
            </Pressable3D>
          </>
        )}
        {twoFaStage === 'idle' && (
          <Pressable3D onPress={() => setTwoFaModal(false)} className="mt-2 items-center py-2">
            <Text className="text-sm font-bold text-stone-400">Close</Text>
          </Pressable3D>
        )}
      </ModalCard>

      {/* Telegram WebView */}
      <Modal visible={tgModal} animationType="slide" onRequestClose={() => setTgModal(false)}>
        <View className="flex-1 bg-white pt-14">
          <Pressable3D onPress={() => setTgModal(false)} className="mx-4 mb-2 items-start">
            <Text className="text-sm font-bold text-stone-500">Close</Text>
          </Pressable3D>
          <WebView originWhitelist={['*']} source={{ html: tgHtml }} onMessage={onTelegramMessage} style={{ flex: 1 }} />
        </View>
      </Modal>

      {/* Delete account */}
      <ModalCard visible={deleteModal} onClose={() => setDeleteModal(false)} title="Delete account">
        <Text className="mb-3 text-sm font-semibold text-stone-500">
          This permanently deletes your account and all data. Type DELETE and enter your password to confirm.
        </Text>
        <TextInput value={deleteConfirmText} onChangeText={setDeleteConfirmText} placeholder="Type DELETE" autoCapitalize="characters" className={inputStyle} placeholderTextColor="#a8a29e" />
        <TextInput value={deletePw} onChangeText={setDeletePw} placeholder="Password" secureTextEntry className={inputStyle} placeholderTextColor="#a8a29e" />
        {!!deleteMsg && <Text className="mb-3 text-xs font-semibold text-cardinal-600">{deleteMsg}</Text>}
        <Pressable3D
          onPress={() => Alert.alert('Delete account?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: deleteAccount }])}
          disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deleteBusy}
          className={'items-center rounded-2xl py-3.5 ' + (deleteConfirmText.trim().toUpperCase() === 'DELETE' ? 'bg-cardinal-500' : 'bg-stone-300')}
        >
          {deleteBusy ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-extrabold text-white">Delete my account</Text>}
        </Pressable3D>
        <Pressable3D onPress={() => setDeleteModal(false)} className="mt-2 items-center py-2">
          <Text className="text-sm font-bold text-stone-400">Cancel</Text>
        </Pressable3D>
      </ModalCard>
    </View>
  );
}
