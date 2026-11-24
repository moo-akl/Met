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

type JoinState = "none" | "pending" | "accepted" | "declined";

export function HangoutDetailHighEnd() {
  const [joinState, setJoinState] = useState<JoinState>("none");
  const [isHost, setIsHost] = useState(false);
  const [title, setTitle] = useState("Golden hour at Dolores Park");
  const [when, setWhen] = useState("");
  const [location, setLocation] = useState("Dolores Park · Mission District · 0.4 mi");
  const [note, setNote] = useState("Bring a blanket and something small to share. We’ll find a sunny patch, meet a few new faces, and let the evening unfold.");
  const [requests, setRequests] = useState(["Ari Rivera", "Kai Stone"]);
  const [attendees, setAttendees] = useState([
    { name: "Mina Lee", status: "Checked in" },
  ]);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([
    ["Leah", "We’re near the south entrance."],
    ["You", "On my way — thanks!"],
  ]);
  const [hostProfileOpen, setHostProfileOpen] = useState(false);
  const [eventStarted, setEventStarted] = useState(false);
  const [eventEnded, setEventEnded] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [deleted, setDeleted] = useState(false);

  const actions: SheetAction[] = isHost
    ? [
        { label: "Review join requests", detail: "Approve or decline people who asked to join", onSelect: () => { setRequestsOpen(true); setMenuOpen(false); } },
        { label: "Manage attendance", detail: "See accepted guests", onSelect: () => { setAttendanceOpen(true); setMenuOpen(false); } },
        { label: "Edit Hangout", detail: "Change the time, place, or plan", onSelect: () => { setEditOpen(true); setMenuOpen(false); } },
        { label: "Open Hangout conversation", detail: "Available to accepted guests and the host", onSelect: () => { setChatOpen(true); setMenuOpen(false); } },
        { label: "Share Hangout", detail: "Share the public invitation", onSelect: () => { setShareOpen(true); setMenuOpen(false); } },
        { label: "Delete Hangout", danger: true, onSelect: () => { setDeleteOpen(true); setMenuOpen(false); } },
        { label: "Preview guest view", onSelect: () => { setIsHost(false); setMenuOpen(false); } },
      ]
    : [
        { label: "Get directions", detail: "Exact meeting spot appears after approval", onSelect: () => { setNotice(joinState === "accepted" ? `Directions are ready for ${location}.` : "Directions become available after Leah accepts your request."); setMenuOpen(false); } },
        { label: "View host profile", detail: "See Leah’s community standing and reviews", onSelect: () => { setHostProfileOpen(true); setMenuOpen(false); } },
        { label: "Share Hangout", detail: "Share the public invitation", onSelect: () => { setShareOpen(true); setMenuOpen(false); } },
        { label: "Report this Hangout", detail: "Tell Met about a concern", onSelect: () => { setReportOpen(true); setMenuOpen(false); } },
        { label: "Preview event-day tools", detail: "Show check-in after the Hangout starts", onSelect: () => { setEventStarted(true); setMenuOpen(false); } },
        ...(joinState === "accepted" ? [{ label: "Preview post-Hangout review", detail: "Show the review action after attending", onSelect: () => { setEventEnded(true); setMenuOpen(false); } }] : []),
        { label: "Preview host controls", detail: "Switch to join-request management", onSelect: () => { setIsHost(true); setMenuOpen(false); } },
      ];

  if (deleted) {
    return <div className="met-he"><div className="phone">
      <div className="statusbar"><span>9:41</span><span className="status-icons">● ● ▰</span></div>
      <main className="scroll-area">
        <p className="eyebrow">HANGOUT REMOVED</p>
        <h1 className="display-title">This preview<br/>has been cleared.</h1>
        <p className="intro">The delete flow is simulated locally. No Met Hangout was changed.</p>
        <button className="primary-button" onClick={() => navigateToPreview("HangoutsHighEnd")}>Back to Hangouts</button>
      </main>
    </div></div>;
  }

  const requestAction = () => {
    if (joinState === "pending") {
      setJoinState("none");
      setNotice("Your join request was withdrawn.");
    } else {
      setJoinState("pending");
      setNotice("Request sent. Leah will review it before you join.");
    }
  };

  return <div className="met-he"><div className="phone">
    <div className="statusbar"><span>9:41</span><span className="status-icons">● ● ▰</span></div>
    <header className="topbar"><button className="back-button" aria-label="Back to nearby Hangouts" onClick={() => navigateToPreview("HangoutsHighEnd")}>‹</button><div className="brand">HANGOUT DETAILS</div><button className="top-action" aria-label="More Hangout actions" onClick={() => setMenuOpen(true)}>···</button></header>
    <main className="scroll-area" style={{ paddingTop: 0 }}>
      <div className="detail-hero"><img src="https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1100&q=80" alt="Friends gathered on a blanket at a sunny park picnic"/><div className="hero-caption"><p className="eyebrow">PUBLIC HANGOUT · HOST APPROVAL</p><h1>{title}</h1></div></div>
      <div className="detail-content">
        {isHost ? <div className="approval-note">Host preview · approve each join request before adding a guest.</div> : null}
        <div className="detail-meta-grid"><div className="meta-cell"><label>When</label><strong>{when ? when.replace("T", " · ") : <>Thursday, June 19<br/>6:15 PM · golden hour</>}</strong></div><div className="meta-cell"><label>Where</label><strong>{location}</strong></div></div>
        <button className="inline-action" onClick={() => setNotice(joinState === "accepted" || isHost ? "Directions are ready for Dolores Park." : "The exact meeting spot is shared after approval.")}>⌖ &nbsp;{joinState === "accepted" || isHost ? "Get directions" : "Approximate area · directions after approval"}</button>
        <div className="hostline"><i className="avatar">LM</i><div className="host-copy"><strong>{isHost ? "You’re hosting" : "Leah Martin is hosting"}</strong>Member host · 5 going · room for 3</div><span style={{ color: "var(--green-deep)" }}>↗</span></div>
        <button className="inline-action" onClick={() => setHostProfileOpen(true)}>4.9 · 18 host reviews · View profile</button>
        <div className="section-row"><span className="section-label">A SIMPLE PLAN</span></div>
        <p className="body-copy">{note}</p>
        <FollowThroughActions onNotice={setNotice} />
        <div className="approval-note">Request to join first. Leah reviews each request before you’re added; the exact meet-up spot is shared after approval.</div>
        <div className="section-row"><span className="section-label">WHO’S JOINING</span><span className="people">5 people</span></div>
        <div className="hostline"><span className="avatar-stack"><i className="avatar">AR</i><i className="avatar">KS</i><i className="avatar">+</i></span><div className="host-copy"><strong>A small group so far</strong>People joining this public Hangout</div></div>
        {joinState === "pending" ? <div className="approval-note">Your request is waiting for Leah’s approval. The exact meeting point stays private until you’re accepted.</div> : null}
        {joinState === "accepted" && !isHost ? <button className="quiet-link" onClick={() => setChatOpen(true)}>◌ &nbsp;Open Hangout conversation ↗</button> : null}
        {eventEnded && joinState === "accepted" && !isHost ? <div className="hostline">
          <div className="host-copy"><strong>How was the Hangout?</strong>Leave feedback for this gathering.</div>
          <button className="small-action" onClick={() => setReviewOpen(true)}>Leave a review</button>
        </div> : null}
        {eventStarted && joinState === "accepted" ? <div className="approval-note">
          <strong>Check in at the Hangout</strong><br/>Confirm attendance with the event QR or location check-in.
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="small-action" onClick={() => { setCheckedIn(true); setNotice("QR check-in preview complete."); }}>Scan event QR</button>
            <button className="small-action" onClick={() => { setCheckedIn(true); setNotice("Location check-in preview complete."); }}>Use location</button>
          </div>
          {checkedIn ? <p className="prototype-caption">Attendance confirmed in this preview.</p> : null}
        </div> : null}
        {eventStarted && joinState !== "accepted" && !isHost ? <div className="approval-note">Check-in is available after the host accepts your request.</div> : null}
        {notice && <PreviewNotice>{notice}</PreviewNotice>}
      </div>
    </main>
    <div className="bottom-dock">
      {isHost
        ? <button className="primary-button" onClick={() => setRequestsOpen(true)}>Review join requests</button>
        : joinState === "accepted"
          ? <><button className="primary-button" onClick={() => setChatOpen(true)}>Open Hangout conversation</button><button className="secondary-action" onClick={() => setNotice("You’re accepted. Contact Leah if your plans change.")}>You’re approved to join</button></>
          : <><button className="primary-button" onClick={requestAction}>{joinState === "pending" ? "Cancel join request" : joinState === "declined" ? "Request to join again" : "Request to join"}</button><button className="secondary-action" onClick={() => setNotice("Leah reviews each request before anyone is added.")}>{joinState === "pending" ? "Awaiting host approval" : "Host approval required"}</button></>}
    </div>
    {menuOpen && <PreviewSheet title="Hangout actions" description="Actions depend on whether you’re hosting or joining." actions={actions} onClose={() => setMenuOpen(false)} />}
    {shareOpen && <PreviewSheet title="Share this Hangout" description="Only the public invitation is shared; the exact meeting point stays private." actions={[
      { label: "Copy Hangout invitation", detail: `${title} · Dolores Park · host approval required`, onSelect: () => { setShareOpen(false); setNotice("Sample Hangout invitation copied in this preview; no real link was created."); } },
      { label: "Share public details", detail: "Title, date, approximate area, and host-approval note", onSelect: () => { setShareOpen(false); setNotice("The system share sheet is represented in this preview."); } },
    ]} onClose={() => setShareOpen(false)} />}
    {hostProfileOpen && <PreviewSheet title="Leah Martin" description="Hangout host profile · community feedback is shown in aggregate." actions={[
      { label: "View profile", detail: "See the organizer’s public profile", onSelect: () => { setNotice("Leah’s organizer profile preview is open."); setHostProfileOpen(false); } },
      { label: "Host rating · 4.9", detail: "Based on 18 accepted-guest reviews", onSelect: () => { setNotice("Host rating details are shown after a completed Hangout."); setHostProfileOpen(false); } },
    ]} onClose={() => setHostProfileOpen(false)} />}
    {reportOpen && <PreviewSheet title="Report this Hangout" description="Choose the reason that best describes your concern." actions={["Inappropriate", "Offensive image", "Spam", "Harassment", "Other"].map(reason => ({ label: reason, onSelect: () => { setNotice(`Report submitted for review: ${reason}.`); setReportOpen(false); } }))} onClose={() => setReportOpen(false)} />}
    {requestsOpen && <PreviewSheet title="Join requests" description="Review each request before adding a guest." onClose={() => setRequestsOpen(false)}>
      <div className="sheet-list">
        {requests.map(name => <div className="sheet-list-row" key={name}><span><strong>{name}</strong><small>Wants to join</small></span><div><button className="small-action" onClick={() => { setRequests(current => current.filter(person => person !== name)); setAttendees(current => [...current, { name, status: "Accepted" }]); if (name === "Ari Rivera") setJoinState("accepted"); setNotice(`${name} was approved in this preview.`); }}>Approve</button><button className="small-action" onClick={() => { setRequests(current => current.filter(person => person !== name)); if (name === "Ari Rivera") setJoinState("declined"); setNotice(`${name} was declined in this preview.`); }}>Decline</button></div></div>)}
        {requests.length === 0 && <p className="prototype-caption">All requests reviewed.</p>}
      </div>
    </PreviewSheet>}
    {attendanceOpen && <PreviewSheet title="Manage attendance" description="Accepted guests for this public Hangout." onClose={() => setAttendanceOpen(false)}>
      <div className="sheet-list">
        {attendees.map(({ name, status }) => <div className="sheet-list-row" key={name}><span><strong>{name}</strong><small>{status}</small></span><button className="small-action" onClick={() => { setAttendees(current => current.filter(person => person.name !== name)); if (name === "Ari Rivera") setJoinState("none"); setNotice(`${name} was removed from the preview guest list.`); }}>Remove</button></div>)}
      </div>
    </PreviewSheet>}
    {chatOpen && <PreviewSheet title={title} description="Conversation available to approved guests." onClose={() => setChatOpen(false)}>
      <div className="sheet-list">
        {chatMessages.map(([name, message], index) => <div className="sheet-list-row" key={`${name}-${index}`}><span><strong>{name}</strong><small>{message}</small></span></div>)}
      </div>
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); const message = chatMessage.trim(); if (!message) return; setChatMessages(current => [...current, ["You", message]]); setChatMessage(""); }}>
        <label className="sheet-field"><span>Message</span><input required value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Write to the group" /></label>
        <button className="primary-button" type="submit">Send message</button>
      </form>
    </PreviewSheet>}
    {reviewOpen && <PreviewSheet title="Review the Hangout" description="Feedback is only available to accepted guests after the gathering." onClose={() => setReviewOpen(false)}>
      <div className="sheet-choice-row">
        {[1, 2, 3, 4, 5].map((value) => <button key={value} className={`pill-button ${rating === value ? "selected" : ""}`} aria-pressed={rating === value} onClick={() => setRating(value)}>{value} ★</button>)}
      </div>
      <label className="sheet-field" style={{ marginTop: 12 }}><span>Your review</span><textarea rows={3} maxLength={1000} value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder="Share what the gathering was like" /></label>
      <button className="primary-button" disabled={rating < 1} style={{ marginTop: 10, opacity: rating < 1 ? .55 : 1 }} onClick={() => { setReviewOpen(false); setEventEnded(false); setNotice("Thanks — your Hangout review is saved in this preview."); }}>Submit review</button>
    </PreviewSheet>}
    {editOpen && <CreatePrototypeSheet kind="public Hangout" initial={{ title, when, location, note }} onClose={() => setEditOpen(false)} onSave={(draft) => { setTitle(draft.title); setWhen(draft.when); setLocation(draft.location); setNote(draft.note); setEditOpen(false); setNotice("Hangout details saved in this preview."); }} />}
    {deleteOpen && <PreviewSheet title="Delete this Hangout?" description="Guests will no longer see it. This only changes the prototype." actions={[
      { label: "Keep Hangout", onSelect: () => setDeleteOpen(false) },
      { label: "Delete Hangout", danger: true, onSelect: () => setDeleted(true) },
    ]} onClose={() => setDeleteOpen(false)} />}
    {eventStarted && joinState !== "accepted" && !isHost ? <div className="prototype-caption">Check-in is available after the host accepts your request.</div> : null}
  </div></div>;
}
