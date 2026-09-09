import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, SegmentedButtons } from "react-native-paper";
import { Linking, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { WorkflowActionRequest } from "@miyko/contracts";
import { api, ApiError } from "@/api/client";
import type { ApiHouseholdSummary, ApiWorkflow, ApiWorkflowView } from "@/api/types";
import { Field, MiykoText, PrimaryButton, ScreenScroll, SecondaryButton, StatusPill, Surface } from "@/components/miyko-ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type MemberRequestKind = "add_item" | "replace_item" | "instruction";

export default function WorkflowScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [workflow, setWorkflow] = useState<ApiWorkflow | null>(null);
  const [workflowView, setWorkflowView] = useState<ApiWorkflowView | null>(null);
  const [household, setHousehold] = useState<ApiHouseholdSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestKind, setRequestKind] = useState<MemberRequestKind>("add_item");
  const [requestText, setRequestText] = useState("");

  const load = useCallback(async (showLoading = true) => {
    if (!id) return;
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [result, summary] = await Promise.all([api.workflows.get(id), api.household.summary()]);
      setWorkflow(result.workflow);
      setHousehold(summary);
      if (["pending", "failed", "cancelled"].includes(result.workflow.status) || !result.workflow.runId) {
        setWorkflowView(null);
        return;
      }
      try {
        setWorkflowView((await api.workflows.view(id)).view);
      } catch (cause) {
        setWorkflowView(null);
        setError(cause instanceof ApiError ? cause.message : "Live workflow state is not available yet.");
      }
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
      const queuedWorkflow = (await api.workflows.action(id, body)).workflow;
      setWorkflow(queuedWorkflow);

      // The API action only queues an outbox event. Wait for the worker and
      // LangGraph to publish the new projection before allowing the next step.
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const latest = (await api.workflows.get(id)).workflow;
        setWorkflow(latest);
        if (latest.updatedAt !== queuedWorkflow.updatedAt || ["failed", "succeeded"].includes(latest.status)) break;
      }
      await load(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not update the workflow.");
    } finally {
      setActionLoadingId(null);
    }
  }

  function decide(approvalId: string, type: "approve" | "decline") {
    if (!household || !["owner", "admin"].includes(household.currentMember.role)) return;
    void submitAction({ type, approvalId }, approvalId);
  }

  function sendProviderRequest() {
    const text = requestText.trim();
    if (!text) {
      setError("Describe the item or change you want to request.");
      return;
    }
    const intent = requestKind === "add_item" ? `Add item: ${text}` : requestKind === "replace_item" ? `Replace item: ${text}` : text;
    void submitAction({ type: "provider_action", intent }, "member-request");
    setRequestText("");
  }

  function sendCommand(intent: string, loadingId: string) {
    void submitAction({ type: "provider_action", intent }, loadingId);
  }

  if (loading) {
    return <ScreenScroll bottomInset={insets.bottom + 112} contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}><ActivityIndicator color={theme.accent} /></ScreenScroll>;
  }

  if (!workflow) {
    return <ScreenScroll bottomInset={insets.bottom + 112}><Surface><MiykoText variant="section">Workflow unavailable</MiykoText><MiykoText variant="body" color="danger">{error ?? "The API did not return this workflow."}</MiykoText><PrimaryButton label="Retry" loading={refreshing} onPress={() => void load(false)} /></Surface></ScreenScroll>;
  }

  const pending = workflow.approvals.filter((approval) => approval.status === "pending");
  const canApprove = household ? ["owner", "admin"].includes(household.currentMember.role) : false;
  const checkoutUrl = workflowView?.checkoutUrl ?? null;
  const workflowCompleted = workflow.status === "succeeded" || workflowView?.phase === "completed";
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
      {workflow.status === "failed" && <MiykoText variant="caption" color="danger">Workflow processing failed. Check the workflow logs before starting a new request.</MiykoText>}
      <SecondaryButton label="Refresh latest state" disabled={Boolean(actionLoadingId) || refreshing} onPress={() => void load(false)} />

      {(!workflow.runId || workflow.status === "pending") && <Surface>
        <MiykoText variant="section">Workflow is queued</MiykoText>
        <MiykoText variant="body" color="textSecondary">The API created the workflow. The outbox worker is starting its LangGraph run; refresh this screen after a moment.</MiykoText>
      </Surface>}

      <Surface>
        <MiykoText variant="section">Last observed state</MiykoText>
        <MiykoText variant="body" color="textSecondary">LangGraph and the provider own conversation, recipe, products, basket, fulfillment and pause/resume state. These are the latest references returned by the API, not a local copy.</MiykoText>
        <View style={styles.referenceGrid}>{refs.map(([label, value]) => <View key={label} style={styles.reference}><MiykoText variant="caption" color="textSecondary">{label}</MiykoText><MiykoText variant="body">{value ?? "Not returned"}</MiykoText></View>)}</View>
      </Surface>

      {workflowView && <Surface>
        <View style={styles.titleRow}><MiykoText variant="section">Live order plan</MiykoText><StatusPill label={workflowView.phase === "completed" ? "basket completed" : workflowView.phase.replace(/_/g, " ")} tone={workflowView.phase === "approval_required" ? "warning" : workflowView.phase === "completed" ? "success" : "accent"} /></View>
        <MiykoText variant="body" color="textSecondary">{workflowView.summary}</MiykoText>
        {workflowView.plannedRequests.map((request, index) => <MiykoText key={`${request.memberId}-${index}`} variant="body">• {request.text}</MiykoText>)}
        {workflowView.items.map((item, index) => <View key={`${item.name}-${index}`} style={styles.reference}><MiykoText variant="body">{item.name}{item.quantity ? ` · ${item.quantity}` : ""}</MiykoText><MiykoText variant="caption" color="textSecondary">{item.price === null ? "Price not returned" : `${item.price} ${workflowView.currency ?? ""}`}</MiykoText></View>)}
        {workflowView.total !== null && <MiykoText variant="section">Total: {workflowView.total} {workflowView.currency ?? ""}</MiykoText>}
        {checkoutUrl && <PrimaryButton label="Open Silpo checkout" icon="cart" onPress={() => void Linking.openURL(checkoutUrl)} />}
      </Surface>}

      {!workflowCompleted && <Surface>
        <MiykoText variant="section">Household approvals</MiykoText>
        {pending.length === 0 ? <MiykoText variant="body" color="textSecondary">No pending approval.</MiykoText> : pending.map((approval) => <View key={approval.id} style={[styles.approval, { borderTopColor: theme.border }]}>
          <View style={styles.titleRow}><View style={{ flex: 1, gap: Spacing.one }}><MiykoText variant="body">{approval.action.replace(/_/g, " ")}</MiykoText><MiykoText variant="caption" color="textSecondary">Approval ID: {approval.id}</MiykoText></View><StatusPill label="Pending" tone="warning" /></View>
          {canApprove ? <View style={styles.actions}><PrimaryButton label="Approve" icon="cart" loading={actionLoadingId === approval.id} disabled={Boolean(actionLoadingId && actionLoadingId !== approval.id)} onPress={() => decide(approval.id, "approve")} /><SecondaryButton label="Decline" disabled={Boolean(actionLoadingId)} onPress={() => decide(approval.id, "decline")} /></View> : <MiykoText variant="caption" color="textSecondary">Only a household owner or admin can approve or decline this action.</MiykoText>}
        </View>)}
      </Surface>}

      {!workflowCompleted && <Surface>
        <MiykoText variant="section">Request a workflow change</MiykoText>
        <MiykoText variant="body" color="textSecondary">Members can send a typed request to the managed workflow. Provider tools and credentials stay behind the API.</MiykoText>
        <SegmentedButtons value={requestKind} onValueChange={(value) => setRequestKind(value as MemberRequestKind)} buttons={[{ value: "add_item", label: "Add" }, { value: "replace_item", label: "Replace" }, { value: "instruction", label: "Command" }]} />
        <Field label="REQUEST" placeholder={requestKind === "instruction" ? "e.g. prepare the basket" : "e.g. oat milk"} value={requestText} onChangeText={setRequestText} />
        <PrimaryButton label="Send request" loading={actionLoadingId === "member-request"} disabled={Boolean(actionLoadingId && actionLoadingId !== "member-request")} onPress={sendProviderRequest} icon="arrow" />
        {canApprove && <View style={styles.actions}>
          <SecondaryButton label="Prepare order" disabled={Boolean(actionLoadingId)} onPress={() => sendCommand("Prepare the Silpo order from the confirmed household plan. Use pickup, create or reuse the provider basket, add or update the confirmed products, and read back the current basket. Do not place the order.", "prepare-order")} />
          <SecondaryButton label="Confirm basket" disabled={Boolean(actionLoadingId)} onPress={() => void submitAction({ type: "confirm_basket" }, "confirm-basket")} />
        </View>}
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
};
