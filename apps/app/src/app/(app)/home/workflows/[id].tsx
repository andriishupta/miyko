import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, SegmentedButtons } from "react-native-paper";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { WorkflowActionRequest } from "@miyko/contracts";
import { api, ApiError } from "@/api/client";
import type { ApiHouseholdSummary, ApiWorkflow } from "@/api/types";
import { Field, MiykoText, PrimaryButton, ScreenScroll, SecondaryButton, StatusPill, Surface } from "@/components/miyko-ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type MemberRequestKind = "add_item" | "replace_item";

export default function WorkflowScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [workflow, setWorkflow] = useState<ApiWorkflow | null>(null);
  const [household, setHousehold] = useState<ApiHouseholdSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestKind, setRequestKind] = useState<MemberRequestKind>("add_item");
  const [requestText, setRequestText] = useState("");
  const [fulfillmentMode, setFulfillmentMode] = useState<"pickup" | "delivery">("pickup");
  const [scheduledFrom, setScheduledFrom] = useState("");
  const [scheduledTo, setScheduledTo] = useState("");

  const load = useCallback(async (showLoading = true) => {
    if (!id) return;
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [result, summary] = await Promise.all([api.workflows.get(id), api.household.summary()]);
      setWorkflow(result.workflow);
      setHousehold(summary);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not load workflow.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitAction(body: WorkflowActionRequest, loadingId: string) {
    if (!id || actionLoadingId) return;
    setActionLoadingId(loadingId);
    setError(null);
    try {
      setWorkflow((await api.workflows.action(id, body)).workflow);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not update the workflow.");
    } finally {
      setActionLoadingId(null);
    }
  }

  function decide(approvalId: string, type: "approve" | "decline") {
    if (household?.currentMember.role !== "owner") return;
    void submitAction({ type, approvalId }, approvalId);
  }

  function sendProviderRequest() {
    const text = requestText.trim();
    if (!text) {
      setError("Describe the item or change you want to request.");
      return;
    }
    const label = requestKind === "add_item" ? "Add item" : "Replace item";
    void submitAction({ type: "provider_action", intent: `${label}: ${text}` }, "member-request");
    setRequestText("");
  }

  function sendFulfillment() {
    void submitAction({ type: "fulfillment_selected", mode: fulfillmentMode }, "fulfillment");
  }

  function sendDeliverySlot() {
    if (!scheduledFrom.trim() || !scheduledTo.trim()) {
      setError("Enter both delivery slot timestamps in ISO format.");
      return;
    }
    void submitAction({ type: "delivery_slot_selected", scheduledFrom: scheduledFrom.trim(), scheduledTo: scheduledTo.trim() }, "delivery-slot");
  }

  if (loading) {
    return <ScreenScroll bottomInset={insets.bottom + 112} contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}><ActivityIndicator color={theme.accent} /></ScreenScroll>;
  }

  if (!workflow) {
    return <ScreenScroll bottomInset={insets.bottom + 112}><Surface><MiykoText variant="section">Workflow unavailable</MiykoText><MiykoText variant="body" color="danger">{error ?? "The API did not return this workflow."}</MiykoText><PrimaryButton label="Retry" loading={refreshing} onPress={() => void load(false)} /></Surface></ScreenScroll>;
  }

  const pending = workflow.approvals.filter((approval) => approval.status === "pending");
  const isOwner = household?.currentMember.role === "owner";
  const refs: Array<[string, string | null]> = [
    ["Workflow", workflow.id],
    ["Thread", workflow.threadId],
    ["Run", workflow.runId],
    ["Provider", workflow.providerId],
    ["Provider basket", workflow.providerBasketId],
    ["Provider order", workflow.providerOrderId],
    ["Fulfillment", workflow.fulfillmentMode],
    ["Scheduled from", workflow.scheduledFrom],
    ["Scheduled to", workflow.scheduledTo],
  ];

  return <>
    <Stack.Screen options={{ title: "Workflow" }} />
    <ScreenScroll bottomInset={insets.bottom + 112}>
      <View style={styles.titleRow}><View style={{ flex: 1, gap: Spacing.one }}><MiykoText variant="title">Workflow</MiykoText><MiykoText variant="caption" color="textSecondary">Managed workflow projection</MiykoText></View><StatusPill label={workflow.status} tone={workflow.status === "interrupted" || pending.length ? "warning" : workflow.status === "succeeded" ? "success" : "accent"} /></View>
      {error && <MiykoText variant="caption" color="danger">{error}</MiykoText>}
      <SecondaryButton label="Refresh latest state" disabled={Boolean(actionLoadingId) || refreshing} onPress={() => void load(false)} />

      <Surface>
        <MiykoText variant="section">Last observed state</MiykoText>
        <MiykoText variant="body" color="textSecondary">LangGraph and the provider own conversation, recipe, products, basket, fulfillment and pause/resume state. These are the latest references returned by the API, not a local copy.</MiykoText>
        <View style={styles.referenceGrid}>{refs.map(([label, value]) => <View key={label} style={styles.reference}><MiykoText variant="caption" color="textSecondary">{label}</MiykoText><MiykoText variant="body">{value ?? "Not returned"}</MiykoText></View>)}</View>
      </Surface>

      <Surface>
        <MiykoText variant="section">Owner approvals</MiykoText>
        {pending.length === 0 ? <MiykoText variant="body" color="textSecondary">No pending approval.</MiykoText> : pending.map((approval) => <View key={approval.id} style={[styles.approval, { borderTopColor: theme.border }]}>
          <View style={styles.titleRow}><View style={{ flex: 1, gap: Spacing.one }}><MiykoText variant="body">{approval.action.replace(/_/g, " ")}</MiykoText><MiykoText variant="caption" color="textSecondary">Approval ID: {approval.id}</MiykoText></View><StatusPill label="Pending" tone="warning" /></View>
          {isOwner ? <View style={styles.actions}><PrimaryButton label="Approve" icon="cart" loading={actionLoadingId === approval.id} disabled={Boolean(actionLoadingId && actionLoadingId !== approval.id)} onPress={() => decide(approval.id, "approve")} /><SecondaryButton label="Decline" disabled={Boolean(actionLoadingId)} onPress={() => decide(approval.id, "decline")} /></View> : <MiykoText variant="caption" color="textSecondary">Only the household owner can approve or decline this action.</MiykoText>}
        </View>)}
      </Surface>

      <Surface>
        <MiykoText variant="section">Request a workflow change</MiykoText>
        <MiykoText variant="body" color="textSecondary">Members can send a typed request to the managed workflow. Provider tools and credentials stay behind the API.</MiykoText>
        <SegmentedButtons value={requestKind} onValueChange={(value) => setRequestKind(value as MemberRequestKind)} buttons={[{ value: "add_item", label: "Add item" }, { value: "replace_item", label: "Replace item" }]} />
        <Field label="REQUEST" placeholder="e.g. add oat milk" value={requestText} onChangeText={setRequestText} />
        <PrimaryButton label="Send request" loading={actionLoadingId === "member-request"} disabled={Boolean(actionLoadingId && actionLoadingId !== "member-request")} onPress={sendProviderRequest} icon="arrow" />
      </Surface>

      <Surface>
        <MiykoText variant="section">Fulfillment choice</MiykoText>
        <SegmentedButtons value={fulfillmentMode} onValueChange={(value) => setFulfillmentMode(value as "pickup" | "delivery")} buttons={[{ value: "pickup", label: "Pickup" }, { value: "delivery", label: "Delivery" }]} />
        <PrimaryButton label="Save fulfillment" loading={actionLoadingId === "fulfillment"} disabled={Boolean(actionLoadingId && actionLoadingId !== "fulfillment")} onPress={sendFulfillment} />
        {fulfillmentMode === "delivery" && <View style={styles.slot}><Field label="FROM (ISO)" placeholder="2026-09-02T18:00:00Z" value={scheduledFrom} onChangeText={setScheduledFrom} /><Field label="TO (ISO)" placeholder="2026-09-02T20:00:00Z" value={scheduledTo} onChangeText={setScheduledTo} /><PrimaryButton label="Save delivery slot" loading={actionLoadingId === "delivery-slot"} disabled={Boolean(actionLoadingId && actionLoadingId !== "delivery-slot")} onPress={sendDeliverySlot} /></View>}
      </Surface>
    </ScreenScroll>
  </>;
}

const styles = {
  titleRow: { flexDirection: "row" as const, alignItems: "flex-start" as const, justifyContent: "space-between" as const, gap: Spacing.two },
  referenceGrid: { gap: Spacing.two },
  reference: { gap: Spacing.one },
  approval: { gap: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1, borderTopColor: "rgba(128, 128, 128, 0.18)" },
  actions: { gap: Spacing.two },
  slot: { gap: Spacing.two },
};
