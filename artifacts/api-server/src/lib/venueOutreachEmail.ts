type VenueEmail = { subject: string; html: string; text: string };

type VenueEmailBase = {
  businessName: string;
  coverPhotoUrl?: string | null;
  venueManagerUrl?: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

function safeCoverUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function brandedLayout(opts: VenueEmailBase & {
  eyebrow: string;
  headline: string;
  preheader: string;
  body: string;
  includeFooter?: boolean;
}): string {
  const cover = safeCoverUrl(opts.coverPhotoUrl);
  const photo = cover
    ? `<img src="${escapeHtml(cover)}" width="600" alt="${escapeHtml(opts.businessName)}" style="display:block;width:100%;max-width:600px;height:auto;max-height:230px;object-fit:cover;border:0;" />`
    : "";

  // Inline styles and table layout render consistently in Gmail and common
  // mobile email clients. The message is complete even with images disabled.
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.headline)}</title></head>
<body style="margin:0;padding:0;background:#f1f2ed;color:#172c28;font-family:Arial,Helvetica,sans-serif;">
<span style="display:none!important;font-size:1px;line-height:1px;color:#f1f2ed;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(opts.preheader)}</span>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f1f2ed;"><tr><td align="center" style="padding:30px 12px 42px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;background:#fffefa;border:1px solid #e3e7df;">
<tr><td style="padding:24px 32px;background:#113e35;color:#fffefa;">
  <span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:#e3ead9;color:#113e35;font-family:Georgia,serif;font-size:22px;font-style:italic;font-weight:bold;line-height:28px;text-align:center;vertical-align:middle;">m</span>
  <span style="font-family:Georgia,serif;font-size:23px;letter-spacing:-.8px;vertical-align:middle;margin-left:8px;">met <em style="color:#c9d7c2;font-weight:normal;">business</em></span>
</td></tr>
${photo ? `<tr><td>${photo}</td></tr>` : ""}
<tr><td style="padding:40px 36px 38px;">
  <p style="margin:0 0 18px;color:#317966;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(opts.eyebrow)}</p>
  <h1 style="margin:0 0 20px;color:#172c28;font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:normal;line-height:1.18;letter-spacing:-.8px;">${escapeHtml(opts.headline)}</h1>
  ${opts.body}
</td></tr>
${opts.includeFooter === false ? "" : `<tr><td style="padding:23px 36px 27px;background:#f5f5ef;border-top:1px solid #e5e7df;">
  <p style="margin:0 0 8px;color:#173f36;font-family:Georgia,serif;font-size:17px;">A place for people to meet.</p>
  <p style="margin:0;color:#65746d;font-size:12px;line-height:1.7;">This message was sent personally by the Met venues team about ${escapeHtml(opts.businessName)}. If it reached the wrong person, you can simply let us know by replying.</p>
</td></tr>`}
</table>
</td></tr></table>
</body></html>`;
}

export function buildVenueContactRequestEmail(opts: VenueEmailBase): VenueEmail {
  const name = opts.businessName.trim();
  const subject = `Could you connect us with ${name}'s manager?`;
  const body = `
    <p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">Hello ${escapeHtml(name)} team,</p>
    <p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">Met helps people discover the places around them and stay connected to the venues they love. We’d like to invite the right person at <strong style="color:#173f36;">${escapeHtml(name)}</strong> to set up its venue presence.</p>
    <p style="margin:0 0 25px;color:#485b52;font-size:16px;line-height:1.75;">Could you reply with the best email address for the person who manages your venue, or forward this message to them? We’ll send their registration invitation directly.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eaf1e9;border-left:3px solid #317966;"><tr><td style="padding:18px 22px;color:#194638;font-size:15px;line-height:1.6;"><strong>Just reply to this email</strong><br>Share the management contact and we’ll take it from there.</td></tr></table>
    <p style="margin:24px 0 0;color:#67766d;font-size:13px;line-height:1.6;">No account access or registration deadline is created by this message.</p>`;
  return {
    subject,
    html: brandedLayout({
      ...opts,
      eyebrow: "An introduction from Met",
      headline: "Let’s connect with the right person.",
      preheader: `A personal invitation for ${name}. Could you point us to the venue manager?`,
      body,
    }),
    text: `Hello ${name} team,\n\nMet helps people discover the places around them and stay connected to the venues they love. We’d like to invite the right person at ${name} to set up its venue presence.\n\nCould you reply with the best email address for the person who manages your venue, or forward this message to them? We’ll send their registration invitation directly.\n\nNo account access or registration deadline is created by this message.\n\nThe Met venues team`,
  };
}

export const MET_APP_STORE_URL = "https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926";
export const MET_GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=app.met.founders";
export const VENUE_MEDIA_SCREENSHOT_START_MARKER = "<!-- met-venue-media-screenshot:start -->";
export const VENUE_MEDIA_SCREENSHOT_END_MARKER = "<!-- met-venue-media-screenshot:end -->";
export const VENUE_GUESTBOOK_SCREENSHOT_START_MARKER = "<!-- met-venue-guestbook-screenshot:start -->";
export const VENUE_GUESTBOOK_SCREENSHOT_END_MARKER = "<!-- met-venue-guestbook-screenshot:end -->";
export const VENUE_LEADERBOARD_SCREENSHOT_START_MARKER = "<!-- met-venue-leaderboard-screenshot:start -->";
export const VENUE_LEADERBOARD_SCREENSHOT_END_MARKER = "<!-- met-venue-leaderboard-screenshot:end -->";
export const VENUE_HOME_SCREENSHOT_START_MARKER = "<!-- met-venue-home-screenshot:start -->";
export const VENUE_HOME_SCREENSHOT_END_MARKER = "<!-- met-venue-home-screenshot:end -->";
export const VENUE_SAVED_SCREENSHOT_START_MARKER = "<!-- met-venue-saved-screenshot:start -->";
export const VENUE_SAVED_SCREENSHOT_END_MARKER = "<!-- met-venue-saved-screenshot:end -->";
export const VENUE_TROPHIES_SCREENSHOT_START_MARKER = "<!-- met-venue-trophies-screenshot:start -->";
export const VENUE_TROPHIES_SCREENSHOT_END_MARKER = "<!-- met-venue-trophies-screenshot:end -->";
export const VENUE_CONNECTIONS_SCREENSHOT_START_MARKER = "<!-- met-venue-connections-screenshot:start -->";
export const VENUE_CONNECTIONS_SCREENSHOT_END_MARKER = "<!-- met-venue-connections-screenshot:end -->";
export const VENUE_FEATURED_SCREENSHOT_GALLERY_START_MARKER = "<!-- met-venue-featured-screenshot-gallery-v2:start -->";
export const VENUE_FEATURED_SCREENSHOT_GALLERY_END_MARKER = "<!-- met-venue-featured-screenshot-gallery-v2:end -->";
export const VENUE_FAQ_START_MARKER = "<!-- met-venue-faq:start -->";
export const VENUE_FAQ_END_MARKER = "<!-- met-venue-faq:end -->";

