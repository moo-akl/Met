import React, { useState } from "react";
import "./_group.css";
import {
  navigateToPreview,
  PreviewNotice,
  PreviewSheet,
  type SheetAction,
} from "./PrototypeInteractions";

type Listing = {
  title: string;
  type: "VENUE EVENT" | "MEMBER EVENT";
  date: string;
  place: string;
  note: string;
  count: string;
  img: string;
  host: string;
  daysAway: number;
  distance: number;
};

const seedListings: Listing[] = [
  { title: "Live jazz at The Chapel", type: "VENUE EVENT", date: "TONIGHT · 7:00 PM", place: "The Chapel · Mission District", note: "An intimate set in a candlelit former church. Doors at six.", count: "48 going", img: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1100&q=80", host: "Presented by The Chapel", daysAway: 0, distance: 0.4 },
  { title: "Sunday ceramics & coffee", type: "MEMBER EVENT", date: "SUN · 11:00 AM", place: "Clayroom · Potrero Hill", note: "A relaxed, beginner-friendly pottery session followed by coffee nearby.", count: "12 going", img: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1100&q=80", host: "Hosted by Maya Chen", daysAway: 4, distance: 1.2 },
];
type Rsvp = "Going" | "Maybe" | "Not going";
export function EventsHighEnd() {
  const [listings, setListings] = useState(seedListings);
  const [rsvps, setRsvps] = useState<Record<number, Rsvp>>({ 0: "Going", 1: "Maybe" });
  const [scope, setScope] = useState("For you");
  const [neighborhood, setNeighborhood] = useState("Mission · SF");
  const [createChoices, setCreateChoices] = useState(false);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [networksOpen, setNetworksOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const visible = listings.filter((item) => {
    if (scope === "This week") return item.daysAway <= 7;
    if (scope === "Venue") return item.type === "VENUE EVENT";
    if (scope === "Community") return item.type === "MEMBER EVENT";
    return true;
  });
  const createActions: SheetAction[] = [
    { label: "Create a private Plan", detail: "Invite only the people you know.", onSelect: () => navigateToPreview("PlansHighEnd") },
    { label: "Host a public Hangout", detail: "Review join requests before guests are added.", onSelect: () => navigateToPreview("HangoutsHighEnd") },
    { label: "Browse your networks", detail: "See events shared by your communities.", onSelect: () => setNotice("Network events are part of your community feed.") },
  ];
  return <div className="met-he"><div className="phone">
    <div className="statusbar"><span>9:41</span><span className="status-icons">● ● ▰</span></div>
    <header className="topbar"><div className="brand"><span className="brand-mark">met</span> / CITY GUIDE</div><div className="top-actions"><button className="back-button" aria-label="Past Hangouts and networks" onClick={() => setToolsOpen(true)}>···</button><button className="top-action" aria-label="Create a Plan or Hangout" onClick={() => setCreateChoices(true)}>+</button></div></header>
    <main className="scroll-area">
      <p className="eyebrow">OUT IN THE CITY · SAN FRANCISCO</p>
      <h1 className="display-title">Good plans,<br/>close by.</h1>
      <p className="intro">Venue nights and gatherings hosted by your community.</p>
      <div className="filter-strip" role="group" aria-label="Filter events">{["For you", "This week", "Venue", "Community"].map(x => <button key={x} className={`filter-chip ${scope === x ? "active" : ""}`} aria-pressed={scope === x} onClick={() => setScope(x)}>{x}</button>)}</div>
      <div className="section-row"><span className="section-label">{visible.length ? `NEXT UP · ${neighborhood.split(" · ")[0].toUpperCase()}` : "NO MATCHING EVENTS"}</span><button className="quiet-link" onClick={() => setNearbyOpen(true)}>{neighborhood}⌄</button></div>
      {visible.map((item) => {
        const index = listings.indexOf(item);
        return <article className="event-tile" key={item.title} style={{ marginBottom: 13 }}>
        <img className="tile-photo" src={item.img} alt={index === 0 ? "Jazz musicians playing on a warmly lit stage" : "Handmade ceramic bowls arranged on a studio table"}/>
        <div className="tile-content"><div className="tagline"><span>{item.type}</span><span className="mini-tag">{item.date.split(" · ")[0]}</span></div>
          <button className="plan-title-button tile-title" onClick={() => navigateToPreview("EventDetailHighEnd")}>{item.title}</button><div className="tile-meta">{item.date}<br/>{item.place}<br/>{item.host}</div>
          <p className="body-copy" style={{ margin: "7px 0 0" }}>{item.note}</p>
          <div className="tile-bottom"><span className="people"><span className="avatar-stack"><i className="avatar">ML</i><i className="avatar">JT</i><i className="avatar">+</i></span>{item.count}</span><button className="quiet-link" onClick={() => navigateToPreview("EventDetailHighEnd")}>Details ↗</button></div>
          <div className="tile-bottom" style={{ borderTop: "1px solid var(--line)", paddingTop: 9 }}>
            <span className="people">Your RSVP</span>
            <div style={{ display: "flex", gap: 4 }}>{(["Going", "Maybe", "Not going"] as Rsvp[]).map(status => <button key={status} className={`pill-button ${rsvps[index] === status ? "selected" : ""}`} aria-pressed={rsvps[index] === status} onClick={() => { setRsvps(old => ({ ...old, [index]: status })); setNotice(`RSVP updated: ${status}.`); }}>{status === "Not going" ? "No" : status}</button>)}</div>
          </div>
        </div>
      </article>;
      })}
      {!visible.length ? <p className="body-copy">Try another event type or check back soon.</p> : null}
      {notice && <PreviewNotice>{notice}</PreviewNotice>}
    </main>
    <nav className="nav" aria-label="Main navigation"><button className="nav-item" onClick={() => navigateToPreview("HangoutsHighEnd")}><span>⌂</span>Nearby</button><button className="nav-item active" aria-current="page"><span>◎</span>Events</button><button className="nav-item" onClick={() => navigateToPreview("PlansHighEnd")}><span>▤</span>Plans</button><button className="nav-item" onClick={() => setNotice("Connections and messages are available from your community.")}><span>◌</span>Inbox</button><button className="nav-item" onClick={() => setNotice("Your profile and account settings are outside this preview.")}><span>○</span>You</button></nav>
    {createChoices && <PreviewSheet title="Make a plan with Met" description="Choose the kind of gathering you want to create." actions={createActions} onClose={() => setCreateChoices(false)} />}
    {nearbyOpen && <PreviewSheet title="Choose a neighborhood" description="The feed uses your selected area for nearby events." actions={["Mission · SF", "Hayes Valley · SF", "Potrero Hill · SF"].map((name) => ({ label: name, onSelect: () => { setNeighborhood(name); setNearbyOpen(false); } }))} onClose={() => setNearbyOpen(false)} />}
    {toolsOpen && <PreviewSheet title="More from your community" actions={[
      { label: "Past Hangouts", detail: "Review your completed gatherings and attendance", onSelect: () => { navigateToPreview("PlansHighEnd"); } },
      { label: "Your networks", detail: "Browse events shared by your communities", onSelect: () => { setNetworksOpen(true); setToolsOpen(false); } },
    ]} onClose={() => setToolsOpen(false)} />}
    {networksOpen && <PreviewSheet title="Your networks" description="Events can also be shared with people in your communities." onClose={() => setNetworksOpen(false)}>
      <div className="sheet-list">
        {["Mission neighbors · 18 events", "Sunday walkers · 6 events", "Studio friends · 4 events"].map((name) => <div className="sheet-list-row" key={name}><span><strong>{name}</strong><small>Community event feed</small></span><button className="small-action" onClick={() => { setNetworksOpen(false); setNotice("Network events are shown in your community feed."); }}>Open</button></div>)}
      </div>
    </PreviewSheet>}
  </div></div>;
}
