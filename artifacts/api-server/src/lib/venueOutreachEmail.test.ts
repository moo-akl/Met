import { describe, expect, it } from "vitest";
import {
  buildVenueContactRequestEmail,
  buildVenueOutreachEmail,
  buildVenueRegistrationInviteEmail,
  MET_APP_STORE_URL,
  MET_GOOGLE_PLAY_URL,
  OUTREACH_TEMPLATE_IDS,
} from "./venueOutreachEmail";

describe("venue outreach templates", () => {
  it.each(OUTREACH_TEMPLATE_IDS.filter((template) =>
    template !== "preapproval_video_application" &&
    template !== "met_u_foot_traffic_legacy" &&
    template !== "a_look_into_met" &&
    template !== "latest_updates" &&
    template !== "latest_updates_prospect",
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

  it("builds a screenshot-only Met tour with a brief line above each of the seven images", () => {
    const managerUrl = "https://example.test/venue-manager";
    const screenshots = [
      ["Home", "Discover nearby venues and featured places.", "met-home-discovery-preview.jpg"],
      ["Venue page", "Explore The Sunroom Café’s profile, events, and rewards.", "met-venue-visitors-preview.jpg"],
      ["Visitors", "View sample guests and their monthly check-ins.", "met-venue-leaderboard-preview.jpg"],
      ["Connections", "See friends and recent activity.", "met-connections-preview.jpg"],
      ["Guestbook", "Read a visit note and see a shared photo.", "met-venue-guestbook-preview.jpg"],
      ["Saved Places", "Revisit venues saved for later.", "met-saved-places-preview.jpg"],
      ["Trophies", "View monthly awards earned by top visitors.", "met-trophies-collection-preview.jpg"],
    ] as const;
    const email = buildVenueOutreachEmail({
      businessName: "The Sunroom Café",
      template: "a_look_into_met",
      venueManagerUrl: managerUrl,
    });

    expect(email.subject).toBe("A look into Met");
    expect(email.html).toContain("<h1");
    expect(email.html).toContain("A look into Met");
    expect(email.html.match(/<img src="https:\/\/example\.test\/venue-admin\/media\/[^"]+\.jpg"/g)).toHaveLength(7);
    for (const [label, description, filename] of screenshots) {
      const imageUrl = `https://example.test/venue-admin/media/${filename}`;
      const captionIndex = email.html.indexOf(`<strong>${label}:</strong>`);
      const imageIndex = email.html.indexOf(`src="${imageUrl}"`);
      expect(captionIndex).toBeGreaterThanOrEqual(0);
      expect(captionIndex).toBeLessThan(imageIndex);
      expect(email.text).toContain(`${label}: ${description}`);
      expect(email.text).toContain(imageUrl);
    }
    const lastImageIndex = email.html.lastIndexOf("met-trophies-collection-preview.jpg");
    const closingIndex = email.html.indexOf("The Met app is totally free for users");
    expect(closingIndex).toBeGreaterThan(lastImageIndex);
    expect(email.html).toContain("designed with privacy and security in mind");
    expect(email.html).toContain("Adding your venue to the Met world map is currently free.");
    expect(email.html).toContain(`href="${MET_APP_STORE_URL}"`);
    expect(email.html).toContain(`href="${MET_GOOGLE_PLAY_URL}"`);
    expect(email.html).toContain("Please reply to this email");
    expect(email.html).toContain("Settings → Register your venue");
    expect(email.text).toContain(MET_APP_STORE_URL);
    expect(email.text).toContain(MET_GOOGLE_PLAY_URL);
    expect(email.html).not.toContain("Frequently asked questions");
    expect(email.html).not.toContain("met-home-discovery-email-thumb.jpg");
    expect(email.html).not.toContain("venue-manager-portfolio.html");
    expect(email.html).not.toContain("A place for people to meet.");
    expect(email.html).not.toContain("This message was sent personally");
    expect(email.text).not.toContain("Frequently asked questions");
  });

  it("uses the questionnaire only where relevant and includes a compact, linked screenshot grid", () => {
    const managerUrl = "https://met-app.org/venue-manager";
    const questionnaireUrl = "https://met-app.org/venue-admin/media/met-community-questionnaire-preview.jpg";
    const homeUrl = "https://met-app.org/venue-admin/media/met-home-discovery-preview.jpg";
    const homeThumbUrl = "https://met-app.org/venue-admin/media/met-home-discovery-email-thumb.jpg";
    const venueUrl = "https://met-app.org/venue-admin/media/met-venue-visitors-preview.jpg";
    const venueThumbUrl = "https://met-app.org/venue-admin/media/met-venue-visitors-email-thumb.jpg";
    const guestbookUrl = "https://met-app.org/venue-admin/media/met-venue-guestbook-preview.jpg";
    const leaderboardUrl = "https://met-app.org/venue-admin/media/met-venue-leaderboard-preview.jpg";
    const leaderboardThumbUrl = "https://met-app.org/venue-admin/media/met-venue-leaderboard-email-thumb.jpg";
    const savedUrl = "https://met-app.org/venue-admin/media/met-saved-places-preview.jpg";
    const trophiesUrl = "https://met-app.org/venue-admin/media/met-trophies-collection-preview.jpg";
    const connectionsUrl = "https://met-app.org/venue-admin/media/met-connections-preview.jpg";
    const connectionsThumbUrl = "https://met-app.org/venue-admin/media/met-connections-email-thumb.jpg";
    const portfolioUrl = "https://met-app.org/venue-admin/media/venue-manager-portfolio.html";
    const introduction = buildVenueOutreachEmail({
      businessName: "North & South",
      template: "introduction",
      venueManagerUrl: managerUrl,
    });
    const benefits = buildVenueOutreachEmail({
      businessName: "North & South",
      template: "benefits",
      venueManagerUrl: managerUrl,
    });
    const latestUpdates = buildVenueOutreachEmail({
      businessName: "North & South",
      template: "latest_updates",
      venueManagerUrl: managerUrl,
    });
    const prospectUpdates = buildVenueOutreachEmail({
      businessName: "North & South",
      template: "latest_updates_prospect",
      venueManagerUrl: managerUrl,
    });

    expect(introduction.html).toContain(`src="${questionnaireUrl}"`);
    expect(introduction.html).toContain("separate from venue management");
    expect(introduction.text).toContain("community questionnaires in network feeds");
    for (const email of [benefits, latestUpdates, prospectUpdates]) {
      expect(email.html).not.toContain(questionnaireUrl);
    }
    for (const email of [introduction, benefits, latestUpdates, prospectUpdates]) {
      expect(email.html).toContain(`src="${homeThumbUrl}"`);
      expect(email.html).toContain(`href="${homeUrl}"`);
      expect(email.html).toContain(`src="${venueThumbUrl}"`);
      expect(email.html).toContain(`href="${venueUrl}"`);
      expect(email.html).toContain(`src="${leaderboardThumbUrl}"`);
      expect(email.html).toContain(`href="${leaderboardUrl}"`);
      expect(email.html).toContain(`src="${connectionsThumbUrl}"`);
      expect(email.html).toContain(`href="${connectionsUrl}"`);
      expect(email.html).toContain(`href="${guestbookUrl}"`);
      expect(email.html).toContain(`href="${savedUrl}"`);
      expect(email.html).toContain(`href="${trophiesUrl}"`);
      expect(email.html).not.toContain(`src="${guestbookUrl}"`);
      expect(email.html).not.toContain(`src="${savedUrl}"`);
      expect(email.html).not.toContain(`src="${trophiesUrl}"`);
      expect(email.html).toContain("A look inside Met");
      expect(email.html).toContain("The Sunroom Café — a venue page with photos and local updates.");
      expect(email.html).toContain("Connections — see friends and recent activity.");
      expect(email.html).toContain("Visitors — monthly check-ins from 16 sample guests.");
      expect(email.html).toContain("Frequently asked questions");
      expect(email.html).toContain("1. How can guests find and revisit our venue?");
      expect(email.html).toContain("2. How do guests check in?");
      expect(email.html).toContain("3. Can guests share photos or notes?");
      expect(email.html).toContain("4. Can a user hide from nearby discovery at any time?");
      expect(email.html).toContain("Does nearby visibility share my precise GPS location?");
      expect(email.html).toContain("5. Does nearby visibility share my precise GPS location?");
      expect(email.html).toContain("GPS coordinates are not shared through this visibility feature.");
      expect(email.html).not.toContain("Are the sample questionnaires venue FAQs?");
      expect(email.html).not.toContain("Is Met completely secure");
      expect(email.html).not.toContain("App Store and Google Play review");
      expect(email.html.match(/<strong style="color:#173f36;">[1-5]\. /g)).toHaveLength(5);
      expect(email.html.match(/<td align="center" valign="top" width="50%"/g)).toHaveLength(4);
      expect(email.text).toContain("1. How can guests find and revisit our venue?");
      expect(email.text).toContain("4. Can a user hide from nearby discovery at any time?");
      expect(email.text).toContain("GPS coordinates are not shared through this visibility feature.");
      expect(email.text).not.toContain("Is Met completely secure");
      expect(email.text).not.toContain("Privacy Policy:");
    }
    for (const email of [introduction, benefits, latestUpdates, prospectUpdates]) {
      expect(email.html).toContain(`href="${portfolioUrl}"`);
      expect(email.text).toContain(portfolioUrl);
    }
  });

  it("adds the venue media screenshot, FAQs, and portfolio link to guest-facing outreach templates", () => {
    const portfolioUrl = "https://met-app.org/venue-admin/media/venue-manager-portfolio.html";
    const mediaScreenshotUrl = "https://met-app.org/venue-admin/media/met-venue-visitors-preview.jpg";
    const homeScreenshotUrl = "https://met-app.org/venue-admin/media/met-home-discovery-preview.jpg";
    const guestbookScreenshotUrl = "https://met-app.org/venue-admin/media/met-venue-guestbook-preview.jpg";
    const leaderboardScreenshotUrl = "https://met-app.org/venue-admin/media/met-venue-leaderboard-preview.jpg";
    const savedScreenshotUrl = "https://met-app.org/venue-admin/media/met-saved-places-preview.jpg";
    const trophiesScreenshotUrl = "https://met-app.org/venue-admin/media/met-trophies-collection-preview.jpg";
    const connectionsScreenshotUrl = "https://met-app.org/venue-admin/media/met-connections-preview.jpg";
    const templates = [
      "met_launch_with_links",
      "met_launch_without_links",
      "introduction",
      "benefits",
      "events",
      "rewards",
      "follow_up",
      "latest_updates",
      "latest_updates_prospect",
    ] as const;

    for (const template of templates) {
      const email = buildVenueOutreachEmail({
        businessName: "Test Venue",
        template,
        venueManagerUrl: "https://met-app.org/venue-manager",
      });
      expect(email.html).toContain(`href="${portfolioUrl}"`);
      expect(email.html).toContain('src="https://met-app.org/venue-admin/media/met-venue-visitors-email-thumb.jpg"');
      expect(email.html).toContain('src="https://met-app.org/venue-admin/media/met-home-discovery-email-thumb.jpg"');
      expect(email.html).toContain('src="https://met-app.org/venue-admin/media/met-venue-leaderboard-email-thumb.jpg"');
      expect(email.html).toContain('src="https://met-app.org/venue-admin/media/met-connections-email-thumb.jpg"');
      expect(email.html).toContain(`href="${mediaScreenshotUrl}"`);
      expect(email.html).toContain(`href="${homeScreenshotUrl}"`);
      expect(email.html).toContain(`href="${guestbookScreenshotUrl}"`);
      expect(email.html).toContain(`href="${leaderboardScreenshotUrl}"`);
      expect(email.html).toContain(`href="${savedScreenshotUrl}"`);
      expect(email.html).toContain(`href="${trophiesScreenshotUrl}"`);
      expect(email.html).toContain(`href="${connectionsScreenshotUrl}"`);
      expect(email.html).toContain("Frequently asked questions");
      expect(email.text).toContain(portfolioUrl);
      expect(email.text).toContain(mediaScreenshotUrl);
      expect(email.text).toContain(homeScreenshotUrl);
      expect(email.text).toContain(guestbookScreenshotUrl);
      expect(email.text).toContain(leaderboardScreenshotUrl);
      expect(email.text).toContain(savedScreenshotUrl);
      expect(email.text).toContain(trophiesScreenshotUrl);
      expect(email.text).toContain(connectionsScreenshotUrl);
      expect(email.text).toContain("Frequently asked questions");
      expect(email.text).toContain("5. Does nearby visibility share my precise GPS location?");
    }

    const contactRequest = buildVenueOutreachEmail({
      businessName: "Test Venue",
      template: "contact_request",
    });
    expect(contactRequest.html).not.toContain(mediaScreenshotUrl);
    expect(contactRequest.html).not.toContain(guestbookScreenshotUrl);
    expect(contactRequest.html).not.toContain(leaderboardScreenshotUrl);
    expect(contactRequest.html).not.toContain("Frequently asked questions");
    expect(contactRequest.text).not.toContain("Frequently asked questions");
  });

  it("announces the latest app, guest, QR, trophy, and multi-venue updates to managers", () => {
    const email = buildVenueOutreachEmail({
      businessName: "Ignored venue name",
      template: "latest_updates",
      venueManagerUrl: "https://met-app.org/venue-manager",
      hasPosterAttachments: true,
    });

    expect(email.subject).toBe("The latest Met updates for your venue");
    for (const message of [email.html, email.text]) {
      const normalizedMessage = message.toLowerCase();
      expect(normalizedMessage).toContain("add and manage multiple venues");
      expect(normalizedMessage).toContain("met app");
      expect(normalizedMessage).toContain("venue manager links");
      expect(normalizedMessage).toContain("venue-branded check in qr code");
      expect(normalizedMessage).toContain("venue name");
      expect(normalizedMessage).toContain("met has a refreshed interface");
      expect(normalizedMessage).toContain("quick, verified check-in");
      expect(normalizedMessage).toContain("guestbook");
      expect(normalizedMessage).toContain("photos from their visit");
      expect(normalizedMessage).toContain("top three visitors");
      expect(normalizedMessage).toContain("gold, silver, or bronze trophies");
      expect(normalizedMessage).toContain("settings → register your venue");
      expect(normalizedMessage).toContain("our goal is to create a connection between your guests and your venue");
    }
    expect(email.html).not.toContain("Ignored venue name");
    expect(email.html).toContain('href="https://met-app.org/venue-manager"');
    expect(email.html).toContain("Venue Manager link: <a");
    expect(email.html).toContain("https://met-app.org/venue-manager</a>");
    expect(email.text).toContain("Sign in to Venue Manager: https://met-app.org/venue-manager");
    expect(email.text).toContain("attached an A4 PDF pack");
    expect(email.html).toContain('href="https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926"');
    expect(email.html).toContain('href="https://play.google.com/store/apps/details?id=app.met.founders"');
    expect(email.text).toContain("https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926");
    expect(email.text).toContain("https://play.google.com/store/apps/details?id=app.met.founders");
  });

  it("invites contacted venues with the latest guest and manager updates and app-store links", () => {
    const email = buildVenueOutreachEmail({
      businessName: "The Gallery",
      template: "latest_updates_prospect",
      venueManagerUrl: "https://met-app.org/venue-manager",
    });

    expect(email.subject).toBe("The latest Met updates for your venue");
    for (const message of [email.html, email.text]) {
      const normalizedMessage = message.toLowerCase();
      expect(normalizedMessage).toContain("hello the gallery team");
      expect(normalizedMessage).toContain("manage multiple venues");
      expect(normalizedMessage).toContain("venue-branded check in qr code");
      expect(normalizedMessage).toContain("garden and midnight");
      expect(normalizedMessage).toContain("notes and photos from their visit");
      expect(normalizedMessage).toContain("settings → register your venue");
      expect(normalizedMessage).toContain("submit your venue for review");
      expect(normalizedMessage).toContain("refreshed interface");
      expect(normalizedMessage).toContain("smooth, quick, in-person check-ins");
      expect(normalizedMessage).toContain("top three visitors");
      expect(normalizedMessage).toContain("gold, silver, or bronze trophies");
      expect(normalizedMessage).toContain("our goal is to create a connection between your guests and your venue");
    }
    expect(email.html).toContain('href="https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926"');
    expect(email.html).toContain('href="https://play.google.com/store/apps/details?id=app.met.founders"');
    expect(email.html).toContain("Download on the App Store");
    expect(email.html).toContain("Get it on Google Play");
    expect(email.text).toContain("App Store: https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926");
    expect(email.text).toContain("Google Play: https://play.google.com/store/apps/details?id=app.met.founders");
    expect(email.text).not.toContain("met-app.org/venue-manager");
    expect(email.html).not.toContain("met-app.org/venue-manager");
    expect(email.text).not.toContain("No account access or registration deadline");
    expect(email.text).not.toContain("reply to this email");
    expect(email.html).not.toContain("A4 PDF pack");
    expect(email.text).not.toContain("A4 PDF pack");
  });

  it("renders the Met - U foot-traffic template with a venue-name placeholder safely", () => {
    const email = buildVenueOutreachEmail({
      businessName: "North & <South>",
      template: "met_u_foot_traffic_legacy",
    });

    expect(email.subject).toBe("Boost foot traffic & give your visitors a permanent legacy with Met - U 🚀");
    expect(email.text).toContain("Hi North & <South> Team,");
    expect(email.text).toContain("feature North & <South> as an official checkpoint on our map");
    expect(email.text).toContain("permanently recorded on your venue's all-time visitor leaderboard");
    expect(email.text).toContain("Let’s discuss how we can bring Met - U to your venue!");
    expect(email.text).toContain("Best regards,\nThe Met - U Team");
    expect(email.html).toContain("Hi North &amp; &lt;South&gt; Team,");
    expect(email.html).not.toContain("Hi North & <South> Team,");

    const unnamedEmail = buildVenueOutreachEmail({
      businessName: "",
      template: "met_u_foot_traffic_legacy",
    });
    expect(unnamedEmail.text).toContain("Hi Venue Team,");
    expect(unnamedEmail.text).toContain("feature your venue as an official checkpoint");
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
    expect(email.text).toContain("nearby guests discover venues");
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
      expect(message).toContain("dedicated venue page");
      expect(message).toContain("quick, verified check-in");
      expect(message).toContain("venue guestbook");
      expect(message).toContain("top three visitors");
      expect(message).not.toContain("world heat map");
      expect(message).not.toContain("just launched");
      expect(message).toContain("best email address");
      expect(message).toContain("https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926");
      expect(message).toContain("https://play.google.com/store/apps/details?id=app.met.founders");
      expect(message).toContain("metapp.contact@gmail.com");
    }
    expect(email.text).toContain("Settings → Register your venue");
  });

  it("sends the same Met launch invite without either app download link", () => {
    const withLinks = buildVenueOutreachEmail({ businessName: "The Gallery", template: "met_launch_with_links" });
    const withoutLinks = buildVenueOutreachEmail({ businessName: "The Gallery", template: "met_launch_without_links" });
    for (const message of [withoutLinks.html, withoutLinks.text]) {
      expect(message).toContain("best email address");
      expect(message).toContain("venue guestbook");
      expect(message).toContain("top three visitors");
      expect(message).not.toContain("apps.apple.com");
      expect(message).not.toContain("play.google.com");
    }
    expect(withoutLinks.subject).toBe(withLinks.subject);
    expect(withoutLinks.text.split("\n\n").slice(0, 5)).toEqual(withLinks.text.split("\n\n").slice(0, 5));
  });

  it.each(["introduction", "benefits", "events", "rewards", "follow_up"] as const)(
    "refreshes the %s outreach copy with current features and download links",
    (template) => {
      const email = buildVenueOutreachEmail({ businessName: "The Gallery", template });
      for (const message of [email.html, email.text]) {
        expect(message.toLowerCase()).toContain("nearby guests");
        expect(message).toContain("https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926");
        expect(message).toContain("https://play.google.com/store/apps/details?id=app.met.founders");
        expect(message).not.toContain("world heat map");
        expect(message).not.toContain("just launched");
      }
    },
  );

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
    expect(email.html).toContain("Download on the App Store");
    expect(email.html).toContain("Get it on Google Play");
    expect(email.html).toContain("guestbook");
    expect(email.text).toContain("one-time-token");
    expect(email.text).toContain("https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926");
    expect(email.text).toContain("https://play.google.com/store/apps/details?id=app.met.founders");
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