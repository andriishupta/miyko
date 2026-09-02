import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, TextInput } from 'react-native-paper';

import { api, ApiError } from '@/api/client';
import type { ApiIntentProcessResponse } from '@/api/types';
import { AppIcon, IconButton, MiykoText, ScreenScroll, StatusPill, Surface } from '@/components/miyko-ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ApiIntentProcessResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage() {
    const text = message.trim();
    if (!text || loading) return;
    setMessage('');
    setSubmittedMessage(text);
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      setResult(await api.intents.create({ text, source: 'text' }));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not submit the food intention.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Talk to MiyKo' }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <View style={styles.intro}><View style={[styles.chatIcon, { backgroundColor: theme.accentSoft }]}><AppIcon name="message" size={24} color={theme.accent} /></View><MiykoText variant="title">What are you craving?</MiykoText><MiykoText variant="body" color="textSecondary" style={styles.center}>Share a meal idea, a reminder or a change to the next basket.</MiykoText></View>
        <Surface style={styles.messageBubble}><MiykoText variant="caption" color="textSecondary">MiyKo</MiykoText><MiykoText variant="body">Try: “I want breakfasts for three days.”</MiykoText></Surface>
        {submittedMessage && <Surface style={[styles.messageBubble, { alignSelf: 'flex-end', backgroundColor: theme.accentSoft }]}><MiykoText variant="caption" color="accent">You</MiykoText><MiykoText variant="body">{submittedMessage}</MiykoText></Surface>}
        {loading && <Surface style={styles.response}><ActivityIndicator color={theme.accent} /><MiykoText variant="body" color="textSecondary">Sending the intention to the Agent Layer…</MiykoText></Surface>}
        {error && <Surface style={styles.response}><StatusPill label="API unavailable" tone="warning" /><MiykoText variant="body" color="danger">{error}</MiykoText></Surface>}
        {result && <Surface style={styles.response}><View style={styles.responseHeader}><MiykoText variant="section">Agent result</MiykoText><StatusPill label="Processed" tone="success" /></View>{result.intent && <MiykoText variant="body">{result.intent.text}</MiykoText>}{result.response?.message && <MiykoText variant="body" color="textSecondary">{result.response.message}</MiykoText>}{result.planning && <MiykoText variant="caption" color="textSecondary">Planning run: {result.planning.status}</MiykoText>}{result.proposal && <MiykoText variant="caption" color="textSecondary">Proposal ready for review.</MiykoText>}</Surface>}
        <View style={styles.composer}><TextInput mode="outlined" value={message} onChangeText={setMessage} placeholder="Write a food intention…" textColor={theme.text} outlineColor={theme.border} activeOutlineColor={theme.accent} contentStyle={styles.inputContent} outlineStyle={styles.inputOutline} style={styles.input} /><IconButton name="arrow" label="Send message" onPress={() => void sendMessage()} /></View>
      </ScreenScroll>
    </>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  chatIcon: { width: 52, height: 52, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  messageBubble: { maxWidth: '88%', gap: 4 },
  response: { gap: Spacing.two },
  responseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  composer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: { flex: 1 },
  inputContent: { minHeight: 50, paddingHorizontal: Spacing.three, fontSize: 16 },
  inputOutline: { borderRadius: Radius.pill },
});
