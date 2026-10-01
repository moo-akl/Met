import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowUpRight, KeyRound, Mail, Send, UserRoundSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type InviteTemplate = "contact_request" | "registration" | "registration_with_video";

type InviteFormValues = {
  recipientEmail: string;
  template: InviteTemplate;
};

export type VenueInviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueName: string;
  defaultEmail: string;
  sending: boolean;
  onSend: (value: InviteFormValues) => Promise<void>;
};

const choices: {
  value: InviteTemplate;
  title: string;
  description: string;
  Icon: typeof Mail;
}[] = [
  {
    value: "contact_request",
    title: "Ask for a manager contact",
    description: "A warm introduction. No account or access link is created.",
    Icon: UserRoundSearch,
  },
  {
    value: "registration",
    title: "Invite them to register",
    description: "One-time setup link. The first invitation starts the venue’s 14-day registration deadline.",
    Icon: KeyRound,
  },
  {
    value: "registration_with_video",
    title: "Invite with the Met app video",
    description: "One-time setup link plus the app video and store links. The first invitation starts the 14-day deadline.",
    Icon: Mail,
  },
];

const MET_APP_STORE_URL = "https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926";
const MET_GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=app.met.founders";

export default function VenueInviteDialog({
  open,
  onOpenChange,
  venueName,
  defaultEmail,
  sending,
  onSend,
}: VenueInviteDialogProps) {
  const form = useForm<InviteFormValues>({
    defaultValues: { recipientEmail: defaultEmail, template: "contact_request" },
  });
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const wasOpen = useRef(false);
  const pending = sending || submitting;
  const template = form.watch("template");
  const recipient = form.watch("recipientEmail");
  const isContactRequest = template === "contact_request";
  const isVideoInvite = template === "registration_with_video";
  const name = venueName.trim() || "your venue";

  useEffect(() => {
    if (open && !wasOpen.current) {
      form.reset({ recipientEmail: defaultEmail, template: "contact_request" });
      setSubmitError("");
    }
    wasOpen.current = open;
  }, [open, defaultEmail, form.reset]);

  const handleSend = form.handleSubmit(async (values) => {
    if (pending) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      await onSend({
        recipientEmail: values.recipientEmail.trim(),
        template: values.template,
      });
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : "We couldn't send the email. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && pending) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[min(92dvh,850px)] w-[calc(100vw-24px)] max-w-[640px] gap-0 overflow-y-auto rounded-xl border-border/70 p-0 shadow-2xl sm:w-full">
        <div className="border-b border-border/70 bg-muted/30 px-5 pb-5 pt-6 sm:px-8 sm:pt-8">
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-background text-primary shadow-sm">
            <Mail className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
              Invite a venue contact
            </DialogTitle>
            <DialogDescription className="max-w-[480px] pt-1 leading-relaxed">
              Choose the right next step for <span className="font-medium text-foreground" data-testid="text-invite-venue-name">{name}</span>. Review the message before sending.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={handleSend} noValidate className="space-y-6 px-5 py-6 sm:px-8">
            <fieldset disabled={pending} className="space-y-2.5">
              <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                What would you like to send?
              </legend>
              {choices.map(({ value, title, description, Icon }) => {
                const selected = template === value;
                return (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                      selected
                        ? "border-primary/60 bg-primary/[0.055] shadow-sm"
                        : "border-border/80 bg-background hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <input
                      type="radio"
                      value={value}
                      {...form.register("template")}
                      data-testid={`radio-invite-${value}`}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-5 text-foreground">{title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        selected ? "border-primary" : "border-muted-foreground/50"
                      }`}
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="venue-invite-email" className="text-sm font-medium text-foreground">
                Recipient email
              </label>
              <Input
                id="venue-invite-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="manager@venue.com"
                disabled={pending}
                aria-invalid={!!form.formState.errors.recipientEmail}
                aria-describedby={form.formState.errors.recipientEmail ? "venue-invite-email-error" : undefined}
                data-testid="input-invite-recipient-email"
                className="h-11"
                {...form.register("recipientEmail", {
                  required: "Enter a recipient email address.",
                  validate: (value) =>
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || "Enter a valid email address.",
                })}
              />
              {form.formState.errors.recipientEmail && (
                <p id="venue-invite-email-error" role="alert" className="text-xs text-destructive" data-testid="error-invite-recipient-email">
                  {form.formState.errors.recipientEmail.message}
                </p>
              )}
            </div>

            <section aria-label="Email preview" className="overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary/70" aria-hidden="true" />
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Email preview
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground">Message outline</span>
              </div>
              <div className="space-y-1 border-b border-border/70 px-4 py-4 text-xs sm:px-5">
                <div className="flex gap-2">
                  <span className="w-12 shrink-0 text-muted-foreground">To</span>
                  <span className="break-all font-medium text-foreground" data-testid="text-invite-preview-recipient">
                    {recipient?.trim() || "Recipient email"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-12 shrink-0 text-muted-foreground">Subject</span>
                  <span className="font-semibold leading-relaxed text-foreground" data-testid="text-invite-preview-subject">
                    {isContactRequest
                      ? `Could you connect us with ${name}'s manager?`
                      : `An invitation to manage ${name} on Met`}
                  </span>
                </div>
              </div>
              <div className="space-y-4 px-4 py-5 text-sm leading-[1.65] text-foreground/85 sm:px-5 sm:py-6" data-testid="text-invite-preview-body">
                <p className="font-medium text-foreground">Hello,</p>
                {isContactRequest ? (
                  <>
                    <p>
                      I&apos;m reaching out from Met about <strong className="font-semibold text-foreground">{name}</strong>.
                      We&apos;d love to make sure the right person hears about the venue&apos;s presence on Met.
                    </p>
                    <p>
                      Could you point me to the person who manages the venue, or forward this note to them?
                      A reply with their name and email is all we need to take the conversation forward.
                    </p>
                    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3.5 py-2.5 font-medium text-foreground">
                      Reply with the manager contact <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      You&apos;re invited to manage <strong className="font-semibold text-foreground">{name}</strong> on Met.
                      Your invitation email will include a one-time registration link to set up venue access.
                    </p>
                    {isVideoInvite && (
                      <>
                        <p>
                          The email also introduces Met’s venue and guest benefits, with a video preview and links to download the guest app.
                        </p>
                        <a
                          href={`${import.meta.env.BASE_URL}media/met-app-intro.mp4`}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-lg border border-border bg-muted"
                          aria-label="Watch the Met app introduction video"
                        >
                          <img
                            src={`${import.meta.env.BASE_URL}media/met-app-intro-poster.jpg`}
                            alt="Preview of the Met app introduction video"
                            className="block aspect-video w-full object-cover"
                          />
                        </a>
                        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          <a href={MET_APP_STORE_URL} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">
                            App Store download
                          </a>
                          <a href={MET_GOOGLE_PLAY_URL} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">
                            Google Play download
                          </a>
                        </p>
                      </>
                    )}
                    <p>
                      Use a Met account verified with the invited email. The first registration invitation starts the
                      14-day deadline; the email states the link&apos;s expiry.
                    </p>
                    <div className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 font-semibold text-primary-foreground">
                      Set up venue access <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </div>
                  </>
                )}
                <p className="text-muted-foreground">The Met team</p>
              </div>
              <div className="border-t border-border/70 bg-muted/20 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground sm:px-5">
                Preview only. The final email is composed and sent by Met.
              </div>
            </section>

            {submitError && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive" data-testid="error-invite-send">
                {submitError}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-invite"
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending} data-testid="button-send-invite" className="w-full gap-2 sm:w-auto">
                <Send className="h-4 w-4" aria-hidden="true" />
                {pending ? "Sending email…" : isContactRequest ? "Send introduction" : isVideoInvite ? "Send video invitation" : "Send invitation"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}