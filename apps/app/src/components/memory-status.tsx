import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native-paper";
import { api, ApiError } from "@/api/client";
import type { ApiMemoryStatus } from "@/api/types";
import { MiykoText, PrimaryButton, SecondaryButton, StatusPill, Surface } from "@/components/miyko-ui";
import { useTheme } from "@/hooks/use-theme";

export function MemoryStatus() {
  const theme = useTheme();
  const [status, setStatus] = useState<ApiMemoryStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setStatus(await api.memory.status()); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Memory status is not available."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const ready = status?.managed === true;
  const statusLabel = error ? "Unavailable" : status === null ? "Loading" : ready ? status.provider : "Unavailable";
  return <Surface><MiykoText variant="section">Long-term memory</MiykoText>{status === null && !error && <ActivityIndicator color={theme.accent} />}{(status !== null || error) && <><StatusPill label={statusLabel} tone={ready ? "success" : "warning"} /><MiykoText variant="body" color="textSecondary">MiyKo stores household preferences in managed memory. The application database keeps no memory records.</MiykoText></>}{error && <MiykoText variant="caption" color="danger">{error}</MiykoText>}<SecondaryButton label="Refresh memory status" disabled={status === null} onPress={() => void load()} />{error && <PrimaryButton label="Retry" onPress={() => void load()} />}</Surface>;
}
