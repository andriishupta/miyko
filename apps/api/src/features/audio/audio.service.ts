import type { RequestContext } from "@miyko/contracts";
import { AppError } from "../../lib/errors.js";
import { transcriptionClient } from "../../integrations/transcription/transcription.client.js";
import { workflowsService } from "../workflows/workflows.service.js";

const maxDurationSeconds = 180;
const maxBytes = Number(process.env.AUDIO_MAX_BYTES ?? 6_000_000);

export class AudioService {
  async process(context: RequestContext, input: { fileName: string; mimeType: string; durationSeconds: number; audioBase64: string }) {
    if (input.durationSeconds > maxDurationSeconds) throw new AppError("AUDIO_TOO_LONG", "Audio duration is not supported", 422);
    const bytes = Buffer.from(input.audioBase64, "base64");
    if (bytes.length === 0 || bytes.length > maxBytes) throw new AppError("AUDIO_SIZE_INVALID", "Audio file size is not supported", 422);
    const transcript = await transcriptionClient.transcribe(input);
    const workflow = await workflowsService.create(context, { text: transcript, source: "audio" });
    return { requestId: context.requestId, status: "accepted" as const, transcript, workflow };
  }
}

export const audioService = new AudioService();
