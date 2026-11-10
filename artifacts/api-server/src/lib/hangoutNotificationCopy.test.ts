import { describe, expect, it } from "vitest";
import {
  getHangoutNotificationCopy,
  type HangoutNotificationType,
} from "./hangoutNotificationCopy";
import { SUPPORTED_LOCALE_CODES } from "./supportedLocales";

const notificationTypes: HangoutNotificationType[] = [
  "hangout_host_rating_prompt",
  "hangout_join_request",
  "hangout_join_decision",
  "hangout_updated",
  "hangout_cancelled",
];

describe("getHangoutNotificationCopy", () => {
  it.each(SUPPORTED_LOCALE_CODES)(
    "has translated title and body for every Hangout notification in %s",
    (locale) => {
      for (const type of notificationTypes) {
        const copy = getHangoutNotificationCopy(locale, type, {
          requestStatus: "accepted",
          requesterName: "Alex",
        });
        expect(copy.title.trim()).not.toBe("");
        expect(copy.body.trim()).not.toBe("");
        expect(copy.body).not.toContain("{{requesterName}}");
      }
    },
  );

  it("inserts the requester name into the translated join request", () => {
    expect(
      getHangoutNotificationCopy("fr", "hangout_join_request", {
        requesterName: "Élodie Martin",
      }),
    ).toEqual({
      title: "Nouvelle demande pour rejoindre une rencontre",
      body: "Élodie Martin a demandé à rejoindre votre plan. Ouvrez Met pour examiner la demande.",
    });
  });

  it("uses a localized anonymous name when a requester has no profile name", () => {
    expect(
      getHangoutNotificationCopy("es", "hangout_join_request").body,
    ).toBe("Alguien pidió unirse a tu plan. Abre Met para revisarla.");
  });

  it("keeps replacement characters literal in a requester's display name", () => {
    expect(
      getHangoutNotificationCopy("en", "hangout_join_request", {
        requesterName: "$& Guest",
      }).body,
    ).toBe("$& Guest asked to join your plan. Open Met to review.");
  });

  it("uses the correct localized accepted and declined messages", () => {
    expect(
      getHangoutNotificationCopy("es", "hangout_join_decision", {
        requestStatus: "accepted",
      }).title,
    ).toBe("Se aceptó tu solicitud para unirte a la quedada");
    expect(
      getHangoutNotificationCopy("es", "hangout_join_decision", {
        requestStatus: "declined",
      }).title,
    ).toBe("Se rechazó tu solicitud para unirte a la quedada");
  });

  it("uses a supported base language from a locale tag", () => {
    expect(
      getHangoutNotificationCopy("fr-CA", "hangout_cancelled"),
    ).toEqual(getHangoutNotificationCopy("fr", "hangout_cancelled"));
  });

  it.each(notificationTypes)(
    "falls back to English for unsupported locale %s",
    (type) => {
      expect(
        getHangoutNotificationCopy("xx", type, {
          requestStatus: "accepted",
          requesterName: "Someone",
        }),
      ).toEqual(
        getHangoutNotificationCopy("en", type, {
          requestStatus: "accepted",
          requesterName: "Someone",
        }),
      );
    },
  );
});
