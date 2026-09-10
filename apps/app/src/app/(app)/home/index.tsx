import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/api/client";
import type { ApiDashboard, ApiWorkflow, ApiWorkflowView } from "@/api/types";
import { useAuth } from "@/auth/auth-context";
import { AppIcon, EmptyState, IconButton, MiykoText, PrimaryButton, ScreenScroll, Surface } from "@/components/miyko-ui";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const statusCopy: Record<ApiWorkflow["status"], string> = {
  pending: "Starting",
  running: "In progress",
  interrupted: "Waiting for your approval",
  succeeded: "Completed",
  failed: "Could not complete",
  cancelled: "Cancelled",
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { session } = useAuth();
  const [dashboard, setDashboard] = useState<ApiDashboard | null>(null);
  const [requests, setRequests] = useState<ApiWorkflow[]>([]);
  const [requestViews, setRequestViews] = useState<Record<string, ApiWorkflowView>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([api.dashboard.get(), api.workflows.list()])
      .then(async ([nextDashboard, nextRequests]) => {
        if (!active) return;
        setDashboard(nextDashboard);
        setRequests(nextRequests);
        const views = await Promise.all(nextRequests.map(async (request) => {
          if (!request.runId || ["pending", "failed", "cancelled"].includes(request.status)) return null;
          try {
            return [request.id, (await api.workflows.view(request.id)).view] as const;
          } catch {
            return null;
          }
        }));
        if (active) setRequestViews(Object.fromEntries(views.filter((entry): entry is readonly [string, ApiWorkflowView] => entry !== null)));
      })
      .catch((cause) => { if (active) setError(cause instanceof ApiError ? cause.message : "Could not load your requests."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  if (loading) return <ScreenScroll contentContainerStyle={styles.centered}><ActivityIndicator color={theme.accent} /></ScreenScroll>;
  if (!dashboard) return <ScreenScroll><Surface><MiykoText variant="section">MiyKo is unavailable</MiykoText><MiykoText variant="body" color="danger">{error ?? "Your requests could not be loaded."}</MiykoText><PrimaryButton label="Try again" onPress={() => router.replace("/home")} /></Surface></ScreenScroll>;

  const userName = session?.user.displayName || session?.user.email || "there";
  return <View style={[styles.root, { backgroundColor: theme.background }]}>
    <Stack.Screen options={{ title: "MiyKo", headerLargeTitle: false, headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Open settings" hitSlop={12} onPress={() => router.push("/home/settings")}><AppIcon name="gear" size={22} color={theme.text} /></Pressable> }} />
    <ScreenScroll contentContainerStyle={styles.homeContent}>
      <View style={styles.greeting}>
        <View style={styles.greetingCopy}><MiykoText variant="caption" color="textSecondary">Good morning, {userName}</MiykoText><MiykoText variant="section">Let&apos;s make food easy.</MiykoText></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${dashboard.household.name}`} onPress={() => router.push("/household")} style={[styles.householdButton, { backgroundColor: theme.accentSoft }]}><MiykoText variant="label" color="accent">{dashboard.household.name.slice(0, 2).toUpperCase()}</MiykoText></Pressable>
      </View>

      {requests.length === 0 ? <EmptyState title="Nothing here yet" detail="Start a chat to plan dinner, shopping or your next basket." /> : <View style={styles.requestList}>{requests.map((request) => <RequestCard key={request.id} request={request} view={requestViews[request.id]} onPress={() => router.push(`/home/workflows/${request.id}`)} />)}</View>}
    </ScreenScroll>
    <View pointerEvents="box-none" style={[styles.floatingLayer, { bottom: insets.bottom + Spacing.three }]}>
      <Surface style={styles.floatingActions}>
        <View style={styles.quickAction}><IconButton name="mic" label="Voice input coming soon" disabled onPress={() => undefined} /><MiykoText variant="caption" color="textSecondary">Voice</MiykoText></View>
        <View style={styles.quickAction}><IconButton name="plus" label="Start a new chat" emphasis="accent" onPress={() => router.push("/home/chat")} /><MiykoText variant="caption" color="accent">New chat</MiykoText></View>
      </Surface>
    </View>
  </View>;
}

function RequestCard({ request, view, onPress }: { request: ApiWorkflow; view?: ApiWorkflowView; onPress: () => void }) {
  const theme = useTheme();
  const pendingApprovals = request.approvals.filter((approval) => approval.status === "pending").length;
  const title = getRequestTitle(view);
  const description = getRequestDescription(request, view, pendingApprovals);
  const statusColor = request.status === "failed" ? theme.danger : request.status === "succeeded" ? theme.success : pendingApprovals > 0 ? theme.warning : theme.accent;

  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}, ${statusCopy[request.status]}`} onPress={onPress}><Surface style={styles.requestCard}><View style={styles.requestHeader}><View style={styles.requestCopy}><MiykoText variant="section" numberOfLines={2}>{title}</MiykoText><View style={styles.statusRow}><View style={[styles.statusDot, { backgroundColor: statusColor }]} /><MiykoText variant="caption" style={{ color: statusColor }}>{statusCopy[request.status]}</MiykoText></View></View><AppIcon name="chevron" size={18} color={theme.textSecondary} /></View>{description && <MiykoText variant="body" color="textSecondary" numberOfLines={3}>{description}</MiykoText>}</Surface></Pressable>;
}

function getRequestTitle(view?: ApiWorkflowView) {
  return view?.plannedRequests[0]?.text?.trim() || getUserFacingSummary(view?.summary) || "Food request";
}

function getRequestDescription(request: ApiWorkflow, view: ApiWorkflowView | undefined, pendingApprovals: number) {
  const title = getRequestTitle(view);
  const summary = getUserFacingSummary(view?.summary);
  if (summary && summary !== title) return summary;
  if (pendingApprovals > 0) return `${pendingApprovals} household approval${pendingApprovals === 1 ? " is" : "s are"} waiting.`;
  if (request.providerBasketId) return "Your basket is ready to review.";
  if (request.providerOrderId) return "Your order reference is available.";
  if (request.status === "failed") return "Open this request to review what happened or continue the conversation.";
  return null;
}

function getUserFacingSummary(summary?: string) {
  const value = summary?.trim();
  if (!value) return null;
  if (/initial request saved/i.test(value)) return "Initial request saved.";
  if (/langgraph|mem0|\bmcp\b|graph state/i.test(value)) return "Your request was updated.";
  return value;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  homeContent: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: 128, gap: Spacing.three },
  greeting: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  greetingCopy: { flex: 1, gap: Spacing.one },
  householdButton: { width: 46, height: 46, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  requestList: { gap: Spacing.two },
  requestCard: { gap: Spacing.two, padding: Spacing.three },
  requestHeader: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.two },
  requestCopy: { flex: 1, gap: Spacing.one },
  statusRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  statusDot: { width: 7, height: 7, borderRadius: Radius.pill },
  floatingLayer: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  floatingActions: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.four, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.large },
  quickAction: { alignItems: "center", gap: Spacing.one },
});
