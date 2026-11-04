import {
  MET_APP_STORE_URL,
  MET_GOOGLE_PLAY_URL,
  OUTREACH_TEMPLATES,
  VENUE_CONNECTIONS_SCREENSHOT_END_MARKER,
  VENUE_CONNECTIONS_SCREENSHOT_START_MARKER,
  VENUE_FEATURED_SCREENSHOT_GALLERY_END_MARKER,
  VENUE_FEATURED_SCREENSHOT_GALLERY_START_MARKER,
  VENUE_GUESTBOOK_SCREENSHOT_END_MARKER,
  VENUE_GUESTBOOK_SCREENSHOT_START_MARKER,
  VENUE_HOME_SCREENSHOT_END_MARKER,
  VENUE_HOME_SCREENSHOT_START_MARKER,
  VENUE_LEADERBOARD_SCREENSHOT_END_MARKER,
  VENUE_LEADERBOARD_SCREENSHOT_START_MARKER,
  VENUE_MEDIA_SCREENSHOT_END_MARKER,
  VENUE_MEDIA_SCREENSHOT_START_MARKER,
  VENUE_SAVED_SCREENSHOT_END_MARKER,
  VENUE_SAVED_SCREENSHOT_START_MARKER,
  VENUE_TROPHIES_SCREENSHOT_END_MARKER,
  VENUE_TROPHIES_SCREENSHOT_START_MARKER,
  VENUE_FAQ_END_MARKER,
  VENUE_FAQ_START_MARKER,
  buildVenueOutreachEmail,
  venueMediaScreenshot,
} from "./venueOutreachEmail.js";

export type ManualEmailTemplate = {
  id: string; name: string; subject: string; body: string; format: "html" | "text"; builtin: boolean;
};

export const MANUAL_EMAIL_VARIABLES = ["businessName", "recipientEmail", "venueManagerUrl", "applicationUrl", "venueFitReason"] as const;
export const GLOBAL_VENUE_PROSPECT_TEMPLATE_IDS = new Set([
  "global_venue_prospect",
  "global_venue_prospect_es",
  "global_venue_prospect_first_contact",
]);
export type ManualEmailValues = {
  businessName: string;
  recipientEmail: string;
  venueManagerUrl: string;
  applicationUrl: string;
  venueFitReason?: string;
};
const applicationMarker = "https://template.invalid/application";
const BUILTIN_OUTREACH_SECTIONS = [
  {
    start: VENUE_FEATURED_SCREENSHOT_GALLERY_START_MARKER,
    end: VENUE_FEATURED_SCREENSHOT_GALLERY_END_MARKER,
    contains: "met-home-discovery-email-thumb.jpg",
  },
  {
    start: VENUE_FAQ_START_MARKER,
    end: VENUE_FAQ_END_MARKER,
    contains: "Frequently asked questions",
  },
] as const;
const BRANDED_EMAIL_FOOTER_ROW =
  '<tr><td style="padding:23px 36px 27px;background:#f5f5ef;border-top:1px solid #e5e7df;">';

const LEGACY_SCREENSHOT_SECTIONS = [
  { start: VENUE_MEDIA_SCREENSHOT_START_MARKER, end: VENUE_MEDIA_SCREENSHOT_END_MARKER },
  { start: VENUE_GUESTBOOK_SCREENSHOT_START_MARKER, end: VENUE_GUESTBOOK_SCREENSHOT_END_MARKER },
  { start: VENUE_LEADERBOARD_SCREENSHOT_START_MARKER, end: VENUE_LEADERBOARD_SCREENSHOT_END_MARKER },
  { start: VENUE_SAVED_SCREENSHOT_START_MARKER, end: VENUE_SAVED_SCREENSHOT_END_MARKER },
  { start: VENUE_TROPHIES_SCREENSHOT_START_MARKER, end: VENUE_TROPHIES_SCREENSHOT_END_MARKER },
  { start: VENUE_HOME_SCREENSHOT_START_MARKER, end: VENUE_HOME_SCREENSHOT_END_MARKER },
  { start: VENUE_CONNECTIONS_SCREENSHOT_START_MARKER, end: VENUE_CONNECTIONS_SCREENSHOT_END_MARKER },
] as const;
const NO_REPLY_FOLLOWUP_SECTION_START = "<!-- MET_NO_REPLY_FOLLOWUP_SECTION_START -->";
const NO_REPLY_FOLLOWUP_SECTION_END = "<!-- MET_NO_REPLY_FOLLOWUP_SECTION_END -->";
const NO_REPLY_FOLLOWUP_IDEMPOTENCY_TEXT = "huge impact on your business traffic";
const PREVIOUS_NO_REPLY_FOLLOWUP_IMPACT_SENTENCE =
  "We believe Met, when used well, could help bring more guests through your doors, strengthen your relationship with them, and give them reasons to return. Met is free for venues to use.";
