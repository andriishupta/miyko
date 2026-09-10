import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, TextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/api/client";
import { AppIcon, IconButton, MiykoText, ScreenScroll, StatusPill } from "@/components/miyko-ui";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const examples = [
  "Plan dinner for two tonight",
  "Add a dessert to our next shop",
  "Prepare a simple weekend basket",
];

export default function ChatScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage() {
    const text = message.trim();
    if (!text || loading) return;
    setMessage("");
    setError(null);
    setLoading(true);
    try {
      const { workflow } = await api.workflows.create(text);
      router.replace(`/home/workflows/${workflow.id}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not start the chat.");
    } finally {
      setLoading(false);
    }
  }

  return <>
    <Stack.Screen options={{ title: "New chat" }} />
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: theme.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}>
      <ScreenScroll style={styles.messages} contentContainerStyle={styles.messagesContent}>
        <View style={styles.intro}>
          <View style={[styles.chatIcon, { backgroundColor: theme.accentSoft }]}><AppIcon name="message" size={24} color={theme.accent} /></View>
          <MiykoText variant="title">What are you planning?</MiykoText>
          <MiykoText variant="body" color="textSecondary" style={styles.center}>Tell MiyKo what your household would like to eat or shop for.</MiykoText>
        </View>
        <View style={styles.examples}>
          <MiykoText variant="caption" color="textSecondary">Try one of these</MiykoText>
          {examples.map((example) => <Pressable key={example} accessibilityRole="button" accessibilityLabel={`Use example: ${example}`} onPress={() => setMessage(example)} style={({ pressed }) => [styles.example, { borderColor: theme.border, backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}><MiykoText variant="body">{example}</MiykoText><AppIcon name="arrow" size={16} color={theme.accent} /></Pressable>)}
        </View>
        {loading && <View style={styles.notice}><ActivityIndicator color={theme.accent} /><MiykoText variant="body" color="textSecondary">Starting your chat…</MiykoText></View>}
        {error && <View style={styles.notice}><StatusPill label="Could not start" tone="warning" /><MiykoText variant="body" color="danger">{error}</MiykoText></View>}
      </ScreenScroll>
      <View style={[styles.composer, { backgroundColor: theme.backgroundElement, borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.two }]}>
        <IconButton name="mic" label="Voice input coming soon" disabled onPress={() => undefined} />
        <TextInput mode="outlined" value={message} onChangeText={setMessage} placeholder="Message MiyKo" textColor={theme.text} outlineColor={theme.border} activeOutlineColor={theme.accent} multiline numberOfLines={2} contentStyle={styles.inputContent} outlineStyle={styles.inputOutline} style={styles.input} onSubmitEditing={() => void sendMessage()} />
        <IconButton name="arrow" label="Send message" onPress={() => void sendMessage()} />
      </View>
    </KeyboardAvoidingView>
  </>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  messages: { flex: 1 },
  messagesContent: { flexGrow: 1, paddingBottom: Spacing.four },
  intro: { alignItems: "center", gap: Spacing.two, paddingTop: Spacing.four, paddingBottom: Spacing.three },
  chatIcon: { width: 52, height: 52, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center" },
  examples: { gap: Spacing.two },
  example: { minHeight: 52, paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: Radius.medium, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.two },
  pressed: { opacity: 0.72 },
  notice: { gap: Spacing.two, paddingVertical: Spacing.three },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.one, paddingHorizontal: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1 },
  input: { flex: 1, maxHeight: 96 },
  inputContent: { minHeight: 50, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  inputOutline: { borderRadius: Radius.medium },
});
