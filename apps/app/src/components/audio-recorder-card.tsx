import { useState } from 'react';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import { ActivityIndicator, FAB } from 'react-native-paper';
import { StyleSheet, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { ApiAudioProcessResponse } from '@/api/types';
import { AppIcon, MiykoText, StatusPill, Surface } from '@/components/miyko-ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function AudioRecorderCard() {
  const theme = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ApiAudioProcessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ensureAudioPermission() {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      setPermissionGranted(permission.granted);
      if (!permission.granted) {
        setError('Microphone permission is required to record an idea.');
        return false;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      return true;
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not prepare audio recording.');
      return false;
    }
  }

  async function toggleRecording() {
    if (uploading) return;
    setError(null);
    setResult(null);
    try {
      if (recorderState.isRecording) {
        const durationSeconds = Math.max(1, Math.round(recorderState.durationMillis / 1000));
        await recorder.stop();
        if (!recorder.uri) throw new Error('The recording file was not created.');
        setUploading(true);
        const audioBase64 = await new File(recorder.uri).base64();
        const isWeb = process.env.EXPO_OS === 'web';
        const response = await api.audio.process({
          fileName: `miyko-idea-${Date.now()}.${isWeb ? 'webm' : 'm4a'}`,
          mimeType: isWeb ? 'audio/webm' : 'audio/m4a',
          durationSeconds,
          audioBase64,
        });
        setResult(response);
      } else {
        if (!permissionGranted) {
          if (!await ensureAudioPermission()) return;
        }
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not record or process the audio idea.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <MiykoText variant="caption" color="textSecondary">HAVE AN IDEA?</MiykoText>
      <FAB accessibilityLabel={recorderState.isRecording ? 'Stop recording' : 'Record an audio idea'} icon={() => <AppIcon name={recorderState.isRecording ? 'arrow' : 'mic'} size={30} color={theme.accentContrast} />} color={theme.accentContrast} customSize={84} mode="elevated" style={[styles.audioButton, { backgroundColor: theme.accent }]} onPress={() => void toggleRecording()} />
      <MiykoText variant="section">{recorderState.isRecording ? 'Recording an audio idea' : 'Record an audio idea'}</MiykoText>
      <MiykoText variant="caption" color="textSecondary" style={styles.center}>{recorderState.isRecording ? `${Math.round(recorderState.durationMillis / 1000)}s · Tap to stop` : uploading ? 'Sending the recording to the protected API…' : 'Your recording is sent as base64 to the API.'}</MiykoText>
      {uploading && <ActivityIndicator color={theme.accent} />}
      {error && <MiykoText variant="caption" color="danger">{error}</MiykoText>}
      {result && <Surface style={styles.result}><View style={styles.resultHeader}><MiykoText variant="section">Agent result</MiykoText><StatusPill label="Processed" tone="success" /></View>{result.transcript && <View style={styles.resultPart}><MiykoText variant="caption" color="textSecondary">TRANSCRIPT</MiykoText><MiykoText variant="body">{result.transcript}</MiykoText></View>}{result.intent && <View style={styles.resultPart}><MiykoText variant="caption" color="textSecondary">INTENT</MiykoText><MiykoText variant="body">{result.intent.type} · {result.intent.summary}</MiykoText><MiykoText variant="caption" color="textSecondary">Confidence {Math.round(result.intent.confidence * 100)}%</MiykoText></View>}{result.response && <View style={styles.resultPart}><MiykoText variant="caption" color="textSecondary">RESPONSE</MiykoText><MiykoText variant="body">{result.response.message}</MiykoText></View>}</Surface>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  audioButton: { width: 84, height: 84, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  result: { width: '100%', gap: Spacing.three },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  resultPart: { gap: Spacing.one },
});