function buildMetLaunchInviteEmail(opts: VenueEmailBase, includeDownloadLinks: boolean): VenueEmail {
  const name = opts.businessName.trim();
  const subject = `An invitation for ${name} to join Met`;
  const paragraphs = [
    `Hi ${name},`,
    `Met helps guests discover nearby places and keep up with the venues they enjoy. ${name} can have a dedicated venue page that guests can save for a future visit.`,
    `Guests can scan your venue’s QR code for a quick, verified check-in, leave visit notes and photos in your venue guestbook, and follow your events and rewards. Each month, your top three visitors earn Gold, Silver, or Bronze trophies in their Met Trophies collection.`,
    `Venue managers can keep venue details current, create venue-branded QR codes and posters, share events and rewards, and manage multiple venues through Venue Manager.`,
    `Could you reply with the best email address for the person who manages your venue? We’ll send them a registration invitation directly.`,
  ];
  const downloadIntro = "Download Met to explore the app. To register a venue, open Settings → Register your venue and follow the prompts for review:";
  const disclaimer = "No account access or registration deadline is created by this message.";
  const text = [
    ...paragraphs,
    venueMediaScreenshotText(opts.venueManagerUrl),
    venueFaqText(),
    venuePortfolioText(opts.venueManagerUrl),
    ...(includeDownloadLinks
      ? [downloadIntro, `App Store:\n${MET_APP_STORE_URL}\n\nGoogle Play:\n${MET_GOOGLE_PLAY_URL}`]
      : []),
    disclaimer,
    "Regards,\nMet\nmetapp.contact@gmail.com",
  ].join("\n\n");
  const body = paragraphs.map((paragraph) =>
    `<p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">${escapeHtml(paragraph)}</p>`,
  ).join("") +
    venueMediaScreenshot(opts.venueManagerUrl) +
    venueFaqHtml() +
    (includeDownloadLinks
      ? `<p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">${escapeHtml(downloadIntro)}</p>
    <p style="margin:0 0 18px;color:#485b52;font-size:15px;line-height:1.75;">App Store:<br><a href="${MET_APP_STORE_URL}" style="color:#11765e;overflow-wrap:anywhere;">${MET_APP_STORE_URL}</a><br>Google Play:<br><a href="${MET_GOOGLE_PLAY_URL.replace(/&/g, "&amp;")}" style="color:#11765e;overflow-wrap:anywhere;">${escapeHtml(MET_GOOGLE_PLAY_URL)}</a></p>`
      : "") +
    `<p style="margin:20px 0 18px;color:#67766d;font-size:13px;line-height:1.6;">${escapeHtml(disclaimer)}</p>
    <p style="margin:0;color:#485b52;font-size:16px;line-height:1.75;">Regards,<br>Met<br><a href="mailto:metapp.contact@gmail.com" style="color:#11765e;">metapp.contact@gmail.com</a></p>`;
  return {
    subject,
    text,
    html: brandedLayout({
      ...opts,
      eyebrow: "An invitation from Met",
      headline: `Let’s welcome ${name} to Met.`,
      preheader: `See how ${name} and its guests can benefit from Met.`,
      body,
    }),
  };
}

export const OUTREACH_TEMPLATE_IDS = [
  "contact_request",
  "a_look_into_met",
  "met_launch_with_links",
  "met_launch_without_links",
  "met_u_foot_traffic_legacy",
  "preapproval_video_application",
  "introduction",
  "benefits",
  "events",
  "rewards",
  "follow_up",
  "latest_updates",
  "latest_updates_prospect",
] as const;

export type OutreachTemplateId = typeof OUTREACH_TEMPLATE_IDS[number];

export const OUTREACH_TEMPLATES: { id: OutreachTemplateId; label: string; description: string }[] = [
  { id: "contact_request", label: "Find the manager", description: "Ask a public inbox to connect you with the person in charge." },
  { id: "a_look_into_met", label: "A look into Met", description: "Show all seven Met screenshots with a short description above each one." },
  { id: "met_launch_with_links", label: "Met launch invite · with download links", description: "Introduce Met’s venue and guest benefits, request a manager contact, and include both app store links." },
  { id: "met_launch_without_links", label: "Met launch invite · without download links", description: "The same introduction and manager request, without app download links." },
  { id: "met_u_foot_traffic_legacy", label: "Met - U · Foot traffic & visitor legacy", description: "Invite a venue to become a map checkpoint and give visitors a lasting check-in record." },
  { id: "preapproval_video_application", label: "Met video introduction · apply for your venue", description: "Share the Met app video and a one-time, email-bound link to select a venue and submit an application for review." },
  { id: "introduction", label: "Introduce Met", description: "Introduce venue discovery, saved venue pages, QR visits, and guestbook memories." },
  { id: "benefits", label: "What Met offers", description: "Explain the latest guest features and how managers can keep venues current." },
  { id: "events", label: "Events and announcements", description: "Show how nearby guests can discover venue pages, events, and rewards." },
  { id: "rewards", label: "Guest rewards", description: "Explain verified QR visits, guest memories, and monthly visitor trophies." },
  { id: "follow_up", label: "Follow up", description: "A current-feature follow-up for venues you have already contacted." },
  { id: "latest_updates", label: "Latest updates for venue managers", description: "Share the refreshed app, quick QR check-ins, guestbook, monthly trophies, venue discovery, and management updates." },
  { id: "latest_updates_prospect", label: "Invite contacted venues to join Met", description: "Invite previously contacted venues to discover the latest guest and venue-manager features and register in Met." },
];

type MetAppIntroVideo = { videoUrl: string; posterUrl: string };

function safeVenueManagerUrl(value: string | undefined): string {
  const fallback = "https://met-app.org/venue-manager";
  if (!value) return fallback;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.href.replace(/\/$/, "")
      : fallback;
  } catch {
    return fallback;
  }
}

function venuePortfolioUrl(venueManagerUrl: string | undefined): string {
  const managerUrl = new URL(safeVenueManagerUrl(venueManagerUrl));
  return new URL("/venue-admin/media/venue-manager-portfolio.html", managerUrl.origin).href;
}

function venuePortfolioText(venueManagerUrl: string | undefined): string {
  return `Explore the Met guest experience: ${venuePortfolioUrl(venueManagerUrl)}`;
}

function venuePortfolioLink(venueManagerUrl: string | undefined): string {
  const url = escapeHtml(venuePortfolioUrl(venueManagerUrl));
  return `<p style="margin:0 0 20px;text-align:center;color:#485b52;font-size:14px;line-height:1.7;">
    <a href="${url}" style="color:#11765e;font-weight:700;text-decoration:underline;">See the full Met guest experience portfolio</a>
  </p>`;
}

