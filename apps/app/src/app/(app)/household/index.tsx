import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native-paper';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { ApiHouseholdMember, ApiHouseholdSummary } from '@/api/types';
import { AppIcon, Avatar, MiykoText, PrimaryButton, ScreenScroll, SectionTitle, StatusPill, Surface } from '@/components/miyko-ui';
import { ProviderManagement } from '@/components/provider-management';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const avatarColors = ['#B8D8C0', '#F3C9A8', '#C7C1EA', '#F4D58D'];
const memberRoleOrder: Record<ApiHouseholdMember['role'], number> = { owner: 0, admin: 1, editor: 2, viewer: 3 };

export default function HouseholdScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [household, setHousehold] = useState<ApiHouseholdSummary | null>(null);
  const [members, setMembers] = useState<ApiHouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([api.household.summary(), api.household.members()])
      .then(([summary, nextMembers]) => {
        if (!active) return;
        setHousehold(summary);
        setMembers(nextMembers);
      })
    .catch((cause) => { if (active) setError(cause instanceof ApiError ? cause.message : 'Could not load household.'); })
    .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]));

  if (loading && !household) return <ScreenScroll contentContainerStyle={styles.centered}><ActivityIndicator color={theme.accent} /></ScreenScroll>;
  if (!household) return <ScreenScroll><Surface><MiykoText variant="section">Household unavailable</MiykoText><MiykoText variant="body" color="textSecondary">{error ?? 'Your household could not be loaded.'}</MiykoText><PrimaryButton label="Try again" onPress={() => setReloadKey((value) => value + 1)} /></Surface></ScreenScroll>;

  const sortedMembers = [...members].sort((left, right) => {
    if (left.id === household.currentMember.id) return -1;
    if (right.id === household.currentMember.id) return 1;
    return memberRoleOrder[left.role] - memberRoleOrder[right.role];
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Household', headerLargeTitle: false, headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel="Back to MiyKo" hitSlop={12} onPress={() => router.canGoBack() ? router.back() : router.replace('/home')}><AppIcon name="back" size={21} color={theme.text} /></Pressable> }} />
      <ScreenScroll contentContainerStyle={styles.content}>
        <Surface style={styles.householdCard}><View style={[styles.householdMark, { backgroundColor: theme.accent }]}><MiykoText variant="section" color="accentContrast">{household.name.slice(0, 2).toUpperCase()}</MiykoText></View><View style={{ flex: 1, gap: 3 }}><MiykoText variant="section">{household.name}</MiykoText><MiykoText variant="body" color="textSecondary">{members.length} members</MiykoText></View><StatusPill label={household.currentMember.role} tone="accent" /></Surface>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Members" action={`${members.length} people`} /><Surface>{sortedMembers.map((member, index) => <MemberRow key={member.id} member={member} color={avatarColors[index % avatarColors.length]} isCurrent={member.id === household.currentMember.id} />)}</Surface></View>
        {household.currentMember.role === 'owner' && <PrimaryButton label="Invite a member" icon="plus" onPress={() => router.push('/household/invite')} />}
        <View style={{ gap: Spacing.two }}><SectionTitle title="Store account" /><ProviderManagement /></View>
      </ScreenScroll>
    </>
  );
}

function MemberRow({ member, color, isCurrent }: { member: ApiHouseholdMember; color: string; isCurrent: boolean }) {
  const theme = useTheme();
  const name = member.user?.displayName ?? member.user?.email ?? member.userId;
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <View style={styles.memberRow}><Avatar initials={initials} color={color} /><View style={{ flex: 1, gap: 2 }}><MiykoText variant="body">{name}</MiykoText><MiykoText variant="caption" color="textSecondary">{member.user?.email ?? 'Email unavailable'} · {member.role}</MiykoText></View>{isCurrent ? <StatusPill label="You" tone="accent" /> : <View style={styles.memberStatus}><View style={[styles.statusDot, { backgroundColor: theme.success }]} /><MiykoText variant="caption" color="textSecondary">Active</MiykoText></View>}</View>;
}

const styles = StyleSheet.create({
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.three },
  householdCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  householdMark: { width: 54, height: 54, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  memberStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: Radius.pill },
});
