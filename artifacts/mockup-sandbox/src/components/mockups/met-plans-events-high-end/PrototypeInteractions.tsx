import React, { useState, type FormEvent, type ReactNode } from "react";

export type DraftDetails = {
  title: string;
  when: string;
  location: string;
  note: string;
};

export type SheetAction = {
  label: string;
  detail?: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

export function navigateToPreview(componentName: string): void {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  window.location.assign(
    `${base}/preview/screenshot-frame/met-plans-events-high-end/${componentName}`,
  );
}

export function PreviewSheet({
  title,
  description,
  actions = [],
  onClose,
  children,
}: {
  title: string;
  description?: string;
  actions?: SheetAction[];
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section
        className="prototype-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-heading">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="sheet-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
        {actions.length > 0 ? (
          <div className="sheet-action-list">
            {actions.map((action) => (
              <button
                key={action.label}
                className={`sheet-action${action.danger ? " danger" : ""}`}
                disabled={action.disabled}
                onClick={action.onSelect}
              >
                <span>{action.label}</span>
                {action.detail ? <small>{action.detail}</small> : null}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function CreatePrototypeSheet({
  kind,
  initial,
  onClose,
  onSave,
}: {
  kind: "private Plan" | "public Hangout" | "event";
  initial?: DraftDetails;
  onClose: () => void;
  onSave: (draft: DraftDetails) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [when, setWhen] = useState(initial?.when ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ title: title.trim(), when, location: location.trim(), note: note.trim() });
  }

  return (
    <PreviewSheet
      title={`${initial ? "Edit" : "Create"} ${kind}`}
      description={
        kind === "private Plan"
          ? "Only the people you invite will see this Plan."
          : kind === "public Hangout"
            ? "Guests request to join; you decide who is accepted."
            : "Previewing the event details form."
      }
      onClose={onClose}
    >
      <form className="sheet-form" onSubmit={submit}>
        <label className="sheet-field">
          <span>Title</span>
          <input
            required
            maxLength={80}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Give it a name"
          />
        </label>
        <label className="sheet-field">
          <span>When</span>
          <input
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
          />
        </label>
        <label className="sheet-field">
          <span>Where</span>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Add a venue or meeting point"
          />
        </label>
        <label className="sheet-field">
          <span>Note</span>
          <textarea
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Share a little context"
          />
        </label>
        <button className="primary-button" type="submit">
          {initial ? "Save changes" : `Create ${kind}`}
        </button>
        <p className="prototype-caption">Preview only · nothing is sent or published.</p>
      </form>
    </PreviewSheet>
  );
}

export function PreviewNotice({ children }: { children: ReactNode }) {
  return (
    <p className="toast" role="status">
      {children}
    </p>
  );
}

export function FollowThroughActions({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderSaved, setReminderSaved] = useState(false);
  const [lead, setLead] = useState("15 minutes before");
  const [quietHours, setQuietHours] = useState("10 PM–8 AM");
  const [showDetails, setShowDetails] = useState(false);

  return <>
    <div className="follow-through-actions">
      <button className="pill-button" onClick={() => onNotice("Calendar export is ready in this preview.")}>▣ &nbsp;Add to calendar</button>
      <button className={`pill-button ${reminderSaved ? "selected" : ""}`} onClick={() => setReminderOpen(true)}>♧ &nbsp;{reminderSaved ? "Reminder set" : "Set reminder"}</button>
    </div>
    {reminderOpen && <PreviewSheet
      title="Event reminder"
      description="Choose when to be notified and protect your quiet hours."
      onClose={() => setReminderOpen(false)}
      actions={[
        { label: reminderSaved ? "Update reminder" : "Save reminder", detail: "This preview does not send a notification", onSelect: () => { setReminderSaved(true); setReminderOpen(false); onNotice(`Reminder set for ${lead.toLowerCase()}.`); } },
        ...(reminderSaved ? [{ label: "Turn off reminder", danger: true, onSelect: () => { setReminderSaved(false); setReminderOpen(false); onNotice("Event reminder turned off."); } }] : []),
      ]}
    >
      <p className="section-label" style={{ margin: "4px 0 8px" }}>REMIND ME</p>
      <div className="sheet-choice-row">
        {["At start", "15 minutes before", "1 hour before", "6 hours before"].map((option) => <button key={option} className={`pill-button ${lead === option ? "selected" : ""}`} aria-pressed={lead === option} onClick={() => setLead(option)}>{option}</button>)}
      </div>
      <p className="section-label" style={{ margin: "12px 0 8px" }}>QUIET HOURS</p>
      <div className="sheet-choice-row">
        {["10 PM–8 AM", "11 PM–7 AM", "Off"].map((option) => <button key={option} className={`pill-button ${quietHours === option ? "selected" : ""}`} aria-pressed={quietHours === option} onClick={() => setQuietHours(option)}>{option}</button>)}
      </div>
      <label className="sheet-checkbox"><input type="checkbox" checked={showDetails} onChange={(event) => setShowDetails(event.target.checked)} /><span>Show event details in the reminder</span></label>
    </PreviewSheet>}
  </>;
}