function featureScreenshot(
  venueManagerUrl: string | undefined,
  filename:
    | "met-community-questionnaire-preview.jpg"
    | "met-home-discovery-preview.jpg"
    | "met-saved-places-preview.jpg"
    | "met-trophies-collection-preview.jpg"
    | "met-connections-preview.jpg"
    | "met-venue-guestbook-preview.jpg"
    | "met-venue-leaderboard-preview.jpg"
    | "met-venue-visitors-preview.jpg",
  alt: string,
  caption: string,
  includePortfolioLink = true,
  compact = false,
): string {
  const managerUrl = new URL(safeVenueManagerUrl(venueManagerUrl));
  const imageUrl = new URL(`/venue-admin/media/${filename}`, managerUrl.origin).href;
  const width = compact ? 190 : 240;
  const margin = compact ? "12px 0 14px" : "22px 0 24px";
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:${margin};">
    <tr><td align="center" style="padding:0 0 9px;">
      <a href="${escapeHtml(imageUrl)}" style="display:inline-block;text-decoration:none;">
        <img src="${escapeHtml(imageUrl)}" width="${width}" alt="${escapeHtml(alt)}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;" />
      </a>
    </td></tr>
    <tr><td align="center" style="color:#65746d;font-size:12px;line-height:1.5;">${escapeHtml(caption)}</td></tr>
  </table>${includePortfolioLink ? venuePortfolioLink(venueManagerUrl) : ""}`;
}

const VENUE_OUTREACH_FAQS = [
  {
    question: "How can guests find and revisit our venue?",
    answer: "Guests can discover nearby places, open your venue page, and save it to Saved Places for later. Saving a place is not a check-in.",
  },
  {
    question: "How do guests check in?",
    answer: "Guests scan your venue’s Met QR code at the venue.",
  },
  {
    question: "Can guests share photos or notes?",
    answer: "After a visit, guests can leave a note or photo in the venue Guestbook.",
  },
  {
    question: "Can a user hide from nearby discovery at any time?",
    answer: "Yes. Turn off Visibility from the Home header control or Settings to pause nearby discovery. This hides your profile from new nearby discovery.",
  },
  {
    question: "Does nearby visibility share my precise GPS location?",
    answer: "No. When visibility is on, nearby Met users can detect your phone over Bluetooth and see your name and profile photo. GPS coordinates are not shared through this visibility feature.",
  },
] as const;

function venueFaqText(): string {
  return [
    "Frequently asked questions",
    ...VENUE_OUTREACH_FAQS.flatMap(({ question, answer }, index) => [
      `${index + 1}. ${question}`,
      answer,
    ]),
  ].join("\n\n");
}

function venueFaqHtml(): string {
  const entries = VENUE_OUTREACH_FAQS.map(({ question, answer }, index) => {
    return `<tr><td style="padding:0 0 14px;color:#485b52;font-size:14px;line-height:1.65;">
      <strong style="color:#173f36;">${index + 1}. ${escapeHtml(question)}</strong><br>${escapeHtml(answer)}
    </td></tr>`;
  }).join("");
  return `${VENUE_FAQ_START_MARKER}<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0 24px;padding:18px 20px;background:#f5f5ef;border:1px solid #e5e7df;">
    <tr><td style="padding:0 0 14px;color:#173f36;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.3;">Frequently asked questions</td></tr>
    ${entries}
  </table>${VENUE_FAQ_END_MARKER}`;
}

function venueMediaScreenshotText(venueManagerUrl: string | undefined): string {
  const managerUrl = new URL(safeVenueManagerUrl(venueManagerUrl));
  const screenshots = [
    ["Home with map", "met-home-discovery-preview.jpg"],
    ["Venue page", "met-venue-visitors-preview.jpg"],
    ["Visitors", "met-venue-leaderboard-preview.jpg"],
    ["Connections", "met-connections-preview.jpg"],
    ["Guestbook", "met-venue-guestbook-preview.jpg"],
    ["Saved venues", "met-saved-places-preview.jpg"],
    ["Trophies collection", "met-trophies-collection-preview.jpg"],
  ] as const;
  return screenshots.map(([label, filename]) =>
    `Sample ${label} screenshot: ${new URL(`/venue-admin/media/${filename}`, managerUrl.origin).href}`,
  ).join("\n");
}

export function venueMediaScreenshot(
  venueManagerUrl: string | undefined,
  imageLimit = 4,
  includeMoreScreens = true,
): string {
  const screenshots = [
    {
      thumbnailFilename: "met-home-discovery-email-thumb.jpg",
      filename: "met-home-discovery-preview.jpg",
      alt: "Met Home screen with four New York venue pins and featured places",
      caption: "Home — explore four sample New York venues.",
    },
    {
      thumbnailFilename: "met-venue-visitors-email-thumb.jpg",
      filename: "met-venue-visitors-preview.jpg",
      alt: "The Sunroom Café venue page with its cover photo and profile image",
      caption: "The Sunroom Café — a venue page with photos and local updates.",
    },
    {
      thumbnailFilename: "met-venue-leaderboard-email-thumb.jpg",
      filename: "met-venue-leaderboard-preview.jpg",
      alt: "The Sunroom Café Visitors screen showing 16 sample guests",
      caption: "Visitors — monthly check-ins from 16 sample guests.",
    },
    {
      thumbnailFilename: "met-connections-email-thumb.jpg",
      filename: "met-connections-preview.jpg",
      alt: "Met Connections screen showing the friend count and recent activity",
      caption: "Connections — see friends and recent activity.",
    },
  ] as const;
  const managerUrl = new URL(safeVenueManagerUrl(venueManagerUrl));
  const cards = screenshots.slice(0, imageLimit).map(({ thumbnailFilename, filename, alt, caption }) => {
    const imageUrl = new URL(`/venue-admin/media/${filename}`, managerUrl.origin).href;
    const thumbnailUrl = new URL(`/venue-admin/media/${thumbnailFilename}`, managerUrl.origin).href;
    return `<td align="center" valign="top" width="50%" style="width:50%;padding:0 7px 16px;">
      <a href="${escapeHtml(imageUrl)}" style="display:block;text-decoration:none;">
        <img src="${escapeHtml(thumbnailUrl)}" width="240" alt="${escapeHtml(alt)}" style="display:block;width:100%;max-width:240px;height:auto;border:1px solid #e5e7df;border-radius:8px;" />
      </a>
      <p style="margin:8px 2px 0;color:#65746d;font-size:12px;line-height:1.5;text-align:center;">${escapeHtml(caption)}</p>
    </td>`;
  });
  const extraScreens = [
    ["Guestbook", "met-venue-guestbook-preview.jpg"],
    ["Saved Places", "met-saved-places-preview.jpg"],
    ["Trophies", "met-trophies-collection-preview.jpg"],
  ] as const;
  const extraLinks = extraScreens.map(([label, filename]) => {
    const imageUrl = new URL(`/venue-admin/media/${filename}`, managerUrl.origin).href;
    return `<a href="${escapeHtml(imageUrl)}" style="color:#11765e;text-decoration:underline;">${escapeHtml(label)}</a>`;
  }).join(" &nbsp;·&nbsp; ");
  const portfolioUrl = escapeHtml(venuePortfolioUrl(venueManagerUrl));
  const rows: string[] = [];
  for (let index = 0; index < cards.length; index += 2) {
    rows.push(`<tr>${cards.slice(index, index + 2).join("")}</tr>`);
  }
  const moreScreens = includeMoreScreens
    ? `<p style="margin:2px 0 18px;color:#65746d;font-size:12px;line-height:1.7;text-align:center;">
       More screens: ${extraLinks} &nbsp;·&nbsp; <a href="${portfolioUrl}" style="color:#11765e;text-decoration:underline;">Full guest experience</a>
     </p>`
    : "";

  return `${VENUE_FEATURED_SCREENSHOT_GALLERY_START_MARKER}
    <p style="margin:18px 0 10px;color:#173f36;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.3;text-align:center;">A look inside Met</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;margin:0 0 4px;">
      ${rows.join("")}
    </table>
    ${moreScreens}
    ${VENUE_FEATURED_SCREENSHOT_GALLERY_END_MARKER}`;
}

function buildMetScreenshotShowcaseEmail(opts: VenueEmailBase): VenueEmail {
  const subject = "A look into Met";
  const managerUrl = new URL(safeVenueManagerUrl(opts.venueManagerUrl));
  const screenshots = [
    {
      label: "Home",
      description: "Discover nearby venues and featured places.",
      filename: "met-home-discovery-preview.jpg",
      alt: "Met Home screen with a New York City map, venue pins, and featured places",
    },
    {
      label: "Venue page",
      description: "Explore The Sunroom Café’s profile, events, and rewards.",
      filename: "met-venue-visitors-preview.jpg",
      alt: "The Sunroom Café venue page with cover photo, profile image, events, and rewards",
    },
    {
      label: "Visitors",
      description: "View sample guests and their monthly check-ins.",
      filename: "met-venue-leaderboard-preview.jpg",
      alt: "The Sunroom Café Visitors screen showing sample guests and monthly check-ins",
    },
    {
      label: "Connections",
      description: "See friends and recent activity.",
      filename: "met-connections-preview.jpg",
      alt: "Met Connections screen showing friends and recent activity",
    },
    {
      label: "Guestbook",
      description: "Read a visit note and see a shared photo.",
      filename: "met-venue-guestbook-preview.jpg",
      alt: "Sample Met venue Guestbook with a visitor note and photo memory",
    },
    {
      label: "Saved Places",
      description: "Revisit venues saved for later.",
      filename: "met-saved-places-preview.jpg",
      alt: "Met Saved Places screen showing venues saved for a future visit",
    },
    {
      label: "Trophies",
      description: "View monthly awards earned by top visitors.",
      filename: "met-trophies-collection-preview.jpg",
      alt: "Met Trophies collection showing monthly visitor awards",
    },
  ] as const;

  const items = screenshots.map(({ label, description, filename, alt }) => {
    const imageUrl = new URL(`/venue-admin/media/${filename}`, managerUrl.origin).href;
    return {
      text: `${label}: ${description}\n${imageUrl}`,
      html: `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;margin:0 0 24px;">
        <tr><td style="padding:0;">
          <p style="margin:0 0 9px;color:#173f36;font-size:15px;line-height:1.5;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(description)}</p>
          <img src="${escapeHtml(imageUrl)}" width="520" alt="${escapeHtml(alt)}" style="display:block;width:100%;max-width:520px;height:auto;border:1px solid #e5e7df;border-radius:8px;" />
        </td></tr>
      </table>`,
    };
  });
  const closingText = [
    "The Met app is totally free for users and designed with privacy and security in mind.",
    "Adding your venue to the Met world map is currently free.",
    `Please reply to this email, or download Met from the App Store (${MET_APP_STORE_URL}) or Google Play (${MET_GOOGLE_PLAY_URL}), then open Settings → Register your venue.`,
  ].join("\n\n");
  const closingHtml = `<div style="margin:8px 0 0;padding:22px 20px;background:#f5f5ef;border-top:1px solid #e5e7df;">
    <p style="margin:0 0 12px;color:#485b52;font-size:15px;line-height:1.7;">The Met app is totally free for users and designed with privacy and security in mind.</p>
    <p style="margin:0 0 12px;color:#485b52;font-size:15px;line-height:1.7;">Adding your venue to the Met world map is currently free.</p>
    <p style="margin:0;color:#485b52;font-size:15px;line-height:1.7;">Please reply to this email, or download Met from the <a href="${MET_APP_STORE_URL}" style="color:#11765e;font-weight:bold;">App Store</a> or <a href="${MET_GOOGLE_PLAY_URL}" style="color:#11765e;font-weight:bold;">Google Play</a>, then open <strong>Settings → Register your venue</strong>.</p>
  </div>`;

  return {
    subject,
    text: `${subject}\n\n${items.map((item) => item.text).join("\n\n")}\n\n${closingText}`,
    html: brandedLayout({
      businessName: opts.businessName.trim() || "Met",
      eyebrow: "A look into Met",
      headline: "A look into Met",
      preheader: "Seven Met screenshots, each with a brief description.",
      body: `${items.map((item) => item.html).join("")}${closingHtml}`,
      includeFooter: false,
    }),
  };
}

function buildVenueManagerLatestUpdatesEmail(opts: {
  venueManagerUrl?: string;
  hasPosterAttachments?: boolean;
}): VenueEmail {
  const subject = "The latest Met updates for your venue";
  const venueManagerUrl = safeVenueManagerUrl(opts.venueManagerUrl);
  const posterNote = opts.hasPosterAttachments
    ? "Create a venue-branded Check In QR code featuring your venue name. We’ve attached an A4 PDF pack with ready-to-print Garden and Midnight poster designs for each active venue."
    : "Create a venue-branded Check In QR code featuring your venue name, then choose from the ready-to-print Garden and Midnight poster designs in Venue Manager.";
  const paragraphs = [
    "Hello Venue Manager,",
    "Met has a refreshed interface and new ways to help guests discover your venue, check in, and remember their visits.",
  ];
  const text = [
    ...paragraphs,
    "Guests can discover nearby venues, explore your venue page, and save your venue to their personal list for later.",
    posterNote,
    "Guests scan your QR code at your venue for a quick, verified check-in. Verified visits count toward the venue leaderboard and rewards. They can also leave notes and photos from their visit in your venue guestbook.",
    "Each month, the top three visitors to your venue earn Gold, Silver, or Bronze trophies in their Met Trophies collection.",
    "Add and manage multiple venues under your account through the Met app or your Venue Manager links.",
    "Use your venue tools to promote events and rewards, and manage additional approved locations.",
    venueMediaScreenshotText(venueManagerUrl),
    venueFaqText(),
    `Sign in to Venue Manager: ${venueManagerUrl}`,
    venuePortfolioText(venueManagerUrl),
    `Download Met: App Store ${MET_APP_STORE_URL} | Google Play ${MET_GOOGLE_PLAY_URL}`,
    "To register another venue, open Met and go to Settings → Register your venue.",
    "Our goal is to create a connection between your guests and your venue.",
    "Regards,\nThe Met venues team",
  ].join("\n\n");
  const body = paragraphs.map((paragraph) =>
    `<p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">${escapeHtml(paragraph)}</p>`,
  ).join("") +
    `<ul style="margin:0 0 22px;padding-left:22px;color:#485b52;font-size:16px;line-height:1.75;">
      <li style="margin:0 0 12px;"><strong style="color:#173f36;">Help guests discover and remember your venue:</strong> the refreshed Met interface highlights nearby venues, gives guests a dedicated venue page, and lets them save your venue for later.</li>
      <li style="margin:0 0 12px;"><strong style="color:#173f36;">Quick QR check-ins and venue posters:</strong> guests scan your code at your venue for a quick, verified check-in. Verified visits count toward the venue leaderboard and rewards. ${escapeHtml(posterNote)}</li>
      <li style="margin:0 0 12px;"><strong style="color:#173f36;">A guestbook for visit memories:</strong> guests can share notes and photos from their visit on your venue page.</li>
      <li style="margin:0 0 12px;"><strong style="color:#173f36;">Monthly visitor trophies:</strong> your top three visitors each month earn Gold, Silver, or Bronze trophies in their Met Trophies collection.</li>
      <li><strong style="color:#173f36;">Manage multiple venues:</strong> add and manage multiple venues under your account through the Met app or your Venue Manager links.</li>
    </ul>
    ${venueMediaScreenshot(opts.venueManagerUrl)}
    ${venueFaqHtml()}
    <p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">Use your venue tools to promote events and rewards, and manage additional approved locations.</p>
    <p style="margin:0 0 16px;color:#485b52;font-size:16px;line-height:1.75;">Sign in to manage your venues and access your QR posters:</p>
    <p style="margin:0 0 22px;"><a href="${escapeHtml(venueManagerUrl)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#173f36;color:#fff;text-decoration:none;font-weight:700;">Open Venue Manager</a></p>
    <p style="margin:0 0 18px;color:#485b52;font-size:14px;line-height:1.75;">Venue Manager link: <a href="${escapeHtml(venueManagerUrl)}" style="color:#11765e;overflow-wrap:anywhere;">${escapeHtml(venueManagerUrl)}</a></p>
    <p style="margin:0 0 10px;color:#485b52;font-size:15px;line-height:1.9;"><a href="${MET_APP_STORE_URL}" style="color:#11765e;font-weight:700;text-decoration:none;">Download on the App Store</a> &nbsp;|&nbsp; <a href="${MET_GOOGLE_PLAY_URL.replace(/&/g, "&amp;")}" style="color:#11765e;font-weight:700;text-decoration:none;">Get it on Google Play</a></p>
    <p style="margin:0 0 18px;color:#485b52;font-size:14px;line-height:1.75;">To register another venue, open Met and go to <strong>Settings → Register your venue</strong>.</p>
    <p style="margin:20px 0 18px;color:#173f36;font-family:Georgia,serif;font-size:17px;line-height:1.6;">Our goal is to create a connection between your guests and your venue.</p>
    <p style="margin:0;color:#485b52;font-size:16px;line-height:1.75;">Regards,<br>The Met venues team</p>`;
  return {
    subject,
    text,
    html: brandedLayout({
      businessName: "your venue",
      eyebrow: "Latest updates",
      headline: subject,
      preheader: "Discover the latest ways Met helps guests find, visit, and remember your venue.",
      body,
    }),
  };
}

