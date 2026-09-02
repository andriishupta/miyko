import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native-paper';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '@/api/client';
import type { ApiHouseholdSummary, ApiOrderProposal } from '@/api/types';
import { MiykoText, PrimaryButton, ScreenScroll, SecondaryButton, StatusPill, Surface } from '@/components/miyko-ui';
import { Spacing } from '@/constants/theme';
import { formatMoney } from '@/api/presenters';
import { useTheme } from '@/hooks/use-theme';

export default function ProposalReviewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [proposal, setProposal] = useState<ApiOrderProposal | null>(null);
  const [household, setHousehold] = useState<ApiHouseholdSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([api.orders.get(id), api.household.summary()])
      .then(([nextProposal, nextHousehold]) => {
        if (!active) return;
        setProposal(nextProposal);
        setHousehold(nextHousehold);
      })
      .catch((cause) => { if (active) setError(cause instanceof ApiError ? cause.message : 'Could not load proposal.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  async function decide(decision: 'approve' | 'decline') {
    if (!id || !proposal || household?.currentMember.role !== 'owner' || actionLoading) return;
    setActionLoading(true);
    setError(null);
    setMessage(null);
    const idempotencyKey = `proposal-${id}-${decision}-${Date.now()}`;
    try {
      const updated = decision === 'approve' ? await api.orders.approve(id, idempotencyKey) : await api.orders.decline(id, idempotencyKey);
      setProposal(updated);
      setMessage(decision === 'approve' ? 'Proposal approved. The API will synchronize the provider basket.' : 'Proposal declined.');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : `Could not ${decision} proposal.`);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <ScreenScroll bottomInset={insets.bottom + 112} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}><ActivityIndicator color={theme.accent} /></ScreenScroll>;
  if (!proposal) return <ScreenScroll bottomInset={insets.bottom + 112}><Surface><MiykoText variant="section">Proposal unavailable</MiykoText><MiykoText variant="body" color="danger">{error ?? 'The API did not return this proposal.'}</MiykoText></Surface></ScreenScroll>;

  const total = proposal.items.reduce((sum, item) => sum + (item.estimatedTotalPrice ?? 0), 0);
  const canApprove = household?.currentMember.role === 'owner' && ['draft', 'awaiting_changes', 'awaiting_owner_approval'].includes(proposal.status);

  return (
    <>
      <Stack.Screen options={{ title: 'Proposal review' }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <View style={{ gap: Spacing.two }}><MiykoText variant="title">Review basket</MiykoText><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two }}><StatusPill label={proposal.status.replace(/_/g, ' ')} tone={proposal.status === 'awaiting_owner_approval' ? 'warning' : proposal.status === 'approved' || proposal.status === 'applied' ? 'success' : 'neutral'} /><MiykoText variant="caption" color="textSecondary">Revision {proposal.revision}</MiykoText></View></View>
        {error && <MiykoText variant="caption" color="danger">{error}</MiykoText>}
        {message && <MiykoText variant="caption" color="success">{message}</MiykoText>}
        <View style={{ gap: Spacing.two }}>{proposal.items.map((item) => <Surface key={item.id}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }}><View style={{ flex: 1, gap: Spacing.one }}><MiykoText variant="body">{item.productName}</MiykoText><MiykoText variant="caption" color="textSecondary">{item.quantity} {item.unit} · {item.status}</MiykoText></View><MiykoText variant="label">{item.estimatedTotalPrice === null ? 'Price unavailable' : formatMoney(item.estimatedTotalPrice, item.currency)}</MiykoText></View></Surface>)}</View>
        <Surface><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><MiykoText variant="body" color="textSecondary">Estimated total</MiykoText><MiykoText variant="title">{formatMoney(total, proposal.items[0]?.currency ?? 'UAH')}</MiykoText></View></Surface>
        {household?.currentMember.role !== 'owner' && <Surface><MiykoText variant="section">Owner approval required</MiykoText><MiykoText variant="body" color="textSecondary">Only the household owner can approve or decline this basket.</MiykoText></Surface>}
        {canApprove && <View style={{ gap: Spacing.two }}><PrimaryButton label="Approve basket" loading={actionLoading} onPress={() => void decide('approve')} icon="cart" /><SecondaryButton label="Decline proposal" onPress={() => void decide('decline')} /></View>}
      </ScreenScroll>
    </>
  );
}
