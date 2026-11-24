import React, { useState } from "react";
import "./_group.css";
import {
  CreatePrototypeSheet,
  navigateToPreview,
  PreviewNotice,
  PreviewSheet,
  type DraftDetails,
} from "./PrototypeInteractions";

type PlanRow = {
  day: string;
  month: string;
  title: string;
  time: string;
  place: string;
  status: string;
  kind: "host" | "pending" | "accepted";
  daysAway: number;
};

const seedPlanRows: PlanRow[] = [
  { day: "18", month: "JUN", title: "A table for six at Marlowe", time: "Sat · 7:30 PM", place: "Marlowe · Hayes Valley", status: "You’re hosting", kind: "host", daysAway: 1 },
  { day: "21", month: "JUN", title: "Sunday coastal walk", time: "Sun · 9:00 AM", place: "Lands End · meet at the lookout", status: "Invitation pending", kind: "pending", daysAway: 4 },
  { day: "24", month: "JUN", title: "Pasta, then a little jazz", time: "Wed · 6:45 PM", place: "Sofia’s apartment · Mission", status: "You’re going · 4 friends", kind: "accepted", daysAway: 7 },
  { day: "09", month: "JUL", title: "A photo walk by the water", time: "Thu · 5:30 PM", place: "Crissy Field · Marina", status: "You’re going · 2 friends", kind: "accepted", daysAway: 22 },
];

export function PlansHighEnd() {
  const [filter, setFilter] = useState("All plans");
  const [showAllDates, setShowAllDates] = useState(false);
  const [rows, setRows] = useState(seedPlanRows);
  const [composerOpen, setComposerOpen] = useState(false);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([
    ["Sofia", "Table is confirmed for 6:45."],
    ["Nia", "I’ll meet everyone by the entrance."],
    ["You", "Looking forward to it."],
  ]);
  const visible = rows.filter((x) => {
    const matchesFilter = filter === "Hosting"
      ? x.kind === "host"
      : filter === "Invitations"
        ? x.kind !== "host"
        : true;
    return matchesFilter && (showAllDates || x.daysAway <= 14);
  });
  function addPlan(draft: DraftDetails) {
    const date = draft.when ? new Date(draft.when) : null;
    setRows((current) => [{
      day: date ? String(date.getDate()).padStart(2, "0") : "28",
      month: date ? date.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "JUN",
      title: draft.title,
      time: date ? date.toLocaleDateString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }) : "This weekend · 7:00 PM",
      place: draft.location || "Location to be decided",
      status: "You’re hosting",
      kind: "host",
      daysAway: 0,
    }, ...current]);
    setComposerOpen(false);
    setFilter("All plans");
    setShowAllDates(false);
    setNotice("Private Plan added to your preview.");
  }
  return <div className="met-he"><div className="phone">
    <div className="statusbar"><span>9:41</span><span className="status-icons">● ● ▰</span></div>
    <header className="topbar"><div className="brand"><span className="brand-mark">met</span> / YOUR PEOPLE</div><button className="top-action" aria-label="Create a private plan" onClick={() => setComposerOpen(true)}>+</button></header>
    <main className="scroll-area">
      <p className="eyebrow">PRIVATE PLANS · YOUR CIRCLE</p>
      <h1 className="display-title">The good<br/>things ahead.</h1>
      <p className="intro">A private daybook for the people you already know.<br/>Only invited friends can see these plans.</p>
      <div className="filter-strip" role="group" aria-label="Filter plans">
        {["All plans", "Hosting", "Invitations"].map(item => <button key={item} className={`filter-chip ${filter === item ? "active" : ""}`} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}
      </div>
      <div className="section-row"><span className="section-label">UPCOMING · {visible.length} PLANS</span><button className="quiet-link" aria-pressed={!showAllDates} onClick={() => setShowAllDates(value => !value)}>{showAllDates ? "Next two weeks" : "All dates"} ↗</button></div>
      {visible.map((plan) => <article className="plan-row" key={plan.title}>
        <div className="date-card"><span>{plan.month}</span><strong>{plan.day}</strong></div>
        <div><button className="plan-title-button plan-title" onClick={() => navigateToPreview("PlanDetailHighEnd")}>{plan.title}</button><div className="plan-meta">{plan.time}<br/>{plan.place}</div>
          <div className="status-label"><i className="status-dot"/>{plan.status}</div>
          {plan.kind === "accepted" && <button className="quiet-link" onClick={() => setConversationOpen(true)}>◌ &nbsp;Open group conversation</button>}
          {plan.kind === "pending" && <button className="quiet-link" onClick={() => navigateToPreview("PlanDetailHighEnd")}>Review invitation ↗</button>}
        </div>
      </article>)}
      {!visible.length ? <p className="body-copy">No Plans match this view yet.</p> : null}
      <div className="section-row"><span className="section-label">A NOTE ON PLANS</span></div>
      <p className="body-copy">Plans are never public listings. Hosting, accepting an invitation, and waiting on a reply each stay clear here.</p>
      {notice && <PreviewNotice>{notice}</PreviewNotice>}
    </main>
    <nav className="nav" aria-label="Main navigation"><button className="nav-item" onClick={() => navigateToPreview("HangoutsHighEnd")}><span>⌂</span>Nearby</button><button className="nav-item" onClick={() => navigateToPreview("EventsHighEnd")}><span>◎</span>Events</button><button className="nav-item active" aria-current="page"><span>▤</span>Plans</button><button className="nav-item" onClick={() => setConversationOpen(true)}><span>◌</span>Inbox</button><button className="nav-item" onClick={() => setNotice("Your profile and account settings are outside this preview.")}><span>○</span>You</button></nav>
    {composerOpen && <CreatePrototypeSheet kind="private Plan" onClose={() => setComposerOpen(false)} onSave={addPlan} />}
    {conversationOpen && <PreviewSheet title="Pasta, then a little jazz" description="Private group conversation · accepted guests only" onClose={() => setConversationOpen(false)}>
      <div className="sheet-list">
        {chatMessages.map(([name, text], index) => <div className="sheet-list-row" key={`${name}-${index}`}><span><strong>{name}</strong><small>{text}</small></span></div>)}
      </div>
      <form className="sheet-form" onSubmit={(event) => { event.preventDefault(); const message = chatMessage.trim(); if (!message) return; setChatMessages(current => [...current, ["You", message]]); setChatMessage(""); }}>
        <label className="sheet-field"><span>Message</span><input required value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Write to the group" /></label>
        <button className="primary-button" type="submit">Send message</button>
      </form>
    </PreviewSheet>}
  </div></div>;
}