function buildVenueManagerProspectUpdateEmail(opts: {
  businessName: string;
  venueManagerUrl?: string;
}): VenueEmail {
  const venueLabel = opts.businessName.trim() || "your venue";
  const subject = "The latest Met updates for your venue";
  const text = [
    `Hello ${venueLabel} team,`,
    "Met has a refreshed interface and new ways to help guests discover your venue, check in, and remember their visits.",
    "What’s new:",
    "- Nearby venue discovery and a dedicated venue page, so guests can explore your venue and save it for later.",
    "- Smooth, quick, in-person check-ins when guests scan your venue’s QR code.",
    "- A guestbook where visitors can leave notes and photos from their visit.",
    "- Monthly visitor trophies: the top three visitors to your venue earn Gold, Silver, or Bronze trophies in their Met Trophies collection.",
    "- Manage multiple venues through one Venue Manager account.",
    "- Create a venue-branded Check In QR code and choose from ready-to-print Garden and Midnight poster designs once your venue is connected to an active manager account.",
    "Use your venue tools to promote events and rewards, and manage additional approved locations.",
    "Interested in joining? Download Met, then open Settings → Register your venue. Follow the prompts to submit your venue for review.",
    `App Store: ${MET_APP_STORE_URL}`,
    `Google Play: ${MET_GOOGLE_PLAY_URL}`,
    venueMediaScreenshotText(opts.venueManagerUrl),
    venueFaqText(),
    venuePortfolioText(opts.venueManagerUrl),
    "Our goal is to create a connection between your guests and your venue.",
    "Regards,\nThe Met venues team",
  ].join("\n\n");
  const body = `
    <p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">Hello ${escapeHtml(venueLabel)} team,</p>
    <p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">Met has a refreshed interface and new ways to help guests discover your venue, check in, and remember their visits.</p>
    <p style="margin:0 0 10px;color:#173f36;font-size:16px;line-height:1.75;font-weight:700;">What’s new:</p>
    <ul style="margin:0 0 20px;padding-left:22px;color:#485b52;font-size:16px;line-height:1.75;">
      <li style="margin:0 0 12px;"><strong style="color:#173f36;">Nearby discovery and a dedicated venue page:</strong> guests can explore your venue and save it to their personal list for later.</li>
      <li style="margin:0 0 12px;"><strong style="color:#173f36;">Smooth, quick, in-person check-ins:</strong> guests scan your venue’s QR code on-site to check in.</li>
      <li style="margin:0 0 12px;"><strong style="color:#173f36;">A guestbook for visit memories:</strong> visitors can share notes and photos from their visit on your venue page.</li>
      <li style="margin:0 0 12px;"><strong style="color:#173f36;">Monthly visitor trophies:</strong> the top three visitors to your venue each month earn Gold, Silver, or Bronze trophies in their Met Trophies collection.</li>
      <li style="margin:0 0 12px;"><strong style="color:#173f36;">Manage multiple venues</strong> through one Venue Manager account.</li>
      <li><strong style="color:#173f36;">Create a venue-branded Check In QR code</strong> and choose from ready-to-print Garden and Midnight poster designs once your venue is connected to an active manager account.</li>
    </ul>
    ${venueMediaScreenshot(opts.venueManagerUrl)}
    ${venueFaqHtml()}
    <p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">Use your venue tools to promote events and rewards, and manage additional approved locations.</p>
    <p style="margin:0 0 16px;color:#485b52;font-size:16px;line-height:1.75;"><strong style="color:#173f36;">Interested in joining?</strong><br>Download Met, then open <strong>Settings → Register your venue</strong>. Follow the prompts to submit your venue for review.</p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.9;">
      <a href="${MET_APP_STORE_URL}" style="color:#11765e;font-weight:700;text-decoration:none;">Download on the App Store</a>
      &nbsp;|&nbsp;
      <a href="${MET_GOOGLE_PLAY_URL.replace(/&/g, "&amp;")}" style="color:#11765e;font-weight:700;text-decoration:none;">Get it on Google Play</a>
    </p>
    <p style="margin:0 0 18px;color:#173f36;font-family:Georgia,serif;font-size:17px;line-height:1.6;">Our goal is to create a connection between your guests and your venue.</p>
    <p style="margin:24px 0 0;color:#485b52;font-size:16px;line-height:1.75;">Regards,<br>The Met venues team</p>`;
  return {
    subject,
    text,
    html: brandedLayout({
      businessName: venueLabel,
      eyebrow: "An invitation from Met",
      headline: subject,
      preheader: "Discover the latest Met updates for venues and guests.",
      body,
    }),
  };
}

