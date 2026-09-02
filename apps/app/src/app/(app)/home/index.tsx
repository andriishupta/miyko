import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native-paper";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "@/api/client";
import type { ApiDashboard, ApiWorkflow } from "@/api/types";
import { useAuth } from "@/auth/auth-context";
import { AppIcon, EmptyState, MiykoText, PrimaryButton, ScreenScroll, SecondaryButton, StatusPill, Surface } from "@/components/miyko-ui";
import { Radius, Spacing } from "@/constants/theme";
import { AudioRecorderCard } from "@/components/audio-recorder-card";
import { useTheme } from "@/hooks/use-theme";
import { useProviderStatus } from "@/providers/provider-status-context";

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [dashboard, setDashboard] = useState<ApiDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.dashboard.get().then((value) => { if (active) setDashboard(value); }).catch((cause) => { if (active) setError(cause instanceof ApiError ? cause.message : "Could not load dashboard."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <ScreenScroll bottomInset={insets.bottom + 112} contentContainerStyle={styles.centered}><ActivityIndicator color={theme.accent} /></ScreenScroll>;
  if (!dashboard) return <ScreenScroll bottomInset={insets.bottom + 112}><Surface><MiykoText variant="section">Dashboard unavailable</MiykoText><MiykoText variant="body" color="danger">{error ?? "The API did not return dashboard data."}</MiykoText><PrimaryButton label="Try again" onPress={() => router.replace("/home")} /></Surface></ScreenScroll>;

  const userName = session?.user.displayName || session?.user.email || "there";
  return <>
    <Stack.Screen options={{ title: "Home", headerLargeTitle: true, headerRight: () => <Pressable onPress={() => router.push("/home/settings")}><AppIcon name="gear" size={22} color={theme.text} /></Pressable> }} />
    <ScreenScroll bottomInset={insets.bottom + 112}>
      <View style={styles.greeting}><View style={{ flex: 1, gap: 4 }}><MiykoText variant="caption" color="textSecondary">Good morning, {userName}</MiykoText><MiykoText variant="title">Let&apos;s make food easy.</MiykoText></View><Pressable onPress={() => router.push("/household")} style={[styles.householdButton, { backgroundColor: theme.accentSoft }]}><MiykoText variant="label" color="accent">{dashboard.household.name.slice(0, 2).toUpperCase()}</MiykoText></Pressable></View>
      <Surface style={styles.summary}><View style={styles.header}><View style={{ flex: 1, gap: 4 }}><MiykoText variant="caption" color="textSecondary">ACTIVE WORKFLOWS</MiykoText><MiykoText variant="section">{dashboard.activeWorkflows.length ? "Household requests in progress" : "No active requests"}</MiykoText></View><StatusPill label={dashboard.householdSummary.pendingApprovals ? `${dashboard.householdSummary.pendingApprovals} review` : "Ready"} tone={dashboard.householdSummary.pendingApprovals ? "warning" : "accent"} /></View><MiykoText variant="body" color="textSecondary">Recipes, products, basket contents and pause/resume state live in LangGraph Cloud and the connected provider.</MiykoText><MiykoText variant="caption" color="textSecondary">{dashboard.householdSummary.memberCount} household members · {dashboard.householdSummary.connectedShoppingAccounts} provider account{dashboard.householdSummary.connectedShoppingAccounts === 1 ? "" : "s"} connected.</MiykoText></Surface>
      <ProviderStateCard />
      <AudioRecorderCard />
      <SecondaryButton label="Open chat" icon="message" onPress={() => router.push("/home/chat")} />
      <View style={styles.section}><MiykoText variant="section">Requests</MiykoText>{dashboard.activeWorkflows.length === 0 ? <EmptyState title="Nothing in progress" detail="Start a dinner, shopping or order request from chat." /> : dashboard.activeWorkflows.map((workflow) => <WorkflowCard key={workflow.id} workflow={workflow} onPress={() => router.push(`/home/workflows/${workflow.id}`)} />)}</View>
    </ScreenScroll>
  </>;
}

function ProviderStateCard() {
  const router = useRouter();
  const { accounts, connected, loading, error, refresh } = useProviderStatus();
  if (loading) return <Surface><ActivityIndicator /></Surface>;
  if (error) return <Surface><MiykoText variant="section">Provider status unavailable</MiykoText><MiykoText variant="body" color="textSecondary">{error}</MiykoText><PrimaryButton label="Retry" onPress={() => void refresh()} /></Surface>;
  return <Surface style={styles.provider}><View style={styles.header}><MiykoText variant="section">Store provider</MiykoText><StatusPill label={connected ? "Connected" : "Required"} tone={connected ? "success" : "warning"} /></View><MiykoText variant="body" color="textSecondary">{connected ? `${accounts.filter((account) => account.status === "active").map((account) => account.provider.name).join(" · ")} is ready for the workflow.` : "Connect Silpo before starting a workflow so LangGraph can use its MCP tools after approval."}</MiykoText><SecondaryButton label={connected ? "Manage provider" : "Connect provider"} icon="cart" onPress={() => router.push("/home/providers")} /></Surface>;
}

function WorkflowCard({ workflow, onPress }: { workflow: ApiWorkflow; onPress: () => void }) {
  const pending = workflow.approvals.filter((approval) => approval.status === "pending").length;
  return <Pressable onPress={onPress}><Surface style={styles.workflow}><View style={styles.workflowIcon}><AppIcon name="cart" size={19} /></View><View style={{ flex: 1, gap: 4 }}><MiykoText variant="section">Food workflow</MiykoText><MiykoText variant="caption" color="textSecondary">{pending ? `${pending} approval${pending === 1 ? "" : "s"} pending` : workflow.status}</MiykoText></View><AppIcon name="chevron" size={18} /></Surface></Pressable>;
}

const styles = StyleSheet.create({ centered: { flexGrow: 1, alignItems: "center", justifyContent: "center" }, greeting: { flexDirection: "row", alignItems: "center", gap: Spacing.three }, householdButton: { width: 46, height: 46, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" }, summary: { gap: Spacing.two }, header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: Spacing.two }, provider: { gap: Spacing.two }, section: { gap: Spacing.two }, workflow: { flexDirection: "row", alignItems: "center", gap: Spacing.two }, workflowIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F0EC" } });
