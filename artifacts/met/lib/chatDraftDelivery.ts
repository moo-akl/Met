import type { SendMessageOpts } from "@/lib/firestore/chat";

export type ChatDraftToSend = {
  text: string;
  mediaUri: string | null;
  audioUri: string | null;
  audioDurationMs: number;
  replyTo: SendMessageOpts["replyTo"] | null;
};

export type UploadedChatDraftAttachment = {
  localUri: string;
  remoteUri: string;
  mediaType: "image" | "audio";
};

export type ChatDraftDeliveryDependencies = {
  uploadImage: (localUri: string) => Promise<string>;
  uploadAudio: (localUri: string) => Promise<string>;
  send: (text: string, options: SendMessageOpts) => Promise<string | null>;
};

export type ChatDraftDeliveryResult =
  | { ok: true; cachedAttachment: null }
  | {
      ok: false;
      cachedAttachment: UploadedChatDraftAttachment | null;
      error: unknown;
    };

export async function attemptChatDraftDelivery(
  draft: ChatDraftToSend,
  cachedAttachment: UploadedChatDraftAttachment | null,
  dependencies: ChatDraftDeliveryDependencies,
): Promise<ChatDraftDeliveryResult> {
  let attachment: UploadedChatDraftAttachment | null = null;

  try {
    let remoteUri: string | undefined;
    if (draft.mediaUri) {
      attachment =
        cachedAttachment?.mediaType === "image" &&
        cachedAttachment.localUri === draft.mediaUri
          ? cachedAttachment
          : {
              localUri: draft.mediaUri,
              remoteUri: await dependencies.uploadImage(draft.mediaUri),
              mediaType: "image",
            };
      remoteUri = attachment.remoteUri;
    } else if (draft.audioUri) {
      attachment =
        cachedAttachment?.mediaType === "audio" &&
        cachedAttachment.localUri === draft.audioUri
          ? cachedAttachment
          : {
              localUri: draft.audioUri,
              remoteUri: await dependencies.uploadAudio(draft.audioUri),
              mediaType: "audio",
            };
      remoteUri = attachment.remoteUri;
    }

    const error = await dependencies.send(draft.text, {
      mediaUri: draft.audioUri ? undefined : remoteUri,
      audioUri: draft.audioUri ? remoteUri : undefined,
      audioDurationMs: draft.audioUri ? draft.audioDurationMs : undefined,
      replyTo: draft.replyTo ?? undefined,
    });

    return error === null
      ? { ok: true, cachedAttachment: null }
      : { ok: false, cachedAttachment: attachment, error };
  } catch (error) {
    return { ok: false, cachedAttachment: attachment, error };
  }
}