const CURRENT_NO_REPLY_FOLLOWUP_IMPACT_SENTENCE =
  "We believe Met, when used well, could have a huge impact on your business traffic, strengthen your relationship with your customers, and encourage them to return again and again. Met is free to use!";
const LEGACY_NO_REPLY_INTRO =
  "I’m following up with a complete introduction to Met for {{businessName}}. I’ve attached a venue-specific PDF showing how guests can discover a venue, check in on site, save visit memories, and find reasons to return.";
const CURRENT_NO_REPLY_INTRO =
  "I’m following up with a complete introduction to Met for {{businessName}}.";

function removeLegacyScreenshotSections(body: string): string {
  let result = body;
  for (const { start, end } of LEGACY_SCREENSHOT_SECTIONS) {
    while (true) {
      const startIndex = result.indexOf(start);
      if (startIndex < 0) break;
      const endIndex = result.indexOf(end, startIndex + start.length);
      if (endIndex < 0) break;
      result = `${result.slice(0, startIndex)}${result.slice(endIndex + end.length)}`;
    }
  }
  return result;
}

function refreshManagedFaq(body: string, latestBody: string): string {
  const latestStart = latestBody.indexOf(VENUE_FAQ_START_MARKER);
  const latestEnd = latestBody.indexOf(VENUE_FAQ_END_MARKER, latestStart + VENUE_FAQ_START_MARKER.length);
  if (latestStart < 0 || latestEnd < 0) return body;

  const latestFaq = latestBody.slice(latestStart, latestEnd + VENUE_FAQ_END_MARKER.length);
  const savedStart = body.indexOf(VENUE_FAQ_START_MARKER);
  const savedEnd = body.indexOf(VENUE_FAQ_END_MARKER, savedStart + VENUE_FAQ_START_MARKER.length);
  if (savedStart >= 0 && savedEnd >= 0) {
    return `${body.slice(0, savedStart)}${latestFaq}${body.slice(savedEnd + VENUE_FAQ_END_MARKER.length)}`;
  }

  const lowerBody = body.toLowerCase();
  const headingIndex = lowerBody.indexOf("frequently asked questions");
  const tableStart = headingIndex >= 0 ? lowerBody.lastIndexOf("<table", headingIndex) : -1;
  const tableClose = headingIndex >= 0 ? lowerBody.indexOf("</table>", headingIndex) : -1;
  if (tableStart >= 0 && tableClose >= 0) {
    return `${body.slice(0, tableStart)}${latestFaq}${body.slice(tableClose + "</table>".length)}`;
  }

  return body;
}

function extractNoReplyFollowupSection(body: string): string | null {
  const startIndex = body.indexOf(NO_REPLY_FOLLOWUP_SECTION_START);
  const endIndex = body.indexOf(
    NO_REPLY_FOLLOWUP_SECTION_END,
    startIndex + NO_REPLY_FOLLOWUP_SECTION_START.length,
  );
  if (startIndex < 0 || endIndex < 0) return null;
  return body.slice(startIndex, endIndex + NO_REPLY_FOLLOWUP_SECTION_END.length);
}

