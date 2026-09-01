import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, Avatar, MiykoText, PrimaryButton, ScreenScroll, SectionTitle, StatusPill, Surface } from '@/components/miyko-ui';
import { Radius, Spacing } from '@/constants/theme';
import { household, members } from '@/data/mock-data';
import { useTheme } from '@/hooks/use-theme';

export default function HouseholdScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ title: 'Manage your household', headerLargeTitle: true }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <Surface style={styles.householdCard}><View style={[styles.householdMark, { backgroundColor: theme.accent }]}><MiykoText variant="section" color="accentContrast">{household.initials}</MiykoText></View><View style={{ flex: 1, gap: 3 }}><MiykoText variant="section">{household.name}</MiykoText><MiykoText variant="body" color="textSecondary">{household.note}</MiykoText></View><StatusPill label="Owner" tone="accent" /></Surface>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Members" action="3 people" /><Surface>{members.map((member) => <MemberRow key={member.id} member={member} />)}</Surface></View>
        <PrimaryButton label="Invite a member" icon="plus" onPress={() => router.push('/household/invite')} />
        <Surface style={styles.permissionCard}><AppIcon name="person" size={20} color={theme.accent} /><View style={{ flex: 1, gap: 4 }}><MiykoText variant="section">Approval permissions</MiykoText><MiykoText variant="body" color="textSecondary">Only the owner can approve a proposal and update the real Silpo basket. This screen uses mock state for now.</MiykoText></View></Surface>
      </ScreenScroll>
    </>
  );
}

function MemberRow({ member }: { member: (typeof members)[number] }) {
  const theme = useTheme();
  return <View style={styles.memberRow}><Avatar initials={member.initials} color={member.color} /><View style={{ flex: 1, gap: 2 }}><MiykoText variant="body">{member.name}</MiykoText><MiykoText variant="caption" color="textSecondary">{member.role}</MiykoText></View><View style={styles.memberStatus}><View style={[styles.statusDot, { backgroundColor: member.status === 'Active' ? theme.success : theme.warning }]} /><MiykoText variant="caption" color="textSecondary">{member.status}</MiykoText></View></View>;
}

const styles = StyleSheet.create({
  householdCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  householdMark: { width: 54, height: 54, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  memberStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: Radius.pill },
  permissionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
});
