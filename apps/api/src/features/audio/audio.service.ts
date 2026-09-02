import type { RequestContext } from "@miyko/contracts";
import { transcriptionClient } from "../../integrations/transcription/transcription.client.js";
import { workflowsService } from "../workflows/workflows.service.js";

export class AudioService {
  async process(context: RequestContext, input: { fileName: string; mimeType: string; durationSeconds: number; audioBase64: string }) {
    const transcript = await transcriptionClient.transcribe(input);
    const workflow = await workflowsService.create(context, { text: transcript, source: "audio" });
    return { requestId: context.requestId, status: "accepted" as const, transcript, workflow };
  }
}

export const audioService = new AudioService();
