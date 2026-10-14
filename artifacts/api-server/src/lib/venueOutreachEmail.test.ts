import { describe, expect, it } from "vitest";
import {
  buildVenueContactRequestEmail,
  buildVenueOutreachEmail,
  buildVenueRegistrationInviteEmail,
  OUTREACH_TEMPLATE_IDS,
} from "./venueOutreachEmail";

describe("venue outreach templates", () => {
  it.each(OUTREACH_TEMPLATE_IDS.filter((template) =>
    template !== "preapproval_video_application" && template !== "latest_updates",
  ))("renders %s safely without claiming access was granted", (template) => {
    const email = buildVenueOutreachEmail({
      businessName: "North & <South>",
      template,
    });
    expect(email.subject).toContain("North & <South>");
    expect(email.html).toContain("North &amp; &lt;South&gt;");
    expect(email.html).not.toContain("<South>");
    expect(email.html).not.toContain("/register?token=");
    expect(email.text).toContain("No account access or registration deadline");
    expect(email.text.toLowerCase()).toContain("reply");
  });

  it("announces multi-venue management and printable venue-branded Check In QR codes", () => {
    const email = buildVenueOutreachEmail({
      businessName: "Ignored venue name",
      template: "latest_updates",
      venueManagerUrl: "https://met-app.org/venue-manager",
      hasPosterAttachments: true,
    });

    expect(email.subject).toBe("Great news for our venue managers.");
    for (const message of [email.html, email.text]) {
      const normalizedMessage = message.toLowerCase();
      expect(normalizedMessage).toContain("add and manage multiple venues");
      expect(normalizedMessage).toContain("met app");
      expect(normalizedMessage).toContain("venue manager links");
      expect(normalizedMessage).toContain("design-ready check in qr code");
      expect(normalizedMessage).toContain("venue name");
      expect(normalizedMessage).toContain("venue manager website");
    }
    expect(email.html).not.toContain("Ignored venue name");
    expect(email.html).toContain('href="https://met-app.org/venue-manager"');
    expect(email.html).toContain("Venue Manager link: <a");
    expect(email.html).toContain("https://met-app.org/venue-manager</a>");
    expect(email.text).toContain("Sign in to Venue Manager: https://met-app.org/venue-manager");
    expect(email.text).toContain("attached an A4 PDF pack");
  });

  it("shows a visible, copyable Venue Manager URL in the prospect invitation", () => {
    const email = buildVenueOutreachEmail({
      businessName: "The Gallery",
      template: "latest_updates_prospect",
      venueManagerUrl: "https://met-app.org/venue-manager",
    });

    expect(email.html).toContain('href="https://met-app.org/venue-manager"');
    expect(email.html).toContain("Venue Manager link: <a");
    expect(email.html).toContain("https://met-app.org/venue-manager</a>");
    expect(email.text).toContain("Sign in or create an account: https://met-app.org/venue-manager");
    expect(email.html).not.toContain("A4 PDF pack");
    expect(email.text).not.toContain("A4 PDF pack");
  });

  it("sends a video introduction with an email-bound one-time application link for review", () => {
    const email = buildVenueOutreachEmail({
      businessName: "North & <South>",
      template: "preapproval_video_application",
      applicationUrl: "https://met-app.org/venue-manager/apply#invite=one-time-token",
      applicationExpiresAt: new Date("2027-01-21T12:00:00Z"),
      appIntroVideo: {
        videoUrl: "https://met-app.org/venue-admin/media/met-app-intro.mp4",
        posterUrl: "https://met-app.org/venue-admin/media/met-app-intro-poster.jpg",
      },
    });

    expect(email.subject).toContain("North & <South>");
    expect(email.html).toContain("North &amp; &lt;South&gt;");
    expect(email.html).toContain('href="https://met-app.org/venue-manager/apply#invite=one-time-token"');
    expect(email.html).toContain('src="https://met-app.org/venue-admin/media/met-app-intro-poster.jpg"');
    expect(email.html).toContain("January 21, 2027");
    expect(email.html).toContain("proof of ownership");
    expect(email.html).toContain("does not approve the venue or grant account access");
    expect(email.text).toContain("one-time-token");
    expect(email.text).toContain("same email");
    expect(email.text).toContain("submit it for Met’s review");
  });

  it("asks for a manager without issuing a registration link or deadline", () => {
    const email = buildVenueContactRequestEmail({
      businessName: "North & <South>",
      coverPhotoUrl: "https://images.example.com/venue.jpg",
    });
    expect(email.subject).toContain("North & <South>");
    expect(email.html).toContain("North &amp; &lt;South&gt;");
    expect(email.html).toContain('src="https://images.example.com/venue.jpg"');
    expect(email.html).toContain("No account access or registration deadline");
    expect(email.html).not.toContain("/register?token=");
    expect(email.text).toContain("reply with the best email address");
  });

  it("sends the Met launch invite with both download links in HTML and plain text", () => {
    const email = buildVenueOutreachEmail({
      businessName: "The Gallery",
      template: "met_launch_with_links",
    });
    for (const message of [email.html, email.text]) {
      expect(message).toContain("The Gallery");
      expect(message).toContain("world heat map");
      expect(message).toContain("most frequent guests");
      expect(message).toContain("venue’s leaderboard");
      expect(message).toContain("only when both people agree");
      expect(message).toContain("best email address");
      expect(message).toContain("https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926");
      expect(message).toContain("https://play.google.com/store/apps/details?id=app.met.founders");
      expect(message).toContain("metapp.contact@gmail.com");
    }
    expect(email.text).toContain("register your venue there");
  });

  it("sends the same Met launch invite without either app download link", () => {
    const withLinks = buildVenueOutreachEmail({ businessName: "The Gallery", template: "met_launch_with_links" });
    const withoutLinks = buildVenueOutreachEmail({ businessName: "The Gallery", template: "met_launch_without_links" });
    for (const message of [withoutLinks.html, withoutLinks.text]) {
      expect(message).toContain("best email address");
      expect(message).toContain("only when both people agree");
      expect(message).not.toContain("apps.apple.com");
      expect(message).not.toContain("play.google.com");
      expect(message).not.toContain("register your venue there");
    }
    expect(withoutLinks.subject).toBe(withLinks.subject);
    expect(withoutLinks.text.split("\n\n").slice(0, 5)).toEqual(withLinks.text.split("\n\n").slice(0, 5));
  });

  it("includes a secure, email-bound invitation and plain-text alternative", () => {
    const email = buildVenueRegistrationInviteEmail({
      businessName: "The Gallery",
      registrationUrl: "https://met-app.org/venue-manager/register?token=one-time-token",
      expiresAt: new Date("2027-01-21T12:00:00Z"),
      coverPhotoUrl: "http://untrusted.example/image.jpg",
    });
    expect(email.html).toContain("January 21, 2027");
    expect(email.html).toContain("existing Met account");
    expect(email.html).toContain("venue-manager-terms");
    expect(email.html).not.toContain("untrusted.example");
    expect(email.text).toContain("one-time-token");
  });

  it("adds the app introduction video and store links to the selected registration invitation", () => {
    const email = buildVenueRegistrationInviteEmail({
      businessName: "The Gallery",
      registrationUrl: "https://met-app.org/venue-manager/register?token=one-time-token",
      expiresAt: new Date("2027-01-21T12:00:00Z"),
      appIntroVideo: {
        videoUrl: "https://met-app.org/venue-admin/media/met-app-intro.mp4",
        posterUrl: "https://met-app.org/venue-admin/media/met-app-intro-poster.jpg",
      },
    });
    expect(email.html).toContain('href="https://met-app.org/venue-admin/media/met-app-intro.mp4"');
    expect(email.html).toContain('src="https://met-app.org/venue-admin/media/met-app-intro-poster.jpg"');
    expect(email.html).toContain("Watch the 3-minute Met app introduction");
    expect(email.html).toContain("Set up your venue access");
    expect(email.html).toContain("Download on the App Store");
    expect(email.html).toContain("Get it on Google Play");
    expect(email.html).toContain("The first registration invitation also starts the venue’s registration deadline.");
    expect(email.text).toContain("https://met-app.org/venue-admin/media/met-app-intro.mp4");
    expect(email.text).toContain("https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926");
    expect(email.text).toContain("https://play.google.com/store/apps/details?id=app.met.founders");
    expect(email.text).toContain("one-time-token");
  });

  it("rejects insecure app introduction media URLs", () => {
    expect(() => buildVenueRegistrationInviteEmail({
      businessName: "Venue",
      registrationUrl: "https://met-app.org/register?token=one-time-token",
      expiresAt: new Date(),
      appIntroVideo: {
        videoUrl: "javascript:alert(1)",
        posterUrl: "https://met-app.org/poster.jpg",
      },
    })).toThrow("Secure HTTPS URLs are required for the app introduction video.");
  });

  it("refuses an insecure registration URL", () => {
    expect(() => buildVenueRegistrationInviteEmail({
      businessName: "Venue",
      registrationUrl: "javascript:alert(1)",
      expiresAt: new Date(),
    })).toThrow("secure registration URL");
  });
});