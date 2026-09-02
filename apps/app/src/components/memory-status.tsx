import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native-paper";
import { api, ApiError } from "@/api/client";
import { MiykoText, PrimaryButton, StatusPill, Surface } from "@/components/miyko-ui";
import { useTheme } from "@/hooks/use-theme";

export function MemoryStatus() {
  const theme = useTheme();
  const [managed, setManaged] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setManaged((await api.memory.status()).managed); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Memory status is not available."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <Surface><MiykoText variant="section">Long-term memory</MiykoText>{managed === null && !error && <ActivityIndicator color={theme.accent} />}{managed !== null && <><StatusPill label={managed ? "Mem0 Cloud" : "Unavailable"} tone={managed ? "success" : "warning"} /><MiykoText variant="body" color="textSecondary">MiyKo stores household preferences in Mem0 Cloud. The application database keeps no memory records.</MiykoText></>}{error && <><MiykoText variant="caption" color="danger">{error}</MiykoText><PrimaryButton label="Retry" onPress={() => void load()} /></>}</Surface>;
}
