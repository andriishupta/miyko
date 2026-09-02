import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native-paper";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "@/api/client";
import type { ApiHouseholdSummary, ApiWorkflow } from "@/api/types";
import { MiykoText, PrimaryButton, ScreenScroll, SecondaryButton, StatusPill, Surface } from "@/components/miyko-ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export default function WorkflowScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [workflow, setWorkflow] = useState<ApiWorkflow | null>(null);
  const [household, setHousehold] = useState<ApiHouseholdSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.workflows.get(id), api.household.summary()]).then(([result, summary]) => { setWorkflow(result.workflow); setHousehold(summary); }).catch((cause) => setError(cause instanceof ApiError ? cause.message : "Could not load workflow.")).finally(() => setLoading(false));
  }, [id]);

  async function decide(type: "approve" | "decline") {
    if (!id || !workflow || household?.currentMember.role !== "owner" || actionLoading) return;
    setActionLoading(true); setError(null);
    try { setWorkflow((await api.workflows.action(id, { type })).workflow); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : `Could not ${type} workflow.`); }
    finally { setActionLoading(false); }
  }

  if (loading) return <ScreenScroll bottomInset={insets.bottom + 112} contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}><ActivityIndicator color={theme.accent} /></ScreenScroll>;
  if (!workflow) return <ScreenScroll bottomInset={insets.bottom + 112}><Surface><MiykoText variant="section">Workflow unavailable</MiykoText><MiykoText variant="body" color="danger">{error ?? "The API did not return this workflow."}</MiykoText></Surface></ScreenScroll>;
  const pending = workflow.approvals.filter((approval) => approval.status === "pending");
  const canDecide = household?.currentMember.role === "owner" && pending.length > 0;
  return <><Stack.Screen options={{ title: "Workflow" }} /><ScreenScroll bottomInset={insets.bottom + 112}>
    <View style={{ gap: Spacing.two }}><MiykoText variant="title">Food workflow</MiykoText><StatusPill label={workflow.status} tone={workflow.status === "interrupted" || pending.length ? "warning" : "accent"} /></View>
    {error && <MiykoText variant="caption" color="danger">{error}</MiykoText>}
    <Surface><MiykoText variant="section">Managed state</MiykoText><MiykoText variant="body" color="textSecondary">LangGraph keeps the conversation, generated recipe, provider basket and current pause point. MiyKo stores only this reference and approval decision.</MiykoText><MiykoText variant="caption" color="textSecondary">Thread: {workflow.threadId}</MiykoText></Surface>
    <Surface><MiykoText variant="section">Approvals</MiykoText>{pending.length ? pending.map((approval) => <MiykoText key={approval.id} variant="body" color="textSecondary">Pending {approval.action.replace(/_/g, " ")}</MiykoText>) : <MiykoText variant="body" color="textSecondary">No pending approval.</MiykoText>}</Surface>
    {household?.currentMember.role !== "owner" && pending.length > 0 && <Surface><MiykoText variant="section">Owner approval required</MiykoText><MiykoText variant="body" color="textSecondary">Only the household owner can approve or decline a provider action.</MiykoText></Surface>}
    {canDecide && <View style={{ gap: Spacing.two }}><PrimaryButton label="Approve" loading={actionLoading} onPress={() => void decide("approve")} icon="cart" /><SecondaryButton label="Decline" onPress={() => void decide("decline")} /></View>}
  </ScreenScroll></>;
}
