import { AppError } from "../../lib/errors.js";

const maxDurationSeconds = 180;
const maxBytes = Number(process.env.AUDIO_MAX_BYTES ?? 6_000_000);

export const validateAudioInput = (input: { durationSeconds: number; audioBase64: string }): void => {
  if (input.durationSeconds > maxDurationSeconds) throw new AppError("AUDIO_TOO_LONG", "Audio duration is not supported", 422);
  const bytes = Buffer.from(input.audioBase64, "base64");
  if (bytes.length === 0 || bytes.length > maxBytes) throw new AppError("AUDIO_SIZE_INVALID", "Audio file size is not supported", 422);
};