function buildMetUFootTrafficLegacyEmail(opts: VenueEmailBase): VenueEmail {
  const venueName = opts.businessName.trim();
  const venueReference = venueName || "your venue";
  const greetingName = venueName || "Venue";
  const subject = "Boost foot traffic & give your visitors a permanent legacy with Met - U 🚀";
  const paragraphs = [
    `Hi ${greetingName} Team,`,
    "We are launching Met - U, a global social and exploration app that drives real-world foot traffic directly to iconic cafes, bars, hotels, and hubs worldwide.",
    `We’d love to feature ${venueReference} as an official checkpoint on our map. When visitors scan your location's custom QR code, their name and check-in are permanently recorded on your venue's all-time visitor leaderboard, giving them a lasting digital legacy and driving repeat visits.`,
    "Let’s discuss how we can bring Met - U to your venue!",
    "Best regards,\nThe Met - U Team",
  ];
  const body = paragraphs.map((paragraph) =>
    `<p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
  ).join("");
  return {
    subject,
    text: paragraphs.join("\n\n"),
    html: brandedLayout({
      ...opts,
      businessName: venueReference,
      eyebrow: "An invitation from Met - U",
      headline: "Give your visitors a permanent legacy.",
      preheader: subject,
      body,
    }),
  };
}

export function buildVenueOutreachEmail(opts: VenueEmailBase & {
  template: OutreachTemplateId;
  applicationUrl?: string;
  applicationExpiresAt?: Date;
  appIntroVideo?: MetAppIntroVideo;
  venueManagerUrl?: string;
  hasPosterAttachments?: boolean;
}): VenueEmail {
  if (opts.template === "contact_request") return buildVenueContactRequestEmail(opts);
  if (opts.template === "a_look_into_met") return buildMetScreenshotShowcaseEmail(opts);
  if (opts.template === "met_launch_with_links") return buildMetLaunchInviteEmail(opts, true);
  if (opts.template === "met_launch_without_links") return buildMetLaunchInviteEmail(opts, false);
  if (opts.template === "preapproval_video_application") {
    return buildVenuePreApprovalApplicationEmail(opts);
  }
  if (opts.template === "met_u_foot_traffic_legacy") {
    return buildMetUFootTrafficLegacyEmail(opts);
  }
  if (opts.template === "latest_updates") {
    return buildVenueManagerLatestUpdatesEmail({
      venueManagerUrl: opts.venueManagerUrl,
      hasPosterAttachments: opts.hasPosterAttachments,
    });
  }
  if (opts.template === "latest_updates_prospect") {
    return buildVenueManagerProspectUpdateEmail({
      businessName: opts.businessName,
      venueManagerUrl: opts.venueManagerUrl,
    });
  }

  const name = opts.businessName.trim();
  const templates: Record<Exclude<OutreachTemplateId, "contact_request" | "a_look_into_met" | "met_launch_with_links" | "met_launch_without_links" | "met_u_foot_traffic_legacy" | "preapproval_video_application" | "latest_updates" | "latest_updates_prospect">, {
    subject: string;
    headline: string;
    paragraphs: string[];
  }> = {
    introduction: {
      subject: `An invitation to discover Met for ${name}`,
      headline: "A new way to connect with local guests.",
      paragraphs: [
        `Hello ${name} team,`,
        `Met helps nearby guests discover venues, explore a dedicated venue page, and save places they want to visit. We'd love to introduce Met to the person who manages ${name}.`,
        "Venue managers can keep details current, share events and rewards, create branded QR codes and posters, and manage multiple locations. Guests can check in on-site and leave visit notes and photos in the venue guestbook.",
        "Met also has community questionnaires in network feeds. The sample below illustrates that member feature; it is separate from venue management.",
        "If this sounds relevant, reply to this email and we'll share more. If you're not the right contact, could you forward this message to the venue manager?",
      ],
    },
    benefits: {
      subject: `Explore Met for ${name}`,
      headline: "Help guests find and remember your venue.",
      paragraphs: [
        `Hello ${name} team,`,
        `Met gives ${name} a dedicated page that nearby guests can discover and save for later. Your team can keep venue details current, share events and rewards, and manage multiple locations.`,
        "Guests can scan your venue’s QR code for a quick, verified check-in, save visit notes and photos in the venue guestbook, and earn a monthly Gold, Silver, or Bronze trophy if they are among your top three visitors.",
        "Would the person responsible for your venue be open to a brief introduction? Reply here, or forward this to the right person.",
      ],
    },
    events: {
      subject: `Share what's happening at ${name} with Met`,
      headline: "Help people find your next event.",
      paragraphs: [
        `Hello ${name} team,`,
        `Met helps nearby guests discover ${name}’s venue page, save it for later, and find the events and rewards your team shares there. Guests can also check in with your venue’s QR code and leave notes or photos in the venue guestbook.`,
        "Could you connect us with the person who handles your events or venue communications? A reply to this email is all we need to start a conversation.",
      ],
    },
    rewards: {
      subject: `A way to welcome returning guests at ${name}`,
      headline: "Make every return visit count.",
      paragraphs: [
        `Hello ${name} team,`,
        `Met lets nearby guests discover and save ${name}’s venue page, check in with your QR code, and keep up with your rewards. The venue guestbook gives guests a place to leave visit notes and photos, while monthly Gold, Silver, and Bronze trophies recognize your top three visitors.`,
        "Your team can share rewards and events, keep venue details current, and manage multiple locations through Venue Manager.",
        "If you're interested, reply to this email or pass it to the person who manages your guest experience.",
      ],
    },
    follow_up: {
      subject: `Following up about ${name} and Met`,
      headline: "Following up on our introduction.",
      paragraphs: [
        `Hello ${name} team,`,
        `I wanted to follow up on our earlier message about Met. Nearby guests can discover and save ${name}’s venue page, check in with your QR code, and leave visit notes and photos in the venue guestbook. Your team can share events and rewards and manage multiple venues.`,
        "If this is of interest, reply here. If someone else is the right contact, we'd appreciate an introduction. No worries if the timing isn't right.",
      ],
    },
  };
  const selected = templates[opts.template];
  const downloadLinksText = `Download Met:\nApp Store: ${MET_APP_STORE_URL}\nGoogle Play: ${MET_GOOGLE_PLAY_URL}`;
  const downloadLinksHtml = `<p style="margin:0 0 18px;color:#485b52;font-size:15px;line-height:1.9;"><a href="${MET_APP_STORE_URL}" style="color:#11765e;font-weight:700;text-decoration:none;">Download on the App Store</a> &nbsp;|&nbsp; <a href="${MET_GOOGLE_PLAY_URL.replace(/&/g, "&amp;")}" style="color:#11765e;font-weight:700;text-decoration:none;">Get it on Google Play</a></p>`;
  const portfolioText = venuePortfolioText(opts.venueManagerUrl);
  const hasPortfolioScreenshot = opts.template === "introduction" || opts.template === "benefits";
  const text = `${selected.paragraphs.join("\n\n")}\n\n${venueMediaScreenshotText(opts.venueManagerUrl)}\n\n${venueFaqText()}\n\n${downloadLinksText}\n\n${portfolioText}\n\nNo account access or registration deadline is created by this message.\n\nThe Met venues team`;
  const body = selected.paragraphs.map((paragraph) =>
    `<p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">${escapeHtml(paragraph)}</p>`,
  ).join("") +
    (opts.template === "introduction"
      ? featureScreenshot(opts.venueManagerUrl, "met-community-questionnaire-preview.jpg", "Sample Met network questionnaire with illustrative member answers", "Sample community questionnaire from a Met network feed; example answers only.")
      : "") +
    venueMediaScreenshot(opts.venueManagerUrl) +
    venueFaqHtml() +
    (hasPortfolioScreenshot ? "" : venuePortfolioLink(opts.venueManagerUrl)) +
    downloadLinksHtml +
    `<p style="margin:24px 0 0;color:#67766d;font-size:13px;line-height:1.6;">No account access or registration deadline is created by this message.</p>`;
  return {
    subject: selected.subject,
    text,
    html: brandedLayout({
      ...opts,
      eyebrow: "An introduction from Met",
      headline: selected.headline,
      preheader: selected.subject,
      body,
    }),
  };
}

