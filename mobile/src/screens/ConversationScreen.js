// src/screens/ConversationScreen.js — port of src/AIConversation.jsx: pick
// a scenario, then a turn-based roleplay with the "aram" character (the
// only one that exists today). No real video ever generates server-side
// (video_url/video_prediction_id always come back null — confirmed dead
// code from an old SadTalker integration web itself no longer uses either),
// so this is audio + a static portrait, matching web's actual current UI
// rather than its stale-but-still-declared video fields.
//
// Web's continuous voice-activity-detection auto-record loop isn't ported
// — that needs a real-time audio-level analyzer RN has no built-in
// equivalent for. Mobile uses the same tap-to-record/tap-to-stop pattern
// already established in exercises/kinds/Speak.js instead, with a typed
// fallback exactly like web has.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Image, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Sound from 'react-native-nitro-sound';
import { ArrowLeft, Mic, Square, Send } from 'lucide-react-native';
import { api, ApiError, WEB_BASE_URL } from '../lib/api';
import { startRecording, stopRecording, cancelRecording } from '../lib/transcribeAudio';
import Pressable3D from '../components/Pressable3D';
import { haptics } from '../lib/haptics';

async function fileToBase64(uri) {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.readAsDataURL(blob);
  });
}

function playAudioUrl(url) {
  return new Promise((resolve) => {
    let done = false;
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(safety);
      try { Sound.removePlaybackEndListener(); } catch { /* no-op */ }
      resolve();
    }
    const safety = setTimeout(finish, 20000);
    try {
      Sound.addPlaybackEndListener(finish);
      Sound.startPlayer(url).catch(finish);
    } catch {
      finish();
    }
  });
}

