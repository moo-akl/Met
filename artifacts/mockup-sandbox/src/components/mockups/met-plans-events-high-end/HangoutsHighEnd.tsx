import React, { useState } from "react";
import "./_group.css";
import {
  CreatePrototypeSheet,
  navigateToPreview,
  PreviewNotice,
  PreviewSheet,
  type DraftDetails,
} from "./PrototypeInteractions";

type Hangout = {
  title: string;
  time: string;
  place: string;
  host: string;
  initial: string;
  people: string;
  desc: string;
  img: string;
  state: string;
  distance: number;
  startsAt: number;
};

const seedHangouts: Hangout[] = [
  { title: "Golden hour picnic at Dolores Park", time: "TODAY · 6:15 PM", place: "Dolores Park · 0.4 mi", host: "Leah Martin", initial: "LM", people: "5 going · room for 3", desc: "Blanket, something to share, and no agenda beyond meeting good people.", img: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1100&q=80", state: "Open to requests", distance: 0.4, startsAt: 18 * 60 + 15 },
  { title: "Coffee, then the coastal trail", time: "TODAY · 5:45 PM", place: "Lands End Lookout · 2.1 mi", host: "Jordan Lee", initial: "JL", people: "3 going · small group", desc: "An easy-paced walk with a coffee stop along the way.", img: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1100&q=80", state: "Open to requests", distance: 2.1, startsAt: 17 * 60 + 45 },
];
export function HangoutsHighEnd() {
  const [sort, setSort] = useState("Nearby");
  const [hangouts, setHangouts] = useState(seedHangouts);
  const [requests, setRequests] = useState<Record<string, boolean>>({});
  const [neighborhood, setNeighborhood] = useState("Mission · SF");
  const [composerOpen, setComposerOpen] = useState(false);
  const [neighborhoodOpen, setNeighborhoodOpen] = useState(false);
  const [moreLoaded, setMoreLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const visible = [...hangouts].sort((a, b) =>
    sort === "Nearby" ? a.distance - b.distance : a.startsAt - b.startsAt,
  );
  function addHangout(draft: DraftDetails) {
    setHangouts((current) => [{
      title: draft.title,
      time: draft.when ? new Date(draft.when).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).toUpperCase() : "THIS WEEK · 6:00 PM",
      place: draft.location || "Meeting point to be decided",
      host: "You",
      initial: "YOU",
      people: "You’re hosting · requests open",
      desc: draft.note || "A small public gathering hosted by you.",
      img: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1100&q=80",
      state: "Open to requests",
      distance: 0,
      startsAt: 0,
    }, ...current]);
    setComposerOpen(false);
    setNotice("Hangout added to your preview.");
  }
  return <div className="met-he"><div className="phone">
    <div className="statusbar"><span>9:41</span><span className="status-icons">● ● ▰</span></div>
    <header className="topbar"><div className="brand"><span className="brand-mark">met</span> / OPEN INVITATIONS</div><button className="top-action" aria-label="Host a public hangout" onClick={() => setComposerOpen(true)}>+</button></header>
    <main className="scroll-area">
      <p className="eyebrow">PUBLIC HANGOUTS · THE CITY</p>
      <h1 className="display-title">Meet around<br/>the corner.</h1>
      <p className="intro">Small, member-hosted gatherings. Ask to join; the host decides who’s in.</p>
      <div className="filter-strip" role="group" aria-label="Sort hangouts">{["Nearby", "Soonest"].map(x => <button key={x} className={`filter-chip ${sort === x ? "active" : ""}`} aria-pressed={sort === x} onClick={() => setSort(x)}>{x === "Nearby" ? "⌁  Nearby" : "◷  Soonest"}</button>)}</div>
      <div className="section-row"><span className="section-label">WITHIN A FEW MILES</span><button className="quiet-link" onClick={() => setNeighborhoodOpen(true)}>{neighborhood}⌄</button></div>
      {visible.map((h) => <article className="hangout-tile" key={h.title} style={{ marginBottom: 13 }}>
        <img className="tile-photo" src={h.img} alt="Friends gathering outdoors in San Francisco"/>
        <div className="tile-content"><div className="tagline"><span>MEMBER-LED · PUBLIC</span><span className="mini-tag">{h.state}</span></div>
          <button className="plan-title-button tile-title" onClick={() => navigateToPreview("HangoutDetailHighEnd")}>{h.title}</button><div className="tile-meta">{h.time}<br/>{h.place}</div>
          <p className="body-copy" style={{ margin: "7px 0 9px" }}>{h.desc}</p>
          <div className="hostline"><i className="avatar">{h.initial}</i><div className="host-copy"><strong>{h.host}</strong>Host · {h.people}</div><span aria-hidden="true" style={{ color: "var(--green-deep)" }}>↗</span></div>
          <div className="tile-bottom"><span className="people"><span className="avatar-stack"><i className="avatar">AR</i><i className="avatar">KS</i><i className="avatar">+</i></span>{h.people}</span><button className={`pill-button ${requests[h.title] ? "selected" : ""}`} aria-pressed={Boolean(requests[h.title])} onClick={() => { setRequests(old => ({ ...old, [h.title]: !old[h.title] })); setNotice(requests[h.title] ? "Join request withdrawn." : `Request sent to ${h.host} for approval.`); }}>{requests[h.title] ? "Pending" : "Request to join"}</button></div>
        </div>
      </article>)}
      {!moreLoaded
        ? <button className="primary-button" style={{ margin: "4px 0 14px" }} onClick={() => { setMoreLoaded(true); setHangouts(current => [...current, { title: "Sketches and iced tea at Yerba Buena", time: "TODAY · 7:00 PM", place: "Yerba Buena Gardens · 1.3 mi", host: "Sam Rivera", initial: "SR", people: "2 going · room for 4", desc: "Bring a notebook; we’ll find a quiet table and trade ideas.", img: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1100&q=80", state: "Open to requests", distance: 1.3, startsAt: 19 * 60 }]); setNotice("More nearby Hangouts loaded."); }}>Show more Hangouts</button>
        : <p className="body-copy">You’re up to date with nearby Hangouts.</p>}
      {notice && <PreviewNotice>{notice}</PreviewNotice>}
    </main>
    <nav className="nav" aria-label="Main navigation"><button className="nav-item active" aria-current="page"><span>⌂</span>Nearby</button><button className="nav-item" onClick={() => navigateToPreview("EventsHighEnd")}><span>◎</span>Events</button><button className="nav-item" onClick={() => navigateToPreview("PlansHighEnd")}><span>▤</span>Plans</button><button className="nav-item" onClick={() => setNotice("Connections and messages are available from your community.")}><span>◌</span>Inbox</button><button className="nav-item" onClick={() => setNotice("Your profile and account settings are outside this preview.")}><span>○</span>You</button></nav>
    {composerOpen && <CreatePrototypeSheet kind="public Hangout" onClose={() => setComposerOpen(false)} onSave={addHangout} />}
    {neighborhoodOpen && <PreviewSheet title="Choose a neighborhood" description="The nearby feed is sorted around this area." actions={["Mission · SF", "Hayes Valley · SF", "North Beach · SF"].map((name) => ({ label: name, onSelect: () => { setNeighborhood(name); setNeighborhoodOpen(false); } }))} onClose={() => setNeighborhoodOpen(false)} />}
  </div></div>;
}