function noReplyFollowupSectionAsText(section: string): string {
  return section
    .replace(NO_REPLY_FOLLOWUP_SECTION_START, "")
    .replace(NO_REPLY_FOLLOWUP_SECTION_END, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function insertNoReplyFollowupSection(
  body: string,
  section: string,
  format: ManualEmailTemplate["format"],
): string {
  if (format === "html") {
    const applicationIndex = body.indexOf("<p>If you’d like to explore managing your venue");
    const signoffIndex = body.indexOf("<p>Regards,");
    const bodyCloseIndex = body.search(/<\/body\s*>/i);
    const insertionIndex = applicationIndex >= 0
      ? applicationIndex
      : signoffIndex >= 0
        ? signoffIndex
        : bodyCloseIndex >= 0
          ? bodyCloseIndex
          : body.length;
    return `${body.slice(0, insertionIndex)}\n${section}\n${body.slice(insertionIndex)}`;
  }

  const applicationIndex = body.indexOf("If you’d like to explore managing your venue");
  const signoffIndex = body.indexOf("Regards,");
  let insertionIndex = applicationIndex >= 0
    ? applicationIndex
    : signoffIndex >= 0
      ? signoffIndex
      : body.length;
  const paragraphStart = body.lastIndexOf("\n\n", insertionIndex);
  if (paragraphStart >= 0) insertionIndex = paragraphStart;
  const before = body.slice(0, insertionIndex).trimEnd();
  const after = body.slice(insertionIndex).trimStart();
  return [before, section, after].filter(Boolean).join("\n\n");
}

function refreshManagedNoReplyFollowup(
  saved: ManualEmailTemplate,
  latestDefault: ManualEmailTemplate,
): ManualEmailTemplate {
  if (!saved.builtin || !latestDefault.builtin) return saved;
  const latestSection = extractNoReplyFollowupSection(latestDefault.body);
  if (!latestSection) return saved;

  let body = saved.body.replace(LEGACY_NO_REPLY_INTRO, CURRENT_NO_REPLY_INTRO);
  const savedSection = extractNoReplyFollowupSection(body);
  const section = saved.format === "html"
    ? latestSection
    : noReplyFollowupSectionAsText(latestSection);

  if (savedSection) {
    body = body.replace(savedSection, section);
  } else if (body.includes(PREVIOUS_NO_REPLY_FOLLOWUP_IMPACT_SENTENCE)) {
    body = body.replace(
      PREVIOUS_NO_REPLY_FOLLOWUP_IMPACT_SENTENCE,
      CURRENT_NO_REPLY_FOLLOWUP_IMPACT_SENTENCE,
    );
  } else if (!body.toLowerCase().includes(NO_REPLY_FOLLOWUP_IDEMPOTENCY_TEXT)) {
    body = insertNoReplyFollowupSection(body, section, saved.format);
  }

  return body === saved.body ? saved : { ...saved, body };
}

export function defaultManualEmailTemplates(managerUrl: string, video: { videoUrl: string; posterUrl: string }): ManualEmailTemplate[] {
  const defaults: ManualEmailTemplate[] = OUTREACH_TEMPLATES.map((template) => {
    const email = buildVenueOutreachEmail({
      template: template.id, businessName: "{{businessName}}", venueManagerUrl: managerUrl,
      applicationUrl: applicationMarker, appIntroVideo: video,
    });
    return {
      id: template.id, name: template.label, subject: email.subject,
      body: email.html.replaceAll(applicationMarker, "{{applicationUrl}}"),
      format: "html", builtin: true,
    };
  });
  defaults.push({
    id: "global_venue_prospect",
    name: "Personalized invitation · top-fit venues",
    subject: "An invitation for {{businessName}} to join Met",
    format: "html",
    builtin: true,
    body: `<html><body style="margin:0;padding:24px 12px;background:#f5f5ef;">
      <div style="max-width:600px;margin:0 auto;padding:28px 32px;background:#fffefa;color:#25324a;font-family:Arial,sans-serif;font-size:15px;line-height:1.65;">
        <p>Hello {{businessName}} team,</p>
        <p>I’m reaching out from Met, a local-discovery app that helps people find and save venues they’d like to visit.</p>
        <p>I thought {{businessName}} could be a particularly good fit because {{venueFitReason}}</p>
        <p>Guests can save a venue page, check in on-site using a QR code, leave visit notes and photos in a venue guestbook, and discover events and rewards. Venue managers can keep venue details current and share their events and rewards through Venue Manager.</p>
        ${venueMediaScreenshot(managerUrl, 2, false)}
        <p>Would you be open to a short introduction? If someone else handles venue partnerships or marketing, could you point me to the right person?</p>
        <p>If this isn’t relevant, just reply and I won’t follow up.</p>
        <p>Regards,<br>The Met venues team<br><a href="mailto:metapp.contact@gmail.com" style="color:#11765e;">metapp.contact@gmail.com</a></p>
      </div>
    </body></html>`,
  });
  defaults.push({
    id: "global_venue_prospect_first_contact",
    name: "Venue introduction · complete Met overview (first contact)",
    subject: "A complete introduction to Met for {{businessName}}",
    format: "text",
    builtin: true,
    body: [
      "Hello {{businessName}} team,",
      "",
      "I’m reaching out with a complete introduction to Met for {{businessName}}.",
      "",
      "We hope you’ll take a look at the attached venue-specific PDF for a clearer picture of Met and how it works.",
      "",
      "We believe Met, when used well, could have a huge impact on your business traffic, strengthen your relationship with your customers, and encourage them to return again and again. Met is free to use!",
      "",
      "We’re hoping to find visionary partners who can see that potential and imagine what Met could make possible for their venue.",
      "",
      "We’d also appreciate your honest feedback: if something is stopping you from using Met, please tell us what it is. Your feedback will help us understand what’s getting in the way and how we can improve.",
      "",
      "If you’d like to explore managing your venue, you can start an application here: {{applicationUrl}}. Applications are reviewed; this link does not grant account access.",
      "",
      "If someone else handles venue partnerships or guest engagement, could you point me to the right person? If this isn’t relevant, reply and I won’t follow up again.",
      "",
      "Regards,\nThe Met venues team\nmetapp.contact@gmail.com",
    ].join("\n"),
  });
  defaults.push({
    id: "global_venue_prospect_es",
    name: "Invitación personalizada · locales con mejor encaje (español)",
    subject: "Una invitación para que {{businessName}} conozca Met",
    format: "html",
    builtin: true,
    body: `<html><body style="margin:0;padding:24px 12px;background:#f5f5ef;">
      <div style="max-width:600px;margin:0 auto;padding:28px 32px;background:#fffefa;color:#25324a;font-family:Arial,sans-serif;font-size:15px;line-height:1.65;">
        <p>Hola, equipo de {{businessName}}:</p>
        <h1 style="font-size:24px;line-height:1.3;">Nos gustaría invitar a {{businessName}} a conocer Met.</h1>
        <p>Me pongo en contacto desde Met, una aplicación de descubrimiento local que ayuda a las personas a encontrar y guardar lugares que quieren visitar.</p>
        <p>Me llamó la atención {{businessName}} por un motivo concreto:</p>
        <p>{{venueFitReason}}</p>
        <p>Con Met, los visitantes pueden guardar la ficha del local, registrar su visita en persona con un código QR, dejar notas y fotos en el Libro de Visitas y descubrir eventos y recompensas. El equipo puede mantener actualizada la información del local y compartir eventos y recompensas desde Venue Manager.</p>
        <p>He preparado una presentación breve y personalizada para mostrar cómo Met podría ayudar a {{businessName}}.</p>
        <h2 style="font-size:18px;">Empezar es sencillo:</h2>
        <ol>
          <li>Descarguen Met desde App Store o Google Play y creen una cuenta.</li>
          <li>En la app, abran Ajustes → Registra tu local y envíen la solicitud para revisión.</li>
          <li>Una vez aprobada, actualicen la ficha y creen el código QR del local en Venue Manager.</li>
          <li>Coloquen el código QR en el establecimiento y compartan eventos y recompensas para que los visitantes puedan descubrirlo y volver.</li>
        </ol>
        ${venueMediaScreenshot(managerUrl, 2, false)}
        <p>¿Les interesaría una breve presentación? Si otra persona se encarga de las alianzas o el marketing, ¿podrían indicarme con quién hablar?</p>
        <p>Si no les interesa, respondan a este correo y no volveré a contactarles.</p>
        <p>Un saludo,<br>Equipo de locales de Met<br><a href="mailto:metapp.contact@gmail.com" style="color:#11765e;">metapp.contact@gmail.com</a></p>
      </div>
    </body></html>`,
  });
  defaults.push({
    id: "venue_no_reply_follow_up",
    name: "No-reply follow-up · venue introduction",
    subject: "A Met introduction for {{businessName}}",
    format: "html",
    builtin: true,
    body: `<html><body style="margin:0;padding:24px 12px;background:#f5f5ef;">
      <div style="max-width:600px;margin:0 auto;padding:28px 32px;background:#fffefa;color:#25324a;font-family:Arial,sans-serif;font-size:15px;line-height:1.65;">
        <p>Hello {{businessName}} team,</p>
        <p>${CURRENT_NO_REPLY_INTRO}</p>
        ${NO_REPLY_FOLLOWUP_SECTION_START}
        <p>We hope you’ll take a look at the attached venue-specific PDF for a clearer picture of Met and how it works.</p>
        <p>We believe Met, when used well, could have a huge impact on your business traffic, strengthen your relationship with your customers, and encourage them to return again and again. Met is free to use!</p>
        <p>We’re hoping to find visionary partners who can see that potential and imagine what Met could make possible for their venue.</p>
        <p>We’d also appreciate your honest feedback: if something is stopping you from using Met, please tell us what it is. Your feedback will help us understand what’s getting in the way and how we can improve.</p>
        ${NO_REPLY_FOLLOWUP_SECTION_END}
        <p>If you’d like to explore managing your venue, you can start an application here: <a href="{{applicationUrl}}" style="color:#11765e;">{{applicationUrl}}</a>. Applications are reviewed; this link does not grant account access.</p>
        <p>If someone else handles venue partnerships or guest engagement, could you point me to the right person? If this isn’t relevant, reply and I won’t follow up again.</p>
        <p>Regards,<br>The Met venues team<br><a href="mailto:metapp.contact@gmail.com" style="color:#11765e;">metapp.contact@gmail.com</a></p>
      </div>
    </body></html>`,
  });
  // Manual account invitations work for every recipient. Privileged, one-time
  // registration links remain in the application's dedicated access workflow.
  for (const id of ["registration", "registration_with_video"]) {
    defaults.push({
      id, builtin: true, format: "text",
      name: id === "registration" ? "Registration / account invitation" : "Registration / account invitation with video",
      subject: "Manage {{businessName}} on Met",
      body: [
        "Hello {{businessName}} team,",
        "Met helps nearby guests discover and save your venue page, check in on-site with your QR code, and leave visit notes and photos in your guestbook. Each month, your top three visitors earn Gold, Silver, or Bronze trophies in their Met Trophies collection.",
        "In Venue Manager, you can keep venue details current, create venue-branded QR codes and posters, share events and rewards, and manage multiple venues.",
        ...(id === "registration_with_video" ? [`Watch the Met introduction: ${video.videoUrl}`] : []),
        "Open Venue Manager: {{venueManagerUrl}}",
        "Sign in with your Met account if you already have venue access. To register a new venue, open Settings → Register your venue in the Met app and submit it for review.",
        `Explore Met: App Store ${MET_APP_STORE_URL} | Google Play ${MET_GOOGLE_PLAY_URL}`,
        "This email does not change your application status or grant account access.",
        "Regards,\nThe Met venues team",
      ].join("\n\n"),
    });
  }
  return defaults;
}

/**
 * Built-in templates can have saved admin edits that intentionally override
 * generated defaults. Refresh managed sections while preserving the surrounding
 * saved copy and the template's subject/name.
 */
export function mergeBuiltinOutreachTemplateAdditions(
  saved: ManualEmailTemplate,
  latestDefault: ManualEmailTemplate,
): ManualEmailTemplate {
  if (saved.id === "venue_no_reply_follow_up") {
    return refreshManagedNoReplyFollowup(saved, latestDefault);
  }
  if (GLOBAL_VENUE_PROSPECT_TEMPLATE_IDS.has(saved.id) && saved.builtin && latestDefault.builtin) {
    const start = latestDefault.body.indexOf(VENUE_FEATURED_SCREENSHOT_GALLERY_START_MARKER);
    const end = latestDefault.body.indexOf(
      VENUE_FEATURED_SCREENSHOT_GALLERY_END_MARKER,
      start + VENUE_FEATURED_SCREENSHOT_GALLERY_START_MARKER.length,
    );
    if (start < 0 || end < 0) return saved;
    const gallery = latestDefault.body.slice(start, end + VENUE_FEATURED_SCREENSHOT_GALLERY_END_MARKER.length);
    if (saved.format === "html") {
      if (saved.body.includes(VENUE_FEATURED_SCREENSHOT_GALLERY_START_MARKER)) return saved;
      const bodyClose = saved.body.search(/<\/body\s*>/i);
      const wrapper = `<div style="max-width:600px;margin:0 auto;padding:0 32px;background:#fffefa;">${gallery}</div>`;
      return {
        ...saved,
        body: bodyClose >= 0
          ? `${saved.body.slice(0, bodyClose)}${wrapper}${saved.body.slice(bodyClose)}`
          : `${saved.body}${wrapper}`,
      };
    }
    const savedHtml = escapeEmailHtml(saved.body)
      .replace(/\r\n?/g, "\n")
      .replace(/\n/g, "<br>\n");
    return {
      ...saved,
      format: "html",
      body: `<html><body style="margin:0;padding:24px 12px;background:#f5f5ef;">
        <div style="max-width:600px;margin:0 auto;padding:28px 32px;background:#fffefa;color:#25324a;font-family:Arial,sans-serif;font-size:15px;line-height:1.65;">
          ${savedHtml}
          ${gallery}
        </div>
      </body></html>`,
    };
  }
  if (!saved.builtin || !latestDefault.builtin || saved.format !== "html" || latestDefault.format !== "html") {
    return saved;
  }
  if (saved.id === "a_look_into_met") return saved;

  const cleanedBody = removeLegacyScreenshotSections(saved.body);
  const refreshedBody = refreshManagedFaq(cleanedBody, latestDefault.body);
  const savedBody = refreshedBody.toLowerCase();
  const missingSections = BUILTIN_OUTREACH_SECTIONS
    .filter(({ contains }) => !savedBody.includes(contains.toLowerCase()))
    .flatMap(({ start, end }) => {
      const startIndex = latestDefault.body.indexOf(start);
      const endIndex = latestDefault.body.indexOf(end, startIndex + start.length);
      return startIndex < 0 || endIndex < 0
        ? []
        : [latestDefault.body.slice(startIndex, endIndex + end.length)];
    });

  if (!missingSections.length) {
    return refreshedBody === saved.body ? saved : { ...saved, body: refreshedBody };
  }

  const wrapper = `<tr><td style="padding:0 36px 12px;">${missingSections.join("")}</td></tr>`;
  const footerIndex = refreshedBody.lastIndexOf(BRANDED_EMAIL_FOOTER_ROW);
  if (footerIndex >= 0) {
    return {
      ...saved,
      body: `${refreshedBody.slice(0, footerIndex)}${wrapper}${refreshedBody.slice(footerIndex)}`,
    };
  }

  const bodyClose = refreshedBody.search(/<\/body\s*>/i);
  if (bodyClose >= 0) {
    const standaloneWrapper = `<div style="max-width:600px;margin:0 auto;padding:0 36px;background:#fffefa;">${missingSections.join("")}</div>`;
    return {
      ...saved,
      body: `${refreshedBody.slice(0, bodyClose)}${standaloneWrapper}${refreshedBody.slice(bodyClose)}`,
    };
  }

  return { ...saved, body: `${refreshedBody}${missingSections.join("")}` };
}

export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

export function unknownEmailVariables(content: string): string[] {
  return [...new Set([...content.matchAll(/\{\{\s*([A-Za-z]\w*)\s*\}\}/g)].map((match) => match[1]))]
    .filter((variable) => !MANUAL_EMAIL_VARIABLES.includes(variable as typeof MANUAL_EMAIL_VARIABLES[number]));
}

export const BULK_VENUE_INVITATION_OPENING = "We’d love to invite you and your venue to use Met.";
export const BULK_VENUE_INVITATION_OPENING_ES = "Nos gustaría invitarles a conocer Met.";

export function bulkVenueInvitationBody(
  body: string,
  format: string,
  opening = BULK_VENUE_INVITATION_OPENING,
): string {
  if (format === "html") {
    const greeting = /(<p\b[^>]*>)\s*(?:<(?:strong|b|span)\b[^>]*>\s*)*(?:Hello|Hi|Dear|Hola|Estimad[oa]|Apreciad[oa])\b[\s\S]*?<\/p>/i;
    if (greeting.test(body)) return body.replace(greeting, (_match, tag: string) => `${tag}${opening}</p>`);
    const openingParagraph = `<p>${opening}</p>`;
    return /<body\b[^>]*>/i.test(body)
      ? body.replace(/<body\b[^>]*>/i, (tag) => `${tag}${openingParagraph}`)
      : `${openingParagraph}${body}`;
  }
  const greeting = /^(?:Hello|Hi|Dear|Hola|Estimad[oa]|Apreciad[oa])\b[^\r\n]*(?:\r?\n|$)/i;
  return greeting.test(body)
    ? body.replace(greeting, `${opening}\n`)
    : `${opening}\n\n${body}`;
}

export function renderManualVenueEmail(template: ManualEmailTemplate, values: ManualEmailValues, bulkInvitation = false) {
  const interpolate = (content: string, html = false) => content.replace(
    /\{\{\s*([A-Za-z]\w*)\s*\}\}/g,
    (_, variable: keyof ManualEmailValues) => html ? escapeEmailHtml(values[variable] ?? "") : values[variable] ?? "",
  );
  const subject = interpolate(template.subject).replace(/[\r\n]+/g, " ");
  const bulkOpening = template.id === "global_venue_prospect_es"
    ? BULK_VENUE_INVITATION_OPENING_ES
    : BULK_VENUE_INVITATION_OPENING;
  const body = interpolate(
    bulkInvitation ? bulkVenueInvitationBody(template.body, template.format, bulkOpening) : template.body,
    template.format === "html",
  );
  const html = template.format === "html" ? body
    : `<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#25324a;"><div style="max-width:600px;margin:auto;white-space:pre-wrap;">${escapeEmailHtml(body).replace(/https?:\/\/[^\s<>]+/g, (url) => `<a href="${url}">${url}</a>`)}</div></body></html>`;
  const textSource = template.id === "a_look_into_met" ||
    GLOBAL_VENUE_PROSPECT_TEMPLATE_IDS.has(template.id) ||
    template.id === "venue_no_reply_follow_up"
    ? body
      .replace(/<img\b[^>]*>/gi, (imageTag) => imageTag.match(/\bsrc=["']([^"']+)["']/i)?.[1] ?? "")
      .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, attributes: string, contents: string) => {
        const href = attributes.match(/\bhref=["']([^"']+)["']/i)?.[1];
        const label = contents.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
        return href ? `${label}: ${href}` : label;
      })
    : body;
  const text = template.format === "text" ? body : textSource
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|div|li|tr|h[1-6])>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { subject, html, text };
}