function buildVenuePreApprovalApplicationEmail(opts: VenueEmailBase & {
  applicationUrl?: string;
  applicationExpiresAt?: Date;
  appIntroVideo?: MetAppIntroVideo;
}): VenueEmail {
  if (!opts.applicationUrl) throw new Error("A secure venue application invitation URL is required.");
  if (!opts.appIntroVideo) throw new Error("Secure Met app introduction video URLs are required.");
  const applicationUrl = new URL(opts.applicationUrl);
  if (applicationUrl.protocol !== "https:" || applicationUrl.username || applicationUrl.password) {
    throw new Error("A secure venue application invitation URL is required.");
  }
  const videoUrl = safeCoverUrl(opts.appIntroVideo.videoUrl);
  const posterUrl = safeCoverUrl(opts.appIntroVideo.posterUrl);
  if (!videoUrl || !posterUrl) {
    throw new Error("Secure HTTPS URLs are required for the Met app introduction video.");
  }

  const name = opts.businessName.trim();
  const url = applicationUrl.href;
  const expiry = opts.applicationExpiresAt
    ? opts.applicationExpiresAt.toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
      })
    : "14 days after the invitation is sent";
  const subject = `An invitation for ${name} to apply to Met`;
  const safeUrl = escapeHtml(url);
  const safeVideoUrl = escapeHtml(videoUrl);
  const safePosterUrl = escapeHtml(posterUrl);
  const body = `
    <p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">Hello ${escapeHtml(name)} team,</p>
    <p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">Met helps nearby guests discover venues, explore dedicated venue pages, and save places they want to visit. We’d love to invite <strong style="color:#173f36;">${escapeHtml(name)}</strong> to apply for a venue listing. Guests can check in with your QR code and leave visit notes and photos in the guestbook. Each month, your venue’s top three visitors earn Gold, Silver, or Bronze trophies in their Met Trophies collection.</p>
    <p style="margin:0 0 4px;color:#485b52;font-size:15px;line-height:1.7;">Watch the Met app introduction:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 22px;background:#f1f4ee;border:1px solid #e2e9df;">
      <tr><td style="padding:12px;">
        <a href="${safeVideoUrl}" style="display:block;text-decoration:none;">
          <img src="${safePosterUrl}" width="528" alt="Watch the Met app introduction video" style="display:block;width:100%;max-width:528px;height:auto;border:0;border-radius:5px;" />
        </a>
        <p style="margin:11px 0 2px;text-align:center;"><a href="${safeVideoUrl}" style="color:#11765e;font-size:14px;font-weight:bold;text-decoration:none;">Watch the 3-minute Met app introduction &rarr;</a></p>
      </td></tr>
    </table>
    <p style="margin:0 0 18px;color:#485b52;font-size:15px;line-height:1.7;">To apply, use the personal link below, search for your venue, select the correct listing, and submit it for Met’s review. The application asks for contact details and proof of ownership.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 18px;"><tr><td style="background:#11765e;border-radius:5px;"><a href="${safeUrl}" style="display:inline-block;padding:16px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;">Apply to list your venue &rarr;</a></td></tr></table>
    <p style="margin:0 0 18px;color:#485b52;font-size:14px;line-height:1.7;">This one-time link is tied to the email address that received this message and expires <strong>${escapeHtml(expiry)}</strong>. Use that same email on the application. Met reviews every application; this invitation does not approve the venue or grant account access.</p>
    <p style="margin:0 0 18px;color:#68766e;font-size:12px;line-height:1.6;">If the button doesn’t work, copy this link into your browser: <a href="${safeUrl}" style="color:#11765e;overflow-wrap:anywhere;">${safeUrl}</a></p>
    <p style="margin:0 0 12px;color:#485b52;font-size:14px;line-height:1.7;">You can also explore Met as a guest:</p>
    <p style="margin:0;font-size:14px;line-height:1.9;"><a href="${MET_APP_STORE_URL}" style="color:#11765e;font-weight:bold;text-decoration:none;">Download on the App Store</a> &nbsp;|&nbsp; <a href="${MET_GOOGLE_PLAY_URL.replace(/&/g, "&amp;")}" style="color:#11765e;font-weight:bold;text-decoration:none;">Get it on Google Play</a></p>`;

  return {
    subject,
    html: brandedLayout({
      ...opts,
      eyebrow: "A personal invitation from Met",
      headline: `Meet Met. Apply for ${name}.`,
      preheader: `Watch the Met introduction and apply to list ${name}.`,
      body,
    }),
    text: `Hello ${name} team,\n\nMet helps nearby guests discover venues, explore dedicated venue pages, and save places they want to visit. We’d love to invite ${name} to apply for a venue listing. Guests can check in with your QR code and leave visit notes and photos in the guestbook. Each month, your venue’s top three visitors earn Gold, Silver, or Bronze trophies in their Met Trophies collection.\n\nWatch the 3-minute Met app introduction: ${videoUrl}\n\nTo apply, use the personal link below, search for your venue, select the correct listing, and submit it for Met’s review. The application asks for contact details and proof of ownership.\n\nApply to list your venue: ${url}\n\nThis one-time link is tied to the email address that received this message and expires ${expiry}. Use that same email on the application. Met reviews every application; this invitation does not approve the venue or grant account access.\n\nApp Store: ${MET_APP_STORE_URL}\nGoogle Play: ${MET_GOOGLE_PLAY_URL}\n\nThe Met venues team`,
  };
}

