import { Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Linking, Platform, StyleSheet, View } from "react-native";
import { ActivityIndicator, List, TextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { WorkflowActionRequest } from "@miyko/contracts";
import { api, ApiError } from "@/api/client";
import type { ApiHouseholdMember, ApiHouseholdSummary, ApiWorkflow, ApiWorkflowView } from "@/api/types";
import { AppIcon, IconButton, MiykoText, PrimaryButton, ScreenScroll, SecondaryButton, StatusPill, Surface } from "@/components/miyko-ui";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const statusCopy: Record<ApiWorkflow["status"], string> = {
  pending: "Starting",
  running: "In progress",
  interrupted: "Waiting for approval",
  succeeded: "Completed",
  failed: "Could not complete",
  cancelled: "Cancelled",
};

const phaseCopy: Record<ApiWorkflowView["phase"], string> = {
  collecting: "Building the plan",
  approval_required: "Waiting for approval",
  basket_ready: "Basket ready",
  ready_for_checkout: "Ready to checkout",
  completed: "Completed",
};

export default function WorkflowScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [workflow, setWorkflow] = useState<ApiWorkflow | null>(null);
  const [workflowView, setWorkflowView] = useState<ApiWorkflowView | null>(null);
  const [household, setHousehold] = useState<ApiHouseholdSummary | null>(null);
  const [members, setMembers] = useState<ApiHouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [developerInfoOpen, setDeveloperInfoOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(true);
  const [approvalsOpen, setApprovalsOpen] = useState(false);

  const load = useCallback(async (showLoading = true) => {
    if (!id) return;
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [result, summary, householdMembers] = await Promise.all([api.workflows.get(id), api.household.summary(), api.household.members()]);
      setWorkflow(result.workflow);
      setHousehold(summary);
      setMembers(householdMembers);
      if (["pending", "failed", "cancelled"].includes(result.workflow.status) || !result.workflow.runId) {
        setWorkflowView(null);
        return;
      }
      try {
        setWorkflowView((await api.workflows.view(id)).view);
      } catch (cause) {
        setWorkflowView(null);
        setError(cause instanceof ApiError ? cause.message : "The latest plan is not available yet.");
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not load this chat.");
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
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const latest = (await api.workflows.get(id)).workflow;
        setWorkflow(latest);
        if (latest.updatedAt !== queuedWorkflow.updatedAt || ["failed", "succeeded"].includes(latest.status)) break;
      }
      await load(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not update this chat.");
    } finally {
      setActionLoadingId(null);
    }
  }

  function sendMessage() {
    const text = message.trim();
    if (!text) return;
    setMessage("");
    void submitAction({ type: "provider_action", intent: text }, "message");
  }

  function decide(approvalId: string, type: "approve" | "decline") {
    if (!household || !["owner", "admin"].includes(household.currentMember.role)) return;
    void submitAction({ type, approvalId }, approvalId);
  }

  if (loading) return <ScreenScroll contentContainerStyle={styles.centered}><ActivityIndicator color={theme.accent} /></ScreenScroll>;
  if (!workflow) return <ScreenScroll><Surface><MiykoText variant="section">Chat unavailable</MiykoText><MiykoText variant="body" color="danger">{error ?? "This chat could not be loaded."}</MiykoText><PrimaryButton label="Try again" loading={refreshing} onPress={() => void load(false)} /></Surface></ScreenScroll>;

  const pending = workflow.approvals.filter((approval) => approval.status === "pending");
  const canApprove = household ? ["owner", "admin"].includes(household.currentMember.role) : false;
  const workflowCompleted = workflow.status === "succeeded" || workflowView?.phase === "completed";
  const chatTitle = getChatTitle(workflowView);
  const membersById = new Map(members.map((member) => [member.id, member.user?.displayName ?? member.user?.email ?? "Household member"]));
  const planLabel = workflowView ? phaseCopy[workflowView.phase] : "Not ready yet";
  const canConfirm = canApprove && workflowView && ["basket_ready", "ready_for_checkout"].includes(workflowView.phase);
  const canPrepare = canApprove && !canConfirm && !workflowCompleted;
  const statusColor = workflow.status === "failed" ? theme.danger : workflow.status === "succeeded" ? theme.success : pending.length ? theme.warning : theme.accent;

  return <>
    <Stack.Screen options={{ title: chatTitle }} />
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: theme.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}>
      <ScreenScroll style={styles.content}>
        <View style={styles.chatHeader}><MiykoText variant="section">{chatTitle}</MiykoText><View style={styles.chatHeaderActions}><View style={styles.statusRow}><View style={[styles.statusDot, { backgroundColor: statusColor }]} /><MiykoText variant="caption" style={{ color: statusColor }}>{statusCopy[workflow.status]}</MiykoText></View><IconButton name="refresh" label="Refresh chat" disabled={Boolean(actionLoadingId) || refreshing} onPress={() => void load(false)} /></View></View>
        {error && <MiykoText variant="caption" color="danger">{error}</MiykoText>}
        {workflow.status === "failed" && <Surface style={styles.notice}><MiykoText variant="body" color="danger">Something went wrong while preparing this request. You can continue the conversation or start a new chat.</MiykoText></Surface>}

        {!workflow.runId && <Surface style={styles.notice}><MiykoText variant="body" color="textSecondary">We&apos;re getting this chat ready. Refresh in a moment.</MiykoText></Surface>}

        <AccordionCard title="Live order" summary={planLabel} expanded={planOpen} onPress={() => setPlanOpen((value) => !value)}>
          {!workflowView ? <MiykoText variant="body" color="textSecondary">The plan will appear here as soon as it is ready.</MiykoText> : <View style={styles.planBody}>
            <MiykoText variant="body" color="textSecondary">{getUserFacingSummary(workflowView.summary)}</MiykoText>
            {workflowView.plannedRequests.map((request, index) => <View key={`${request.memberId}-${index}`} style={[styles.bubble, { backgroundColor: theme.accentSoft }]}><MiykoText variant="body">{request.text}</MiykoText></View>)}
            {workflowView.items.length > 0 && <View style={styles.productList}>{workflowView.items.map((item, index) => <ProductRow key={`${item.name}-${index}`} item={item} currency={workflowView.currency} />)}</View>}
            {workflowView.total !== null && <MiykoText variant="section">Total: {workflowView.total} {workflowView.currency ?? ""}</MiykoText>}
            {workflowView.checkoutUrl && <PrimaryButton label="Open checkout" icon="cart" onPress={() => void Linking.openURL(workflowView.checkoutUrl as string)} />}
          </View>}
        </AccordionCard>

        <AccordionCard title="Household approvals" summary={pending.length ? `${pending.length} waiting` : "All clear"} expanded={approvalsOpen} onPress={() => setApprovalsOpen((value) => !value)}>
          {workflow.approvals.length === 0 ? <MiykoText variant="body" color="textSecondary">No approval needed.</MiykoText> : <View style={styles.approvalList}>{workflow.approvals.map((approval) => {
            const requestedText = approval.externalRequestId === workflowView?.pendingApproval?.requestId ? workflowView.pendingApproval.text : null;
            return <View key={approval.id} style={[styles.approval, { borderTopColor: theme.border }]}><View style={styles.approvalHeading}><View style={styles.approvalCopy}><MiykoText variant="body">{approval.status === "pending" ? "Waiting for a decision" : approval.status === "approved" ? "Approved" : "Declined"}</MiykoText>{requestedText && <MiykoText variant="body">“{requestedText}”</MiykoText>}<MiykoText variant="caption" color="textSecondary">{approval.status === "pending" ? `Requested by ${membersById.get(approval.requestedByMemberId) ?? "a household member"}` : `Decided by ${membersById.get(approval.decidedByMemberId ?? "") ?? "a household member"}`}</MiykoText></View><StatusPill label={approval.status === "pending" ? "Waiting" : approval.status === "approved" ? "Approved" : "Declined"} tone={approval.status === "approved" ? "success" : approval.status === "pending" ? "warning" : "neutral"} /></View>{approval.status === "pending" && canApprove && <View style={styles.actions}><PrimaryButton label="Approve" icon="cart" loading={actionLoadingId === approval.id} disabled={Boolean(actionLoadingId && actionLoadingId !== approval.id)} onPress={() => decide(approval.id, "approve")} /><SecondaryButton label="Decline" disabled={Boolean(actionLoadingId)} onPress={() => decide(approval.id, "decline")} /></View>}</View>;
          })}</View>}
        </AccordionCard>

        <AccordionCard title="Developer information" summary="IDs and references" expanded={developerInfoOpen} onPress={() => setDeveloperInfoOpen((value) => !value)}>
          <View style={styles.developerGrid}>{[["Workflow ID", workflow.id], ["Thread", workflow.threadId], ["Run", workflow.runId], ["Provider", workflow.providerId], ["Basket", workflow.providerBasketId], ["Order", workflow.providerOrderId]].map(([label, value]) => <View key={label} style={styles.developerRow}><MiykoText variant="caption" color="textSecondary">{label}</MiykoText><MiykoText variant="body">{value ?? "Not available"}</MiykoText></View>)}</View>
        </AccordionCard>

        {!workflowCompleted && canApprove && <View style={styles.commandRow}>{canPrepare && <PrimaryButton label="Prepare order" loading={actionLoadingId === "prepare-order"} disabled={Boolean(actionLoadingId)} onPress={() => void submitAction({ type: "provider_action", intent: "Prepare the order from the confirmed household plan." }, "prepare-order")} />}{canConfirm && <PrimaryButton label="Confirm basket" loading={actionLoadingId === "confirm-basket"} disabled={Boolean(actionLoadingId)} onPress={() => void submitAction({ type: "confirm_basket" }, "confirm-basket")} />}</View>}
        {!workflowCompleted && !canApprove && pending.length > 0 && <MiykoText variant="caption" color="textSecondary">A household owner or admin will review the next step.</MiykoText>}
      </ScreenScroll>
      {!workflowCompleted && <View style={[styles.composer, { backgroundColor: theme.backgroundElement, borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.two }]}><IconButton name="mic" label="Voice input coming soon" disabled onPress={() => undefined} /><TextInput mode="outlined" value={message} onChangeText={setMessage} placeholder="Message this chat" textColor={theme.text} outlineColor={theme.border} activeOutlineColor={theme.accent} multiline numberOfLines={2} contentStyle={styles.inputContent} outlineStyle={styles.inputOutline} style={styles.input} onSubmitEditing={() => sendMessage()} /><IconButton name="arrow" label="Send message" onPress={sendMessage} /></View>}
    </KeyboardAvoidingView>
  </>;
}

function ProductRow({ item, currency }: { item: ApiWorkflowView["items"][number]; currency: string | null }) {
  const theme = useTheme();
  return <View style={[styles.productRow, { borderColor: theme.border }]}>
    {item.imageUrl
      ? <Image source={{ uri: item.imageUrl }} accessibilityLabel={item.name} contentFit="cover" transition={150} style={styles.productImage} />
      : <View style={[styles.productPlaceholder, { backgroundColor: theme.backgroundSelected }]}><AppIcon name="cart" size={20} color={theme.textSecondary} /></View>}
    <View style={styles.productCopy}>
      <MiykoText variant="body" numberOfLines={2}>{item.name}</MiykoText>
      {item.quantity && <MiykoText variant="caption" color="textSecondary">{item.quantity}</MiykoText>}
    </View>
    <MiykoText variant="label" style={styles.productPrice}>{formatPrice(item.price, currency)}</MiykoText>
  </View>;
}

function formatPrice(price: number | null, currency: string | null) {
  if (price === null) return "—";
  return `${price.toFixed(2)}${currency ? ` ${currency}` : ""}`;
}

function AccordionCard({ title, summary, expanded, onPress, children }: { title: string; summary: string; expanded: boolean; onPress: () => void; children: ReactNode }) {
  const theme = useTheme();
  return <Surface style={styles.accordionCard}><List.Accordion title={title} description={summary} expanded={expanded} onPress={onPress} right={({ isExpanded }) => <AppIcon name={isExpanded ? "chevronUp" : "chevronDown"} size={18} color={theme.textSecondary} />} titleStyle={{ color: theme.text, fontWeight: "700" }} descriptionStyle={{ color: theme.textSecondary }} style={styles.accordion}>{children}</List.Accordion></Surface>;
}

function getChatTitle(view: ApiWorkflowView | null) {
  const firstRequest = view?.plannedRequests[0]?.text?.trim();
  const source = firstRequest || (view ? getUserFacingSummary(view.summary) : null);
  if (!source) return "New chat";
  return source.length > 34 ? `${source.slice(0, 31)}…` : source;
}

function getUserFacingSummary(summary: string) {
  const value = summary.trim();
  if (/initial request saved/i.test(value)) return "Initial request saved.";
  if (/langgraph|mem0|\bmcp\b|graph state/i.test(value)) return "Your request was updated.";
  return value;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  centered: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  chatHeader: { gap: Spacing.one },
  chatHeaderActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.one },
  statusRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two, flexShrink: 1 },
  statusDot: { width: 7, height: 7, borderRadius: Radius.pill },
  notice: { paddingVertical: Spacing.two },
  accordionCard: { padding: 0, overflow: "hidden" },
  accordion: { paddingHorizontal: Spacing.two },
  planBody: { gap: Spacing.two, paddingHorizontal: Spacing.two, paddingBottom: Spacing.two },
  bubble: { alignSelf: "flex-start", maxWidth: "88%", paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.medium },
  productList: { gap: Spacing.two },
  productRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: Spacing.two, padding: Spacing.two, borderWidth: 1, borderRadius: Radius.small, borderCurve: "continuous" },
  productImage: { width: 56, height: 56, borderRadius: Radius.small },
  productPlaceholder: { width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: Radius.small, borderCurve: "continuous" },
  productCopy: { flex: 1, gap: Spacing.one },
  productPrice: { flexShrink: 0, fontVariant: ["tabular-nums"] },
  approvalList: { gap: Spacing.two, paddingHorizontal: Spacing.two, paddingBottom: Spacing.two },
  approval: { gap: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1 },
  approvalHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: Spacing.two },
  approvalCopy: { flex: 1, gap: Spacing.one },
  actions: { gap: Spacing.two },
  developerGrid: { gap: Spacing.two, paddingHorizontal: Spacing.two, paddingBottom: Spacing.two },
  developerRow: { gap: Spacing.one },
  commandRow: { gap: Spacing.two },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.one, paddingHorizontal: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1 },
  input: { flex: 1, maxHeight: 96 },
  inputContent: { minHeight: 50, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  inputOutline: { borderRadius: Radius.medium },
});
