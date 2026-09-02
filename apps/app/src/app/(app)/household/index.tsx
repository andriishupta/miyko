import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native-paper';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '@/api/client';
import type { ApiHouseholdMember, ApiHouseholdSummary } from '@/api/types';
import { AppIcon, Avatar, MiykoText, PrimaryButton, ScreenScroll, SectionTitle, StatusPill, Surface } from '@/components/miyko-ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const avatarColors = ['#B8D8C0', '#F3C9A8', '#C7C1EA', '#F4D58D'];

export default function HouseholdScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [household, setHousehold] = useState<ApiHouseholdSummary | null>(null);
  const [members, setMembers] = useState<ApiHouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.household.summary(), api.household.members()])
      .then(([summary, nextMembers]) => {
        if (!active) return;
        setHousehold(summary);
        setMembers(nextMembers);
      })
      .catch((cause) => { if (active) setError(cause instanceof ApiError ? cause.message : 'Could not load household.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  if (loading && !household) return <ScreenScroll bottomInset={insets.bottom + 112} contentContainerStyle={styles.centered}><ActivityIndicator color={theme.accent} /></ScreenScroll>;
  if (!household) return <ScreenScroll bottomInset={insets.bottom + 112}><Surface><MiykoText variant="section">Household unavailable</MiykoText><MiykoText variant="body" color="textSecondary">{error ?? 'The API did not return household data.'}</MiykoText><PrimaryButton label="Try again" onPress={() => setReloadKey((value) => value + 1)} /></Surface></ScreenScroll>;

  return (
    <>
      <Stack.Screen options={{ title: 'Manage your household', headerLargeTitle: true }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <Surface style={styles.householdCard}><View style={[styles.householdMark, { backgroundColor: theme.accent }]}><MiykoText variant="section" color="accentContrast">{household.name.slice(0, 2).toUpperCase()}</MiykoText></View><View style={{ flex: 1, gap: 3 }}><MiykoText variant="section">{household.name}</MiykoText><MiykoText variant="body" color="textSecondary">{members.length} members</MiykoText></View><StatusPill label={household.currentMember.role} tone="accent" /></Surface>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Members" action={`${members.length} people`} /><Surface>{members.map((member, index) => <MemberRow key={member.id} member={member} color={avatarColors[index % avatarColors.length]} />)}</Surface></View>
        {household.currentMember.role === 'owner' && <PrimaryButton label="Invite a member" icon="plus" onPress={() => router.push('/household/invite')} />}
        <Surface style={styles.permissionCard}><AppIcon name="person" size={20} color={theme.accent} /><View style={{ flex: 1, gap: 4 }}><MiykoText variant="section">Approval permissions</MiykoText><MiykoText variant="body" color="textSecondary">Only the owner can approve a proposal and update the real Silpo basket.</MiykoText></View></Surface>
      </ScreenScroll>
    </>
  );
}

function MemberRow({ member, color }: { member: ApiHouseholdMember; color: string }) {
  const theme = useTheme();
  const name = member.user?.displayName ?? member.user?.email ?? member.userId;
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <View style={styles.memberRow}><Avatar initials={initials} color={color} /><View style={{ flex: 1, gap: 2 }}><MiykoText variant="body">{name}</MiykoText><MiykoText variant="caption" color="textSecondary">{member.user?.email ?? 'Email unavailable'} · {member.role}</MiykoText></View><View style={styles.memberStatus}><View style={[styles.statusDot, { backgroundColor: theme.success }]} /><MiykoText variant="caption" color="textSecondary">Active</MiykoText></View></View>;
}

const styles = StyleSheet.create({
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  householdCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  householdMark: { width: 54, height: 54, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  memberStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: Radius.pill },
  permissionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
});
