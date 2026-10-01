type VenueEmail = { subject: string; html: string; text: string };

type VenueEmailBase = {
  businessName: string;
  coverPhotoUrl?: string | null;
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
<tr><td style="padding:23px 36px 27px;background:#f5f5ef;border-top:1px solid #e5e7df;">
  <p style="margin:0 0 8px;color:#173f36;font-family:Georgia,serif;font-size:17px;">A place for people to meet.</p>
  <p style="margin:0;color:#65746d;font-size:12px;line-height:1.7;">This message was sent personally by the Met venues team about ${escapeHtml(opts.businessName)}. If it reached the wrong person, you can simply let us know by replying.</p>
</td></tr>
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

const MET_APP_STORE_URL = "https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926";
const MET_GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=app.met.founders";

function buildMetLaunchInviteEmail(opts: VenueEmailBase, includeDownloadLinks: boolean): VenueEmail {
  const name = opts.businessName.trim();
  const subject = `An invitation for ${name} to join Met`;
  const paragraphs = [
    `Hi ${name},`,
    `Met has just launched, and we’re adding venues from around the world. We think ${name} could be a great fit. Here are a few ways the app can benefit your venue and your guests.`,
    `Once you complete your venue page, your location will appear on Met’s world heat map, helping guests looking for social-friendly places discover your venue. You’ll also be able to see your most frequent guests, share rewards and events, post announcements, and stay in touch with guests through the app.`,
    `For guests, checking in is as simple as scanning your venue’s QR code. Each check-in earns them points on your venue’s leaderboard, giving them a reason to return and climb the rankings. They can follow your latest rewards and announcements, and connect with other guests nearby—but only when both people agree.`,
    `Could you reply with the best email address for the person who manages your venue? We’ll send them a registration invitation directly.`,
  ];
  const downloadIntro = "Alternatively, you can download the app and register your venue there:";
  const disclaimer = "No account access or registration deadline is created by this message.";
  const text = [
    ...paragraphs,
    ...(includeDownloadLinks
      ? [downloadIntro, `App Store:\n${MET_APP_STORE_URL}\n\nGoogle Play:\n${MET_GOOGLE_PLAY_URL}`]
      : []),
    disclaimer,
    "Regards,\nMet\nmetapp.contact@gmail.com",
  ].join("\n\n");
  const body = paragraphs.map((paragraph) =>
    `<p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">${escapeHtml(paragraph)}</p>`,
  ).join("") +
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
  "met_launch_with_links",
  "met_launch_without_links",
  "preapproval_video_application",
  "introduction",
  "benefits",
  "events",
  "rewards",
  "follow_up",
] as const;

export type OutreachTemplateId = typeof OUTREACH_TEMPLATE_IDS[number];

export const OUTREACH_TEMPLATES: { id: OutreachTemplateId; label: string; description: string }[] = [
  { id: "contact_request", label: "Find the manager", description: "Ask a public inbox to connect you with the person in charge." },
  { id: "met_launch_with_links", label: "Met launch invite · with download links", description: "Introduce Met’s venue and guest benefits, request a manager contact, and include both app store links." },
  { id: "met_launch_without_links", label: "Met launch invite · without download links", description: "The same introduction and manager request, without app download links." },
  { id: "preapproval_video_application", label: "Met video introduction · apply for your venue", description: "Share the Met app video and a one-time, email-bound link to select a venue and submit an application for review." },
  { id: "introduction", label: "Introduce Met", description: "A short first invitation to learn about Met." },
  { id: "benefits", label: "What Met offers", description: "Explain how a venue can manage its presence and updates." },
  { id: "events", label: "Events and announcements", description: "Focus on sharing upcoming happenings with local guests." },
  { id: "rewards", label: "Guest rewards", description: "Focus on ways to welcome and recognize returning guests." },
  { id: "follow_up", label: "Follow up", description: "Only use this after you have already contacted the venue." },
];

type MetAppIntroVideo = { videoUrl: string; posterUrl: string };

export function buildVenueOutreachEmail(opts: VenueEmailBase & {
  template: OutreachTemplateId;
  applicationUrl?: string;
  applicationExpiresAt?: Date;
  appIntroVideo?: MetAppIntroVideo;
}): VenueEmail {
  if (opts.template === "contact_request") return buildVenueContactRequestEmail(opts);
  if (opts.template === "met_launch_with_links") return buildMetLaunchInviteEmail(opts, true);
  if (opts.template === "met_launch_without_links") return buildMetLaunchInviteEmail(opts, false);
  if (opts.template === "preapproval_video_application") {
    return buildVenuePreApprovalApplicationEmail(opts);
  }

  const name = opts.businessName.trim();
  const templates: Record<Exclude<OutreachTemplateId, "contact_request" | "met_launch_with_links" | "met_launch_without_links" | "preapproval_video_application">, {
    subject: string;
    headline: string;
    paragraphs: string[];
  }> = {
    introduction: {
      subject: `An invitation to learn about Met for ${name}`,
      headline: "A new way to connect with local guests.",
      paragraphs: [
        `Hello ${name} team,`,
        `Met helps people discover local places and stay connected to the venues they enjoy. We'd love to introduce Met to the person who manages ${name}.`,
        "If this sounds relevant, reply to this email and we'll share more. If you're not the right contact, could you forward this message to the venue manager?",
      ],
    },
    benefits: {
      subject: `Explore what Met could offer ${name}`,
      headline: "Your venue, your story.",
      paragraphs: [
        `Hello ${name} team,`,
        `Met gives venues a place to keep their information current and share events, announcements, and rewards with people nearby. We'd like to explore whether this could be useful for ${name}.`,
        "Would the person responsible for your venue be open to a brief introduction? Reply here, or forward this to the right person.",
      ],
    },
    events: {
      subject: `Share what's happening at ${name} with Met`,
      headline: "Help people find your next event.",
      paragraphs: [
        `Hello ${name} team,`,
        `If ${name} hosts events or has news to share, Met can help local guests discover those updates in one place. We'd love to hear what your team has planned.`,
        "Could you connect us with the person who handles your events or venue communications? A reply to this email is all we need to start a conversation.",
      ],
    },
    rewards: {
      subject: `A way to welcome returning guests at ${name}`,
      headline: "Make every return visit count.",
      paragraphs: [
        `Hello ${name} team,`,
        `Met lets participating venues share rewards and updates with their guests. We'd love to introduce the idea to ${name} and learn what would be most useful for your team.`,
        "If you're interested, reply to this email or pass it to the person who manages your guest experience.",
      ],
    },
    follow_up: {
      subject: `Following up about ${name} and Met`,
      headline: "Following up on our introduction.",
      paragraphs: [
        `Hello ${name} team,`,
        `I wanted to follow up on our earlier message about Met. We'd still be glad to speak with the person who manages ${name} about sharing venue updates with local guests.`,
        "If this is of interest, reply here. If someone else is the right contact, we'd appreciate an introduction. No worries if the timing isn't right.",
      ],
    },
  };
  const selected = templates[opts.template];
  const text = `${selected.paragraphs.join("\n\n")}\n\nNo account access or registration deadline is created by this message.\n\nThe Met venues team`;
  const body = selected.paragraphs.map((paragraph) =>
    `<p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">${escapeHtml(paragraph)}</p>`,
  ).join("") +
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
    <p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">Met helps people discover local venues and stay connected to the places they enjoy. We’d love to invite <strong style="color:#173f36;">${escapeHtml(name)}</strong> to apply for a venue listing.</p>
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
    text: `Hello ${name} team,\n\nMet helps people discover local venues and stay connected to the places they enjoy. We’d love to invite ${name} to apply for a venue listing.\n\nWatch the 3-minute Met app introduction: ${videoUrl}\n\nTo apply, use the personal link below, search for your venue, select the correct listing, and submit it for Met’s review. The application asks for contact details and proof of ownership.\n\nApply to list your venue: ${url}\n\nThis one-time link is tied to the email address that received this message and expires ${expiry}. Use that same email on the application. Met reviews every application; this invitation does not approve the venue or grant account access.\n\nApp Store: ${MET_APP_STORE_URL}\nGoogle Play: ${MET_GOOGLE_PLAY_URL}\n\nThe Met venues team`,
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
  const appDownloadSection = appIntroVideo
    ? `<p style="margin:24px 0 10px;color:#485b52;font-size:14px;line-height:1.7;">Want to explore Met as a guest? Download the app:</p>
       <p style="margin:0 0 20px;font-size:14px;line-height:1.9;">
         <a href="${MET_APP_STORE_URL}" style="color:#11765e;font-weight:bold;text-decoration:none;">Download on the App Store</a>
         &nbsp;&nbsp;|&nbsp;&nbsp;
         <a href="${MET_GOOGLE_PLAY_URL.replace(/&/g, "&amp;")}" style="color:#11765e;font-weight:bold;text-decoration:none;">Get it on Google Play</a>
       </p>`
    : "";
  const body = appIntroVideo
    ? `
      <p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">Hello ${escapeHtml(name)} team,</p>
      <p style="margin:0 0 18px;color:#485b52;font-size:16px;line-height:1.75;">We’d love to welcome <strong style="color:#173f36;">${escapeHtml(name)}</strong> to Met. Your venue can help nearby guests find you, keep its details current, and share events, rewards, and announcements. Guests can discover your place, check in with your QR code, and earn points that give them a reason to return.</p>
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
      <p style="margin:0 0 22px;color:#485b52;font-size:16px;line-height:1.75;">Met brings people and local places together. We’d love for your team to take the lead on <strong style="color:#173f36;">${escapeHtml(name)}</strong>’s presence and share what makes it worth visiting.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f1f4ee;border:1px solid #e2e9df;"><tr><td style="padding:18px 22px;color:#275247;font-size:14px;line-height:1.8;">Your venue space lets you share <strong>events</strong>, offer <strong>rewards</strong>, post <strong>announcements</strong>, and keep your details current.</td></tr></table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 18px;"><tr><td style="background:#11765e;border-radius:5px;"><a href="${safeUrl}" style="display:inline-block;padding:16px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;">Set up your venue access &rarr;</a></td></tr></table>
      <p style="margin:0 0 18px;color:#485b52;font-size:14px;line-height:1.7;">Use your existing Met account, or create one with this invited email address. This personal, one-time link expires <strong>${escapeHtml(date)}</strong>. The first registration invitation also starts the venue’s registration deadline.</p>
      <p style="margin:0 0 18px;color:#68766e;font-size:12px;line-height:1.6;">If the button doesn’t work, copy this link into your browser: <a href="${safeUrl}" style="color:#11765e;overflow-wrap:anywhere;">${safeUrl}</a></p>
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
      ? `We’d love to welcome ${name} to Met. Your venue can help nearby guests find you, keep its details current, and share events, rewards, and announcements. Guests can discover your place, check in with your QR code, and earn points that give them a reason to return.\n\nWatch the 3-minute Met app introduction: ${appIntroVideo.videoUrl}`
      : `Met brings people and local places together. We’d love for your team to take the lead on ${name}'s presence. Share events, rewards and announcements, and keep your venue details current.`}\n\nSet up your venue access: ${url.href}\n\nUse your existing Met account, or create one with this invited email address. This personal, one-time link expires ${date}. The first registration invitation also starts the venue’s registration deadline.${appIntroVideo
      ? `\n\nExplore Met as a guest:\nApp Store: ${MET_APP_STORE_URL}\nGoogle Play: ${MET_GOOGLE_PLAY_URL}`
      : ""}\n\nVenue Manager Terms: https://met-app.org/venue-manager-terms\nPrivacy notice: https://met-app.org/venue-manager-privacy\nAfter registration, venues are expected to receive 10 genuine QR-verified guest check-ins within 30 days; listings that do not meet activation milestones may be delisted, with reinstatement available through Met.\n\nThe Met venues team`,
  };
}