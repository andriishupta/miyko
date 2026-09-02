import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, TextInput } from "react-native-paper";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "@/api/client";
import type { ApiWorkflow } from "@/api/types";
import { AppIcon, IconButton, MiykoText, ScreenScroll, SecondaryButton, StatusPill, Surface } from "@/components/miyko-ui";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export default function ChatScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<ApiWorkflow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage() {
    const text = message.trim();
    if (!text || loading) return;
    setMessage(""); setSubmittedMessage(text); setWorkflow(null); setError(null); setLoading(true);
    try { setWorkflow((await api.workflows.create(text)).workflow); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Could not start the workflow."); }
    finally { setLoading(false); }
  }

  return <>
    <Stack.Screen options={{ title: "Talk to MiyKo" }} />
    <ScreenScroll bottomInset={insets.bottom + 112}>
      <View style={styles.intro}><View style={[styles.chatIcon, { backgroundColor: theme.accentSoft }]}><AppIcon name="message" size={24} color={theme.accent} /></View><MiykoText variant="title">What should we do?</MiykoText><MiykoText variant="body" color="textSecondary" style={styles.center}>Ask for dinner, a basket change, or an order. The workflow stays paused until approval is given.</MiykoText></View>
      <Surface style={styles.messageBubble}><MiykoText variant="caption" color="textSecondary">MiyKo</MiykoText><MiykoText variant="body">Try: “Make dinner for two and add ice cream.”</MiykoText></Surface>
      {submittedMessage && <Surface style={[styles.messageBubble, { alignSelf: "flex-end", backgroundColor: theme.accentSoft }]}><MiykoText variant="caption" color="accent">You</MiykoText><MiykoText variant="body">{submittedMessage}</MiykoText></Surface>}
      {loading && <Surface style={styles.response}><ActivityIndicator color={theme.accent} /><MiykoText variant="body" color="textSecondary">Starting the managed LangGraph workflow…</MiykoText></Surface>}
      {error && <Surface style={styles.response}><StatusPill label="API unavailable" tone="warning" /><MiykoText variant="body" color="danger">{error}</MiykoText></Surface>}
      {workflow && <Surface style={styles.response}><View style={styles.responseHeader}><MiykoText variant="section">Workflow started</MiykoText><StatusPill label={workflow.status} tone={workflow.status === "interrupted" ? "warning" : "accent"} /></View><MiykoText variant="body" color="textSecondary">LangGraph owns the conversation, recipe, basket and pause/resume state.</MiykoText><MiykoText variant="caption" color="textSecondary">Workflow ID: {workflow.id}</MiykoText><SecondaryButton label="Open workflow" onPress={() => router.push(`/home/workflows/${workflow.id}`)} /></Surface>}
      <View style={styles.composer}><TextInput mode="outlined" value={message} onChangeText={setMessage} placeholder="Write a food request…" textColor={theme.text} outlineColor={theme.border} activeOutlineColor={theme.accent} contentStyle={styles.inputContent} outlineStyle={styles.inputOutline} style={styles.input} onSubmitEditing={() => void sendMessage()} /><IconButton name="arrow" label="Send request" onPress={() => void sendMessage()} /></View>
    </ScreenScroll>
  </>;
}

const styles = StyleSheet.create({ intro: { alignItems: "center", gap: Spacing.two, paddingVertical: Spacing.three }, chatIcon: { width: 52, height: 52, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" }, center: { textAlign: "center" }, messageBubble: { maxWidth: "88%", gap: 4 }, response: { gap: Spacing.two }, responseHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.two }, composer: { flexDirection: "row", alignItems: "center", gap: Spacing.two }, input: { flex: 1 }, inputContent: { minHeight: 50, paddingHorizontal: Spacing.three, fontSize: 16 }, inputOutline: { borderRadius: Radius.pill } });
