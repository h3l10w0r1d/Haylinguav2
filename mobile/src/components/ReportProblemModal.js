// src/components/ReportProblemModal.js — port of src/ReportProblem.jsx:
// POST /me/exercises/{id}/report with a reason + optional free-text detail.
// Best-effort — failures are swallowed, matching web (doesn't block learning).
import React, { useState } from 'react';
import { View, Text, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Check } from 'lucide-react-native';
import { api } from '../lib/api';
import Pressable3D from './Pressable3D';

const REASONS = [
  { key: 'wrong_answer', label: 'The correct answer is wrong' },
  { key: 'audio', label: 'Audio problem' },
  { key: 'typo', label: 'Typo or spelling' },
  { key: 'confusing', label: 'Confusing or unclear' },
  { key: 'other', label: 'Something else' },
];

export default function ReportProblemModal({ visible, exerciseId, onClose }) {
  const [reason, setReason] = useState(null);
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function reset() {
    setReason(null);
    setDetail('');
    setSent(false);
  }

  async function send() {
    if (!reason || sending) return;
    setSending(true);
    try {
      await api.post(`/me/exercises/${exerciseId}/report`, { reason, detail: detail.trim() || undefined });
    } catch {
      // best-effort — doesn't block learning
    } finally {
      setSending(false);
      setSent(true);
      setTimeout(() => {
        reset();
        onClose();
      }, 1100);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { reset(); onClose(); }}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full rounded-3xl bg-white p-6">
          {sent ? (
            <View className="items-center py-4">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-grass-50">
                <Check size={22} color="#58CC02" />
              </View>
              <Text className="mt-3 text-base font-extrabold text-stone-900">Thanks for the report!</Text>
            </View>
          ) : (
            <>
              <Text className="text-lg font-extrabold text-stone-900">Report a problem</Text>
              <View className="mt-4" style={{ gap: 8 }}>
                {REASONS.map((r) => (
                  <Pressable3D
                    key={r.key}
                    onPress={() => setReason(r.key)}
                    pressDepth={1}
                    className={'rounded-2xl px-4 py-3 ' + (reason === r.key ? 'bg-brand-500' : 'bg-stone-100')}
                  >
                    <Text className={'text-sm font-bold ' + (reason === r.key ? 'text-white' : 'text-stone-700')}>{r.label}</Text>
                  </Pressable3D>
                ))}
              </View>
              <TextInput
                value={detail}
                onChangeText={setDetail}
                placeholder="Add details (optional)"
                placeholderTextColor="#a8a29e"
                multiline
                numberOfLines={3}
                className="mt-3 rounded-2xl bg-stone-100 px-3.5 py-3 text-sm font-semibold text-stone-800"
                style={{ minHeight: 70, textAlignVertical: 'top' }}
              />
              <View className="mt-5 flex-row" style={{ gap: 10 }}>
                <Pressable3D onPress={() => { reset(); onClose(); }} pressDepth={2} className="flex-1 items-center rounded-2xl bg-stone-100 py-3.5">
                  <Text className="text-sm font-extrabold text-stone-600">Cancel</Text>
                </Pressable3D>
                <Pressable3D
                  onPress={send}
                  disabled={!reason || sending}
                  pressDepth={2}
                  className={'flex-1 items-center rounded-2xl py-3.5 ' + (reason ? 'bg-brand-500' : 'bg-stone-200')}
                >
                  {sending ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-extrabold text-white">Send</Text>}
                </Pressable3D>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
