import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput } from 'react-native-paper';

import { AppIcon, IconButton, MiykoText, ScreenScroll, Surface } from '@/components/miyko-ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  function sendMessage() {
    if (!message.trim()) return;
    setMessage('');
    setSent(true);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Talk to MiyKo' }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <View style={styles.intro}><View style={[styles.chatIcon, { backgroundColor: theme.accentSoft }]}><AppIcon name="message" size={24} color={theme.accent} /></View><MiykoText variant="title">What are you craving?</MiykoText><MiykoText variant="body" color="textSecondary" style={styles.center}>Share a meal idea, a reminder or a change to the next basket.</MiykoText></View>
        <Surface style={styles.messageBubble}><MiykoText variant="caption" color="textSecondary">MiyKo</MiykoText><MiykoText variant="body">Try: “I want breakfasts for three days.”</MiykoText></Surface>
        {sent && <Surface style={[styles.messageBubble, { alignSelf: 'flex-end', backgroundColor: theme.accentSoft }]}><MiykoText variant="caption" color="accent">You</MiykoText><MiykoText variant="body">Mock message saved to your intent inbox.</MiykoText></Surface>}
        <View style={styles.composer}><TextInput mode="outlined" value={message} onChangeText={setMessage} placeholder="Write a food intention…" textColor={theme.text} outlineColor={theme.border} activeOutlineColor={theme.accent} contentStyle={styles.inputContent} outlineStyle={styles.inputOutline} style={styles.input} /><IconButton name="arrow" label="Send message" onPress={sendMessage} /></View>
      </ScreenScroll>
    </>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  chatIcon: { width: 52, height: 52, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  messageBubble: { maxWidth: '88%', gap: 4 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: { flex: 1 },
  inputContent: { minHeight: 50, paddingHorizontal: Spacing.three, fontSize: 16 },
  inputOutline: { borderRadius: Radius.pill },
});
