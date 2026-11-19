import {
  attemptChatDraftDelivery,
  type ChatDraftDeliveryDependencies,
  type ChatDraftToSend,
} from "../chatDraftDelivery";
import type { SendMessageOpts } from "../firestore/chat";

function makeDependencies(send: ChatDraftDeliveryDependencies["send"]) {
  return {
    uploadImage: jest.fn(async () => "https://files.example/photo.jpg"),
    uploadAudio: jest.fn(async () => "https://files.example/voice.m4a"),
    send,
  };
}

describe("attemptChatDraftDelivery", () => {
  it("sends an image that finished uploading while the user composed the message", async () => {
    const send = jest.fn<Promise<string | null>, [string, SendMessageOpts]>().mockResolvedValue(null);
    const dependencies = makeDependencies(send);
    const draft: ChatDraftToSend = {
      text: "Here it is",
      mediaUri: "file:///photo.jpg",
      audioUri: null,
      audioDurationMs: 0,
      replyTo: null,
    };

    const result = await attemptChatDraftDelivery(
      draft,
      {
        localUri: draft.mediaUri!,
        remoteUri: "https://files.example/preuploaded-photo.jpg",
        mediaType: "image",
      },
      dependencies,
    );

    expect(result).toEqual({ ok: true, cachedAttachment: null });
    expect(dependencies.uploadImage).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith("Here it is", {
      mediaUri: "https://files.example/preuploaded-photo.jpg",
      audioUri: undefined,
      audioDurationMs: undefined,
      replyTo: undefined,
    });
  });

  it("reuses an uploaded photo when sending the preserved draft is retried", async () => {
    const send = jest
      .fn<Promise<string | null>, [string, SendMessageOpts]>()
      .mockResolvedValueOnce("temporary database error")
      .mockResolvedValueOnce(null);
    const dependencies = makeDependencies(send);
    const draft: ChatDraftToSend = {
      text: "See you there",
      mediaUri: "file:///photo.jpg",
      audioUri: null,
      audioDurationMs: 0,
      replyTo: {
        id: "message-1",
        from: "peer-uid",
        text: "Where?",
      },
    };

    const firstAttempt = await attemptChatDraftDelivery(
      draft,
      null,
      dependencies,
    );
    expect(firstAttempt.ok).toBe(false);
    if (firstAttempt.ok) throw new Error("Expected the first send to fail");
    expect(firstAttempt.cachedAttachment).toEqual({
      localUri: "file:///photo.jpg",
      remoteUri: "https://files.example/photo.jpg",
      mediaType: "image",
    });
    expect(send.mock.calls[0][0]).toBe("See you there");
    expect(send.mock.calls[0][1]).toMatchObject({
      mediaUri: "https://files.example/photo.jpg",
      replyTo: draft.replyTo,
    });

    const retry = await attemptChatDraftDelivery(
      draft,
      firstAttempt.cachedAttachment,
      dependencies,
    );

    expect(retry).toEqual({ ok: true, cachedAttachment: null });
    expect(dependencies.uploadImage).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][1]).toMatchObject({
      mediaUri: "https://files.example/photo.jpg",
      replyTo: draft.replyTo,
    });
  });

  it("preserves voice duration and reply context while retrying without reupload", async () => {
    const send = jest
      .fn<Promise<string | null>, [string, SendMessageOpts]>()
      .mockResolvedValueOnce("temporary database error")
      .mockResolvedValueOnce(null);
    const dependencies = makeDependencies(send);
    const draft: ChatDraftToSend = {
      text: "This is the entrance",
      mediaUri: null,
      audioUri: "file:///voice.m4a",
      audioDurationMs: 4200,
      replyTo: {
        id: "message-2",
        from: "peer-uid",
        text: "Which entrance?",
        mediaType: "image",
      },
    };

    const firstAttempt = await attemptChatDraftDelivery(
      draft,
      null,
      dependencies,
    );
    expect(firstAttempt.ok).toBe(false);
    if (firstAttempt.ok) throw new Error("Expected the first send to fail");
    expect(send.mock.calls[0][1]).toMatchObject({
      audioUri: "https://files.example/voice.m4a",
      audioDurationMs: 4200,
      replyTo: draft.replyTo,
    });

    const retry = await attemptChatDraftDelivery(
      draft,
      firstAttempt.cachedAttachment,
      dependencies,
    );

    expect(retry).toEqual({ ok: true, cachedAttachment: null });
    expect(dependencies.uploadAudio).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[1][1]).toMatchObject({
      audioUri: "https://files.example/voice.m4a",
      audioDurationMs: 4200,
      replyTo: draft.replyTo,
    });
  });
});
