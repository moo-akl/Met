import { OUTREACH_TEMPLATES, buildVenueOutreachEmail } from "./venueOutreachEmail.js";

export type ManualEmailTemplate = {
  id: string; name: string; subject: string; body: string; format: "html" | "text"; builtin: boolean;
};

export const MANUAL_EMAIL_VARIABLES = ["businessName", "recipientEmail", "venueManagerUrl", "applicationUrl"] as const;
export type ManualEmailValues = Record<typeof MANUAL_EMAIL_VARIABLES[number], string>;
const applicationMarker = "https://template.invalid/application";

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
  // Manual account invitations work for every recipient. Privileged, one-time
  // registration links remain in the application's dedicated access workflow.
  for (const id of ["registration", "registration_with_video"]) {
    defaults.push({
      id, builtin: true, format: "text",
      name: id === "registration" ? "Registration / account invitation" : "Registration / account invitation with video",
      subject: "Manage {{businessName}} on Met",
      body: [
        "Hello {{businessName}} team,",
        "We'd love to welcome you to Met. Manage your venue details, share events and rewards, and connect with your guests.",
        ...(id === "registration_with_video" ? [`Watch the Met introduction: ${video.videoUrl}`] : []),
        "Open Venue Manager: {{venueManagerUrl}}",
        "Sign in with your Met account if you already have venue access. To register a new venue, open Settings in the Met app and submit your venue for review.",
        "This email does not change your application status or grant account access.",
        "Regards,\nThe Met venues team",
      ].join("\n\n"),
    });
  }
  return defaults;
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

export function renderManualVenueEmail(template: ManualEmailTemplate, values: ManualEmailValues) {
  const interpolate = (content: string, html = false) => content.replace(
    /\{\{\s*([A-Za-z]\w*)\s*\}\}/g,
    (_, variable: keyof ManualEmailValues) => html ? escapeEmailHtml(values[variable] ?? "") : values[variable] ?? "",
  );
  const subject = interpolate(template.subject).replace(/[\r\n]+/g, " ");
  const body = interpolate(template.body, template.format === "html");
  const html = template.format === "html" ? body
    : `<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#25324a;"><div style="max-width:600px;margin:auto;white-space:pre-wrap;">${escapeEmailHtml(body).replace(/https?:\/\/[^\s<>]+/g, (url) => `<a href="${url}">${url}</a>`)}</div></body></html>`;
  const text = template.format === "text" ? body : body
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|div|li|tr|h[1-6])>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { subject, html, text };
}
