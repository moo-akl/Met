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

type InvitationState = "accepted" | "pending" | "declined";

export function PlanDetailHighEnd() {
  const [invitation, setInvitation] = useState<InvitationState>("accepted");
  const [isHost, setIsHost] = useState(false);
  const [title, setTitle] = useState("A table for six at Marlowe");
  const [when, setWhen] = useState("");
  const [location, setLocation] = useState("Marlowe · Hayes Valley");
  const [note, setNote] = useState("I finally got a table at Marlowe. Come hungry; let’s make a night of it and catch up properly.");
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [eventStarted, setEventStarted] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([
    ["Sofia", "Table is confirmed for 6:45."],
    ["Nia", "I’ll meet everyone by the entrance."],
  ]);
  const [invitees, setInvitees] = useState([
    { name: "Nia Chen", status: "Accepted" },
    { name: "Jordan Lee", status: "Accepted" },
    { name: "Sam Rivera", status: "Awaiting reply" },
  ]);
  const [inviteName, setInviteName] = useState("");

  const actions: SheetAction[] = isHost
    ? [
        { label: "Edit Plan", detail: "Update the time, place, or invitation note", onSelect: () => { setEditOpen(true); setMenuOpen(false); } },
        { label: "Manage invited friends", detail: "Review replies and update the guest list", onSelect: () => { setManageOpen(true); setMenuOpen(false); } },
        { label: "Open group conversation", detail: "Only accepted guests can read this conversation", onSelect: () => { setChatOpen(true); setMenuOpen(false); } },
        { label: "Share private invitation", detail: "Only invited people can open this Plan", onSelect: () => { setShareOpen(true); setMenuOpen(false); } },
        { label: "Delete Plan", danger: true, onSelect: () => { setDeleteOpen(true); setMenuOpen(false); } },
        { label: "Preview invited guest view", onSelect: () => { setIsHost(false); setMenuOpen(false); } },
      ]
    : [
        { label: "Share invitation", detail: "Private Plans are visible only to invited friends", onSelect: () => { setShareOpen(true); setMenuOpen(false); } },
        { label: "Report this Plan", detail: "Tell Met about a concern", onSelect: () => { setReportOpen(true); setMenuOpen(false); } },
        { label: "Preview event-day tools", detail: "Show check-in after the Plan starts", onSelect: () => { setEventStarted(true); setMenuOpen(false); } },
        ...(invitation === "accepted" ? [{ label: "Leave Plan", detail: "You can accept another invitation later", danger: true, onSelect: () => { setLeaveOpen(true); setMenuOpen(false); } }] : []),
        { label: "Preview host controls", detail: "Switch to the organizer’s actions", onSelect: () => { setIsHost(true); setMenuOpen(false); } },
      ];

  if (deleted) {
    return <div className="met-he"><div className="phone">
      <div className="statusbar"><span>9:41</span><span className="status-icons">● ● ▰</span></div>
      <main className="scroll-area">
        <p className="eyebrow">PLAN REMOVED</p>
        <h1 className="display-title">This preview<br/>has been cleared.</h1>
        <p className="intro">The delete flow is simulated locally. No Met Plan was changed.</p>
        <button className="primary-button" onClick={() => navigateToPreview("PlansHighEnd")}>Back to Plans</button>
      </main>
    </div></div>;
  }

  return <div className="met-he"><div className="phone">
    <div className="statusbar"><span>9:41</span><span className="status-icons">● ● ▰</span></div>
    <header className="topbar"><button className="back-button" aria-label="Back to private plans" onClick={() => navigateToPreview("PlansHighEnd")}>‹</button><div className="brand">PRIVATE PLAN</div><button className="top-action" aria-label="More Plan actions" onClick={() => setMenuOpen(true)}>···</button></header>
    <main className="scroll-area" style={{ paddingTop: 0 }}>
      <div className="detail-hero"><img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1100&q=80" alt="An intimate dinner table set for friends in a warmly lit restaurant"/><div className="hero-caption"><p className="eyebrow">{isHost ? "YOUR PRIVATE PLAN · INVITATION ONLY" : "A NOTE FROM SOFIA · INVITATION ONLY"}</p><h1>{title}</h1></div></div>
      <div className="detail-content">
        {isHost ? <div className="approval-note">Host preview · this Plan is private and visible only to invited friends.</div> : null}
        <div className="detail-meta-grid"><div className="meta-cell"><label>When</label><strong>{when ? when.replace("T", " · ") : <>Saturday, June 21<br/>7:30 PM</>}</strong></div><div className="meta-cell"><label>Where</label><strong>{location}</strong></div></div>
        <button className="inline-action" onClick={() => setNotice("Directions preview opened for Marlowe.")}>⌖ &nbsp;Get directions</button>
        <div className="hostline"><i className="avatar">SR</i><div className="host-copy"><strong>{isHost ? "You’re hosting" : "Sofia Rivera invited you"}</strong>Host · 4 friends invited</div><span style={{ color: "var(--green-deep)" }}>PRIVATE</span></div>
        <div className="section-row"><span className="section-label">THE INVITATION</span></div>
        <p className="body-copy">“{note}”</p>
        <FollowThroughActions onNotice={setNotice} />
        <div className="approval-note">This is a private Plan, shared only with the friends Sofia invited. It isn’t listed publicly.</div>
        <div className="section-row"><span className="section-label">YOUR PEOPLE</span><span className="people">3 accepted · 1 awaiting</span></div>
        <div className="hostline"><span className="avatar-stack"><i className="avatar">SR</i><i className="avatar">NC</i><i className="avatar">JL</i></span><div className="host-copy"><strong>Sofia, Nia, Jordan + you</strong>Only accepted guests can open the group chat.</div></div>
        {(isHost || invitation === "accepted") ? <button className="quiet-link" onClick={() => setChatOpen(true)}>◌ &nbsp;Open group conversation ↗</button> : null}
        {eventStarted && !isHost && invitation === "accepted" ? <div className="approval-note">
          <strong>Check in at Marlowe</strong><br/>Confirm attendance with the event QR or location check-in.
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="small-action" onClick={() => { setCheckedIn(true); setNotice("QR check-in preview complete."); }}>Scan event QR</button>
            <button className="small-action" onClick={() => { setCheckedIn(true); setNotice("Location check-in preview complete."); }}>Use location</button>
          </div>
          {checkedIn ? <p className="prototype-caption">Attendance confirmed in this preview.</p> : null}
        </div> : null}
        {notice && <PreviewNotice>{notice}</PreviewNotice>}
      </div>
    </main>
    <div className="bottom-dock">
      {isHost
        ? <><button className="primary-button" onClick={() => setEditOpen(true)}>Edit private Plan</button><button className="secondary-action" onClick={() => setManageOpen(true)}>Manage invited friends</button></>
        : invitation === "accepted"
          ? <><button className="primary-button" onClick={() => setNotice("Your reply is already recorded as going.")}>✓ &nbsp; You’re going</button><button className="secondary-action" onClick={() => setInvitation("pending")}>Change response</button></>
          : <div style={{ display: "flex", gap: 8 }}><button className="primary-button" onClick={() => { setInvitation("accepted"); setNotice("You accepted Sofia’s invitation."); }}>{invitation === "declined" ? "Accept invitation again" : "Accept invitation"}</button><button className="pill-button" onClick={() => { setInvitation("declined"); setNotice("You declined Sofia’s invitation."); }}>Decline</button></div>}
    </div>
    {menuOpen && <PreviewSheet title="Private Plan actions" description="Plan actions depend on whether you’re hosting or invited." actions={actions} onClose={() => setMenuOpen(false)} />}
    {shareOpen && <PreviewSheet title="Share this private Plan" description="A real invitation link is limited to the invited guests." actions={[
      { label: "Copy invitation text", detail: `${title} · Saturday, June 21 at Marlowe`, onSelect: () => { setShareOpen(false); setNotice("Sample invitation copied in this preview; no real link was created."); } },
      ...(isHost ? [{ label: "Invite another friend", detail: "Hosts can add people to the private guest list", onSelect: () => { setShareOpen(false); setManageOpen(true); } }] : []),
    ]} onClose={() => setShareOpen(false)} />}
    {reportOpen && <PreviewSheet title="Report this Plan" description="Choose the reason that best describes your concern." actions={["Inappropriate", "Harassment", "Spam", "Other"].map(reason => ({ label: reason, onSelect: () => { setReportOpen(false); setNotice(`Report submitted for review: ${reason}.`); } }))} onClose={() => setReportOpen(false)} />}
    {chatOpen && <PreviewSheet title={title} description="Group conversation · accepted guests only" onClose={() => setChatOpen(false)}>
      <div className="sheet-list">
        {chatMessages.map(([name, message], index) => <div className="sheet-list-row" key={`${name}-${index}`}><span><strong>{name}</strong><small>{message}</small></span></div>)}
      </div>
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); const message = chatMessage.trim(); if (!message) return; setChatMessages(current => [...current, ["You", message]]); setChatMessage(""); }}>
        <label className="sheet-field"><span>Message</span><input required value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Write to the group" /></label>
        <button className="primary-button" type="submit">Send message</button>
      </form>
    </PreviewSheet>}
    {manageOpen && <PreviewSheet title="Manage invited friends" description="The guest list is private to the host." onClose={() => setManageOpen(false)}>
      <div className="sheet-list">
        {invitees.map(({ name, status }) => <div className="sheet-list-row" key={name}><span><strong>{name}</strong><small>{status}</small></span><button className="small-action" onClick={() => { setInvitees(current => current.filter(person => person.name !== name)); setNotice(`${name} was removed from the private guest list.`); }}>Remove</button></div>)}
      </div>
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); const name = inviteName.trim(); if (!name) return; setInvitees(current => [...current, { name, status: "Invitation sent" }]); setInviteName(""); setNotice("Friend invited in this preview."); }}>
        <label className="sheet-field"><span>Invite a friend</span><input required value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Name" /></label>
        <button className="primary-button" type="submit">Send invitation</button>
      </form>
    </PreviewSheet>}
    {editOpen && <CreatePrototypeSheet kind="private Plan" initial={{ title, when, location, note }} onClose={() => setEditOpen(false)} onSave={(draft) => { setTitle(draft.title); setWhen(draft.when); setLocation(draft.location); setNote(draft.note); setEditOpen(false); setNotice("Plan details saved in this preview."); }} />}
    {leaveOpen && <PreviewSheet title="Leave this Plan?" description="Sofia will see that you changed your reply." actions={[
      { label: "Keep my place", onSelect: () => setLeaveOpen(false) },
      { label: "Leave Plan", danger: true, onSelect: () => { setInvitation("declined"); setLeaveOpen(false); setNotice("You left the private Plan."); } },
    ]} onClose={() => setLeaveOpen(false)} />}
    {deleteOpen && <PreviewSheet title="Delete this Plan?" description="Invited friends will no longer see it. This only changes the prototype." actions={[
      { label: "Keep Plan", onSelect: () => setDeleteOpen(false) },
      { label: "Delete Plan", danger: true, onSelect: () => setDeleted(true) },
    ]} onClose={() => setDeleteOpen(false)} />}
  </div></div>;
}