function ScenarioCard({ s, onPress }) {
  return (
    <Pressable3D
      onPress={onPress}
      pressDepth={2}
      className="mb-2.5 flex-row items-center gap-3 rounded-2xl bg-white px-4 py-3.5"
      style={{ borderWidth: 1, borderColor: '#f0efec', shadowColor: '#1c1917', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}
    >
      <Text style={{ fontSize: 24 }}>{s.icon || '💬'}</Text>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-extrabold text-stone-900">{s.title}</Text>
        <Text className="text-xs font-semibold text-stone-400" numberOfLines={2}>{s.goal}</Text>
      </View>
    </Pressable3D>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <View className={'mb-2.5 max-w-[85%] rounded-2xl px-4 py-3 ' + (isUser ? 'self-end bg-brand-500' : 'self-start bg-white')} style={!isUser ? { borderWidth: 1, borderColor: '#f0efec' } : undefined}>
      <Text className={'text-sm font-semibold ' + (isUser ? 'text-white' : 'text-stone-800')}>{msg.content}</Text>
      {!!msg.translation && <Text className={'mt-1 text-xs font-medium ' + (isUser ? 'text-white/75' : 'text-stone-400')}>{msg.translation}</Text>}
    </View>
  );
}

export default function ConversationScreen({ navigation }) {
  const [character, setCharacter] = useState(null);
  const [scenarios, setScenarios] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [sessionId] = useState(() => `mobile-${Date.now()}`);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    (async () => {
      const [chars, scen] = await Promise.all([
        api.get('/conversation/characters').catch(() => null),
        api.get('/conversation/scenarios').catch(() => null),
      ]);
      setCharacter(Array.isArray(chars?.characters) ? chars.characters[0] : null);
      setScenarios(Array.isArray(scen?.scenarios) ? scen.scenarios : []);
    })();
  }, []);

  async function sendTurn({ userText, userAudioB64 }) {
    setSending(true);
    setError('');
    const optimisticUser = userText ? { role: 'user', content: userText } : null;
    const nextMessages = optimisticUser ? [...messages, optimisticUser] : messages;
    if (optimisticUser) setMessages(nextMessages);
    try {
      const res = await api.post('/conversation/turn', {
        session_id: sessionId,
        character_id: character?.id || 'aram',
        scenario_id: scenario.id,
        messages: nextMessages,
        user_text: userText || undefined,
        user_audio_b64: userAudioB64 || undefined,
        user_level: 'beginner',
      });
      setMessages((prev) => {
        const withUser = res.user_transcription && !userText
          ? [...prev, { role: 'user', content: res.user_transcription }]
          : prev;
        return [...withUser, { role: 'assistant', content: res.assistant_text, translation: res.translation }];
      });
      if (res.is_complete) {
        setComplete(true);
        haptics.success();
      }
      if (res.audio_url) await playAudioUrl(res.audio_url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach the conversation. Please try again.');
      if (optimisticUser) setMessages(messages);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 50);
    }
  }

  async function sendText() {
    const t = text.trim();
    if (!t || sending) return;
    setText('');
    await sendTurn({ userText: t });
  }

  async function toggleMic() {
    if (sending) return;
    if (!recording) {
      setRecording(true);
      haptics.impact();
      try {
        await startRecording();
      } catch {
        setRecording(false);
      }
      return;
    }
    setRecording(false);
    try {
      const uri = await stopRecording();
      if (!uri) return;
      const b64 = await fileToBase64(uri);
      await sendTurn({ userAudioB64: b64 });
    } catch {
      await cancelRecording();
      setError('Could not process that recording. Please try again or type instead.');
    }
  }

  if (scenarios === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </SafeAreaView>
    );
  }

  if (!scenario) {
    return (
      <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
        <View className="flex-row items-center gap-2 px-4 pb-2 pt-3">
          <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-white">
            <ArrowLeft size={18} color="#57534e" />
          </Pressable3D>
          <Text className="text-xl font-extrabold text-stone-900 font-display">Conversation practice</Text>
        </View>
        <View className="px-4 pt-2">
          {scenarios.length === 0 ? (
            <Text className="text-sm font-semibold text-stone-400">No scenarios available right now.</Text>
          ) : (
            scenarios.map((s) => <ScenarioCard key={s.id} s={s} onPress={() => setScenario(s)} />)
          )}
        </View>
      </SafeAreaView>
    );
  }

  const portraitUrl = character?.portrait_url ? `${WEB_BASE_URL}${character.portrait_url}` : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-[#f5f4f1]">
      <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 pb-2 pt-3">
          <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-white">
            <ArrowLeft size={18} color="#57534e" />
          </Pressable3D>
          {!!portraitUrl && (
            <View style={{ width: 36, height: 36, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f5f5f4' }}>
              <Image source={{ uri: portraitUrl }} style={{ width: 36, height: 36 }} />
            </View>
          )}
          <View className="min-w-0 flex-1">
            <Text className="text-base font-extrabold text-stone-900" numberOfLines={1}>{character?.name || 'Aram'}</Text>
            <Text className="text-xs font-semibold text-stone-400" numberOfLines={1}>{scenario.title}</Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, paddingTop: 8, flexGrow: 1 }}
          renderItem={({ item }) => <MessageBubble msg={item} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: true })}
        />

        {!!error && (
          <View className="mx-4 mb-2 rounded-2xl bg-cardinal-50 px-4 py-2.5">
            <Text className="text-xs font-semibold text-cardinal-700">{error}</Text>
          </View>
        )}

        {complete ? (
          <View className="px-4 pb-6 pt-2">
            <View className="mb-3 items-center rounded-2xl bg-grass-50 px-4 py-4">
              <Text className="text-sm font-extrabold text-grass-700">Conversation complete! 🎉</Text>
            </View>
            <Pressable3D onPress={() => navigation.goBack()} className="items-center rounded-2xl bg-brand-500 py-4">
              <Text className="text-base font-extrabold text-white">Done</Text>
            </Pressable3D>
          </View>
        ) : (
          <View className="flex-row items-center gap-2 border-t border-stone-200 bg-white px-4 py-3">
            <Pressable3D
              onPress={toggleMic}
              disabled={sending}
              pressDepth={1}
              className={'h-11 w-11 items-center justify-center rounded-full ' + (recording ? 'bg-cardinal-500' : 'bg-feather-50')}
            >
              {recording ? <Square size={16} color="#fff" fill="#fff" /> : <Mic size={18} color="#1CB0F6" />}
            </Pressable3D>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={recording ? 'Recording…' : 'Type in Armenian…'}
              placeholderTextColor="#a8a29e"
              editable={!recording}
              className="flex-1 rounded-2xl bg-stone-100 px-3.5 py-2.5 text-sm font-semibold text-stone-800"
            />
            <Pressable3D
              onPress={sendText}
              disabled={!text.trim() || sending || recording}
              pressDepth={1}
              className={'h-11 w-11 items-center justify-center rounded-full ' + (text.trim() && !sending ? 'bg-brand-500' : 'bg-stone-200')}
            >
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={16} color={text.trim() ? '#fff' : '#a8a29e'} />}
            </Pressable3D>
          </View>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
