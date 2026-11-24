import React, { useState } from "react";
import "./_group.css";
import {
  CreatePrototypeSheet,
  FollowThroughActions,
  navigateToPreview,
  PreviewNotice,
  PreviewSheet,
  type SheetAction,
} from "./PrototypeInteractions";

type Rsvp = "Going" | "Maybe" | "Not going";
type Audience = "attendee" | "host";

export function EventDetailHighEnd() {
  const [rsvp, setRsvp] = useState<Rsvp>("Going");
  const [audience, setAudience] = useState<Audience>("attendee");
  const [title, setTitle] = useState("Live jazz at The Chapel");
  const [when, setWhen] = useState("");
  const [location, setLocation] = useState("The Chapel · Mission District, SF");
  const [note, setNote] = useState("Settle into an intimate evening of live jazz in a beautifully restored former church. A rotating trio, a good room, and a little space to stay after the last note.");
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [eventStarted, setEventStarted] = useState(false);
  const [eventEnded, setEventEnded] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [attendees, setAttendees] = useState([
    { name: "Maya Chen", status: "Going" },
    { name: "Jordan Lee", status: "Maybe" },
    { name: "Ari Rivera", status: "Going" },
  ]);

  const menuActions: SheetAction[] = audience === "attendee"
    ? [
        { label: "Get directions", detail: "The Chapel · Mission District", onSelect: () => { setNotice("Directions are ready for The Chapel."); setMenuOpen(false); } },
        { label: "Contact venue", detail: "Phone, email, and website", onSelect: () => { setContactOpen(true); setMenuOpen(false); } },
        { label: "Share event", detail: "Share the public event details", onSelect: () => { setShareOpen(true); setMenuOpen(false); } },
        { label: "Report this event", detail: "Tell Met about an event concern", onSelect: () => { setReportOpen(true); setMenuOpen(false); } },
        { label: "Preview event-day tools", detail: "Show QR and location check-in options", onSelect: () => { setEventStarted(true); setMenuOpen(false); } },
        { label: "Preview host controls", detail: "Switch to owner-only event actions", onSelect: () => { setAudience("host"); setMenuOpen(false); } },
        { label: "Preview post-event review", detail: "Show the review action after the event", onSelect: () => { setEventEnded(true); setMenuOpen(false); } },
      ]
    : [
        { label: "Edit event", detail: "Update the event details", onSelect: () => { setEditOpen(true); setMenuOpen(false); } },
        { label: "Manage attendance", detail: "Review the guest list", onSelect: () => { setAttendanceOpen(true); setMenuOpen(false); } },
        { label: "Delete event", detail: "Remove this event", danger: true, onSelect: () => { setDeleteOpen(true); setMenuOpen(false); } },
        { label: "Preview attendee view", detail: "Return to guest RSVP actions", onSelect: () => { setAudience("attendee"); setMenuOpen(false); } },
      ];

  if (deleted) {
    return <div className="met-he"><div className="phone">
      <div className="statusbar"><span>9:41</span><span className="status-icons">● ● ▰</span></div>
      <main className="scroll-area">
        <p className="eyebrow">EVENT REMOVED</p>
        <h1 className="display-title">This preview<br/>has been cleared.</h1>
        <p className="intro">The delete flow is simulated locally. No Met event was changed.</p>
        <button className="primary-button" onClick={() => navigateToPreview("EventsHighEnd")}>Back to Events</button>
      </main>
    </div></div>;
  }

  return <div className="met-he"><div className="phone">
    <div className="statusbar"><span>9:41</span><span className="status-icons">● ● ▰</span></div>
    <header className="topbar"><button className="back-button" aria-label="Back to events" onClick={() => navigateToPreview("EventsHighEnd")}>‹</button><div className="brand">EVENT DETAILS</div><button className="top-action" aria-label="More event actions" onClick={() => setMenuOpen(true)}>···</button></header>
    <main className="scroll-area" style={{ paddingTop: 0 }}>
      <div className="detail-hero"><img src="https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1100&q=80" alt="Jazz quartet performing under warm amber stage lights at The Chapel"/><div className="hero-caption"><p className="eyebrow">VENUE EVENT · THE CHAPEL</p><h1>{title}</h1></div></div>
      <div className="detail-content">
        {audience === "host" ? <div className="approval-note">Host preview · these controls are only available to the event owner.</div> : null}
        <div className="detail-meta-grid"><div className="meta-cell"><label>When</label><strong>{when ? when.replace("T", " · ") : <>Friday, June 20<br/>Doors 6:00 · Music 7:00 PM</>}</strong></div><div className="meta-cell"><label>Where</label><strong>{location}</strong></div></div>
        <button className="inline-action" onClick={() => setNotice("Directions are ready for The Chapel.")}>⌖ &nbsp;Get directions</button>
        <div className="hostline"><i className="avatar">C</i><div className="host-copy"><strong>Presented by The Chapel</strong>Independent music venue · San Francisco</div><span style={{ fontSize: 10, color: "var(--green-deep)" }}>VENUE</span></div>
        <div className="section-row"><span className="section-label">TONIGHT, IN THE MISSION</span></div>
        <p className="body-copy">{note}</p>
        <FollowThroughActions onNotice={setNotice} />
        <div className="section-row"><span className="section-label">THE ROOM</span><span className="people">48 going</span></div>
        <div className="hostline"><span className="avatar-stack"><i className="avatar">ML</i><i className="avatar">JT</i><i className="avatar">AK</i></span><div className="host-copy"><strong>A good crowd is gathering</strong>People from across the neighborhood</div><span style={{ color: "var(--green-deep)" }}>›</span></div>
        {eventStarted && !eventEnded && audience === "attendee" ? <div className="approval-note">
          <strong>Check in at the event</strong><br/>Choose QR scan or location check-in. Both are verified by Met.
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="small-action" onClick={() => { setCheckedIn(true); setNotice("QR check-in preview complete."); }}>Scan event QR</button>
            <button className="small-action" onClick={() => { setCheckedIn(true); setNotice("Location check-in preview complete."); }}>Use location</button>
          </div>
          {checkedIn ? <p className="prototype-caption">Attendance confirmed in this preview.</p> : null}
        </div> : null}
        {eventEnded && audience === "attendee" && rsvp !== "Not going" ? <div className="hostline">
          <div className="host-copy"><strong>How was the evening?</strong>Share a review after attending.</div>
          <button className="small-action" onClick={() => setReviewOpen(true)}>Leave a review</button>
        </div> : null}
        {notice && <PreviewNotice>{notice}</PreviewNotice>}
      </div>
    </main>
    <div className="bottom-dock">
      {audience === "attendee"
        ? <><div style={{ display: "flex", gap: 6 }}>{(["Going", "Maybe", "Not going"] as Rsvp[]).map(x => <button key={x} className={`pill-button ${rsvp === x ? "selected" : ""}`} style={{ flex: 1, minHeight: 37 }} aria-pressed={rsvp === x} onClick={() => { setRsvp(x); setNotice(`Your response is ${x.toLowerCase()}.`); }}>{x}</button>)}</div><div className="people" style={{ justifyContent: "center", marginTop: 7 }}>Your response: <strong style={{ color: "var(--green-deep)" }}>{rsvp}</strong></div></>
        : <button className="primary-button" onClick={() => setMenuOpen(true)}>Manage event</button>}
    </div>
    {menuOpen && <PreviewSheet title="Event actions" description="Actions change with your event role and its status." actions={menuActions} onClose={() => setMenuOpen(false)} />}
    {shareOpen && <PreviewSheet title="Share this event" description="A public event link can be shared with friends." actions={[
      { label: "Copy event invitation", detail: `${title} · Friday, June 20 · The Chapel`, onSelect: () => { setShareOpen(false); setNotice("Sample event invitation copied in this preview; no real link was created."); } },
      { label: "Share event details", detail: "Title, time, venue, and public event link", onSelect: () => { setShareOpen(false); setNotice("The system share sheet is represented in this preview."); } },
    ]} onClose={() => setShareOpen(false)} />}
    {contactOpen && <PreviewSheet title="Contact The Chapel" description="Venue event contact details." actions={[
      { label: "Call venue", detail: "+1 (415) 555-0142", onSelect: () => { setNotice("Phone contact preview selected."); setContactOpen(false); } },
      { label: "Email venue", detail: "events@thechapel.example", onSelect: () => { setNotice("Email contact preview selected."); setContactOpen(false); } },
      { label: "Visit website", detail: "thechapel.example", onSelect: () => { setNotice("Website preview selected."); setContactOpen(false); } },
    ]} onClose={() => setContactOpen(false)} />}
    {reportOpen && <PreviewSheet title="Report this event" description="Choose the reason that best describes your concern." actions={["Inappropriate", "Offensive image", "Spam", "Harassment", "Other"].map(reason => ({ label: reason, onSelect: () => { setNotice(`Report submitted for review: ${reason}.`); setReportOpen(false); } }))} onClose={() => setReportOpen(false)} />}
    {attendanceOpen && <PreviewSheet title="Manage attendance" description="48 going · guest list preview" onClose={() => setAttendanceOpen(false)}>
      <div className="sheet-list">
        {attendees.map(({ name, status }) => <div className="sheet-list-row" key={name}><span><strong>{name}</strong><small>{status}</small></span><button className="small-action" onClick={() => { setAttendees(current => current.filter(person => person.name !== name)); setNotice(`${name} was removed from the preview guest list.`); }}>Remove</button></div>)}
      </div>
    </PreviewSheet>}
    {editOpen && <CreatePrototypeSheet kind="event" initial={{ title, when, location, note }} onClose={() => setEditOpen(false)} onSave={(draft) => { setTitle(draft.title); setWhen(draft.when); setLocation(draft.location); setNote(draft.note); setEditOpen(false); setNotice("Event details saved in this preview."); }} />}
    {deleteOpen && <PreviewSheet title="Delete this event?" description="Guests will no longer see it. This confirmation only changes the prototype." actions={[
      { label: "Keep event", onSelect: () => setDeleteOpen(false) },
      { label: "Delete event", danger: true, onSelect: () => setDeleted(true) },
    ]} onClose={() => setDeleteOpen(false)} />}
    {reviewOpen && <PreviewSheet title="Review the event" description="Your review is linked to this event." actions={["★★★★★ · Loved it", "★★★★☆ · Had a good time", "★★★☆☆ · It was okay"].map(label => ({ label, onSelect: () => { setReviewOpen(false); setNotice("Thanks — your event review is saved in this preview."); } }))} onClose={() => setReviewOpen(false)} />}
  </div></div>;
}