export function buildVenueRegistrationInviteEmail(opts: VenueEmailBase & {
  registrationUrl: string;
  expiresAt: Date;
  appIntroVideo?: {
    videoUrl: string;
    posterUrl: string;
  };
}): VenueEmail {
  const name = opts.businessName.trim();
  const date = opts.expiresAt.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  const subject = `An invitation to manage ${name} on Met`;
  const url = new URL(opts.registrationUrl);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("A secure registration URL is required for venue invitations");
  }
  const safeUrl = escapeHtml(url.href);
  const appIntroVideo = opts.appIntroVideo
    ? {
        videoUrl: safeCoverUrl(opts.appIntroVideo.videoUrl),
        posterUrl: safeCoverUrl(opts.appIntroVideo.posterUrl),
      }
    : null;
  if (appIntroVideo && (!appIntroVideo.videoUrl || !appIntroVideo.posterUrl)) {
    throw new Error("Secure HTTPS URLs are required for the app introduction video.");
  }
  const videoSection = appIntroVideo
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:22px 0 24px;background:#f1f4ee;border:1px solid #e2e9df;">
         <tr><td style="padding:12px;">
           <a href="${escapeHtml(appIntroVideo.videoUrl!)}" style="display:block;text-decoration:none;">
             <img src="${escapeHtml(appIntroVideo.posterUrl!)}" width="528" alt="Watch the Met app introduction video" style="display:block;width:100%;max-width:528px;height:auto;border:0;border-radius:5px;" />
           </a>
           <p style="margin:11px 0 2px;text-align:center;"><a href="${escapeHtml(appIntroVideo.videoUrl!)}" style="color:#11765e;font-size:14px;font-weight:bold;text-decoration:none;">Watch the 3-minute Met app introduction &rarr;</a></p>
         </td></tr>
       </table>`
    : "";
  const appDownloadSection = `<p style="margin:24px 0 10px;color:#485b52;font-size:14px;line-height:1.7;">Want to explore Met as a guest? Download the app:</p>
       <p style="margin:0 0 20px;font-size:14px;line-height:1.9;">
         <a href="${MET_APP_STORE_URL}" style="color:#11765e;font-weight:bold;text-decoration:none;">Download on the App Store</a>
         &nbsp;&nbsp;|&nbsp;&nbsp;
         <a href="${MET_GOOGLE_PLAY_URL.replace(/&/g, "&amp;")}" style="color:#11765e;font-weight:bold;text-decoration:none;">Get it on Google Play</a>
        </p>`;
  const body = appIntroVideo
    ? `
      <p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">Hello ${escapeHtml(name)} team,</p>
      <p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">We’d love to welcome <strong style="color:#173f36;">${escapeHtml(name)}</strong> to Met. Nearby guests can discover your venue page and save it for later. They can check in on-site with your venue’s QR code, leave notes and photos in your guestbook, and follow your events and rewards. Your team can keep venue details current and manage multiple locations.</p>
      <p style="margin:0 0 4px;color:#485b52;font-size:15px;line-height:1.7;">See how Met works:</p>
      ${videoSection}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f1f4ee;border:1px solid #e2e9df;"><tr><td style="padding:18px 22px;color:#275247;font-size:14px;line-height:1.8;">Your venue space lets you share <strong>events</strong>, offer <strong>rewards</strong>, post <strong>announcements</strong>, and keep your details current.</td></tr></table>
      <p style="margin:20px 0 0;color:#485b52;font-size:15px;line-height:1.7;">Ready to get started? Use your personal invitation to set up <strong>${escapeHtml(name)}</strong> on Met.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 18px;"><tr><td style="background:#11765e;border-radius:5px;"><a href="${safeUrl}" style="display:inline-block;padding:16px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;">Set up your venue access &rarr;</a></td></tr></table>
      <p style="margin:0 0 18px;color:#485b52;font-size:14px;line-height:1.7;">Use your existing Met account, or create one with this invited email address. This personal, one-time link expires <strong>${escapeHtml(date)}</strong>. The first registration invitation also starts the venue’s registration deadline.</p>
      <p style="margin:0 0 18px;color:#68766e;font-size:12px;line-height:1.6;">If the button doesn’t work, copy this link into your browser: <a href="${safeUrl}" style="color:#11765e;overflow-wrap:anywhere;">${safeUrl}</a></p>
      ${appDownloadSection}
      <p style="margin:0;color:#68766e;font-size:12px;line-height:1.65;">Please review the <a href="https://met-app.org/venue-manager-terms" style="color:#11765e;">Venue Manager Terms</a> and <a href="https://met-app.org/venue-manager-privacy" style="color:#11765e;">Privacy notice</a>. After registration, venues are expected to receive 10 genuine QR-verified guest check-ins within 30 days; listings that do not meet activation milestones may be delisted, with reinstatement available through Met.</p>`
    : `
      <p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">Hello ${escapeHtml(name)} team,</p>
      <p style="margin:0 0 22px;color:#485b52;font-size:16px;line-height:1.75;">Met helps nearby guests discover <strong style="color:#173f36;">${escapeHtml(name)}</strong>’s venue page and save it for later. Guests can check in with your venue’s QR code and leave notes and photos in your guestbook.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f1f4ee;border:1px solid #e2e9df;"><tr><td style="padding:18px 22px;color:#275247;font-size:14px;line-height:1.8;">Your team can keep venue details current, share <strong>events and rewards</strong>, create a branded QR code, and manage multiple venues.</td></tr></table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 18px;"><tr><td style="background:#11765e;border-radius:5px;"><a href="${safeUrl}" style="display:inline-block;padding:16px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;">Set up your venue access &rarr;</a></td></tr></table>
      <p style="margin:0 0 18px;color:#485b52;font-size:14px;line-height:1.7;">Use your existing Met account, or create one with this invited email address. This personal, one-time link expires <strong>${escapeHtml(date)}</strong>. The first registration invitation also starts the venue’s registration deadline.</p>
      <p style="margin:0 0 18px;color:#68766e;font-size:12px;line-height:1.6;">If the button doesn’t work, copy this link into your browser: <a href="${safeUrl}" style="color:#11765e;overflow-wrap:anywhere;">${safeUrl}</a></p>
      ${appDownloadSection}
      <p style="margin:0;color:#68766e;font-size:12px;line-height:1.65;">Please review the <a href="https://met-app.org/venue-manager-terms" style="color:#11765e;">Venue Manager Terms</a> and <a href="https://met-app.org/venue-manager-privacy" style="color:#11765e;">Privacy notice</a>. After registration, venues are expected to receive 10 genuine QR-verified guest check-ins within 30 days; listings that do not meet activation milestones may be delisted, with reinstatement available through Met.</p>`;
  return {
    subject,
    html: brandedLayout({
      ...opts,
      eyebrow: "A personal venue invitation",
      headline: appIntroVideo ? `Meet Met. Make ${name} yours.` : `Make ${name} yours on Met.`,
      preheader: `Your invitation to manage ${name} on Met is ready.`,
      body,
    }),
    text: `Hello ${name} team,\n\n${appIntroVideo
      ? `We’d love to welcome ${name} to Met. Nearby guests can discover your venue page and save it for later. They can check in on-site with your venue’s QR code, leave notes and photos in your guestbook, and follow your events and rewards. Each month, your venue’s top three visitors earn Gold, Silver, or Bronze trophies in their Met Trophies collection. Your team can keep venue details current and manage multiple locations.\n\nWatch the 3-minute Met app introduction: ${appIntroVideo.videoUrl}`
      : `Met helps nearby guests discover ${name}'s venue page and save it for later. Guests can check in with your venue's QR code and leave visit notes and photos in your guestbook. Each month, your venue’s top three visitors earn Gold, Silver, or Bronze trophies in their Met Trophies collection. Your team can keep venue details current, share events and rewards, create a branded QR code, and manage multiple locations.`}\n\nSet up your venue access: ${url.href}\n\nUse your existing Met account, or create one with this invited email address. This personal, one-time link expires ${date}. The first registration invitation also starts the venue’s registration deadline.\n\nExplore Met as a guest:\nApp Store: ${MET_APP_STORE_URL}\nGoogle Play: ${MET_GOOGLE_PLAY_URL}\n\nVenue Manager Terms: https://met-app.org/venue-manager-terms\nPrivacy notice: https://met-app.org/venue-manager-privacy\nAfter registration, venues are expected to receive 10 genuine QR-verified guest check-ins within 30 days; listings that do not meet activation milestones may be delisted, with reinstatement available through Met.\n\nThe Met venues team`,
  };
}