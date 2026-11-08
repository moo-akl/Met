import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Compass,
  Coffee,
  Globe2,
  Heart,
  Instagram,
  MapPin,
  QrCode,
  Radio,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const ink = "#183b2a";
const muted = "#718477";
const green = "#287447";
const paper = "#fbfaf4";
const hairline = "#dbe4d8";

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 26, height: 26, borderRadius: 9, background: green, display: "grid", placeItems: "center", color: "#f5f6e8", fontSize: 14, fontWeight: 800, fontFamily: "Georgia,serif" }}>m</div>
      <span style={{ fontSize: 21, letterSpacing: "-1.1px", fontWeight: 750, color: ink }}>met</span>
    </div>
  );
}

function MapArtwork({ profile = false }: { profile?: boolean }) {
  return (
    <svg viewBox="0 0 360 255" preserveAspectRatio="xMidYMid slice" style={{ display: "block", width: "100%", height: "100%" }} role="img" aria-label="Illustrated street map of the East Village">
      <rect width="360" height="255" fill="#e8eee3" />
      <path d="M0 29 360 5M0 81 360 59M0 143 360 119M0 210 360 184M34 0l23 255M120 0l16 255M247 0l22 255M322 0l20 255" stroke="#c4d0bf" strokeWidth="1" />
      <path d="M72-10 105-10 150 270 119 270zM197-10 226-10 255 270 228 270zM-10 105 370 89M-10 177 370 157" stroke="#fffdf6" strokeWidth="13" />
      <path d="M271-10c-20 58-14 110 5 153s27 70 24 122h68V-10z" fill="#c8dfe0" />
      <path d="M18 16h44v35H18zM154 23h26v34h-26zM147 198h59v31h-59zM21 189h48v43H21z" fill="#d4dfcf" />
      <path d="M15 70c27-10 40-9 54 0M147 70c23 10 34 9 51-2M18 124c25 11 37 10 59-1M146 129c21-8 31-9 53 1" fill="none" stroke="#f7f4e9" strokeWidth="3" />
      <text x="18" y="15" fill="#728677" fontSize="8" fontWeight="700" letterSpacing="1.5">EAST VILLAGE</text>
      <text x="275" y="24" fill="#688a8b" fontSize="8" fontWeight="700" letterSpacing="1.2">EAST RIVER</text>
      <text x="145" y="91" fill="#809083" fontSize="7" letterSpacing="1">ST MARKS PL</text>
      <text x="15" y="166" fill="#809083" fontSize="7" letterSpacing="1">2ND AVE</text>
      <text x="145" y="244" fill="#809083" fontSize="7" letterSpacing="1">AVENUE A</text>
      <g transform="translate(175 123)">
        <circle r="23" fill="#398853" opacity=".12" />
        <circle r="14" fill="#398853" opacity=".18" />
        <path d="M0-11c-6 0-10 4-10 10 0 8 10 19 10 19S10 7 10-1C10-7 6-11 0-11z" fill="#287447" stroke="#fffdf6" strokeWidth="2" />
        <circle cy="-1" r="3" fill="#fffdf6" />
      </g>
      <g transform="translate(72 111)">
        <circle r="9" fill="#fffdf6" stroke="#b96b45" strokeWidth="2" />
        <circle r="3" fill="#b96b45" />
      </g>
      <g transform="translate(219 191)">
        <circle r="8" fill="#fffdf6" stroke="#73869a" strokeWidth="2" />
        <circle r="3" fill="#73869a" />
      </g>
      {profile && <path d="M178 123C191 143 201 158 218 183" fill="none" stroke="#287447" strokeDasharray="3 4" strokeWidth="2" />}
    </svg>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 342, height: 760, boxSizing: "border-box", padding: 5, borderRadius: 34, background: "#20362b", boxShadow: "0 25px 58px rgba(35,57,40,.19), 0 4px 12px rgba(35,57,40,.10)", flex: "0 0 auto" }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 29, overflow: "hidden", background: paper, position: "relative" }}>
        {children}
      </div>
    </div>
  );
}

function PhoneStatus() {
  return <div style={{ height: 25, padding: "0 18px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 9, color: ink, fontWeight: 750 }}><span>9:41</span><span style={{ letterSpacing: 1 }}>● ▮ ▰</span></div>;
}

function HomeScreen() {
  const [visible, setVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <PhoneFrame>
      <PhoneStatus />
      <div style={{ height: 43, padding: "0 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${hairline}` }}>
        <Wordmark />
        <div style={{ display: "flex", gap: 15, color: ink }}><Globe2 size={18} /><Users size={18} /></div>
      </div>
      <div style={{ height: "calc(100% - 68px)", overflow: "hidden", position: "relative" }}>
        <div style={{ padding: "16px 18px 90px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "1.8px", color: green, fontWeight: 800 }}>NEW YORK · EAST VILLAGE</div>
              <h2 style={{ fontFamily: "Georgia,serif", fontSize: 26, fontWeight: 500, lineHeight: 1.02, letterSpacing: "-1px", margin: "7px 0 4px", color: ink }}>A little closer<br />to your world.</h2>
              <div style={{ fontSize: 10, color: muted }}>Find a good place to begin.</div>
            </div>
            <div style={{ textAlign: "right", paddingBottom: 3 }}>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 23, color: ink }}>8</div>
              <div style={{ fontSize: 8, color: muted }}>nearby</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${hairline}`, borderBottom: `1px solid ${hairline}`, padding: "10px 0", marginBottom: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 29, height: 29, borderRadius: "50%", background: "#e8f0e6", color: green, display: "grid", placeItems: "center" }}>{visible ? <Radio size={15} /> : <ShieldCheck size={15} />}</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 750, color: ink }}>{visible ? "Nearby visibility is on" : "Visibility is paused"}</div>
                <div style={{ fontSize: 8, color: muted, marginTop: 2 }}>Guest pins are never shown on this map.</div>
              </div>
            </div>
            <button onClick={() => setVisible(!visible)} aria-label="Toggle nearby visibility" style={{ width: 38, height: 22, border: 0, borderRadius: 14, padding: 3, background: visible ? green : "#c6d0c4", cursor: "pointer", display: "flex", justifyContent: visible ? "flex-end" : "flex-start" }}><span style={{ background: "#fffdf6", width: 16, height: 16, borderRadius: 99, boxShadow: "0 1px 3px #0002" }} /></button>
          </div>

          <div style={{ position: "relative", height: 245, borderRadius: 4, overflow: "hidden", borderTop: "2px solid #d4e0d6", borderBottom: "2px solid #d4e0d6" }}>
            <MapArtwork />
            <div style={{ position: "absolute", left: 110, top: 102, background: paper, padding: "7px 9px", boxShadow: "0 3px 12px #183b2a24", display: "flex", alignItems: "center", gap: 6 }}>
              <Coffee size={12} color={green} /><span style={{ color: ink, fontSize: 9, fontWeight: 750 }}>Sunroom Café</span>
            </div>
            <div style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, background: paper, display: "grid", placeItems: "center", color: ink, boxShadow: "0 2px 8px #183b2a18" }}><Compass size={15} /></div>
            <div style={{ position: "absolute", bottom: 8, left: 8, padding: "5px 7px", background: "rgba(251,250,244,.94)", color: muted, fontSize: 8, display: "flex", alignItems: "center", gap: 5 }}><ShieldCheck size={11} />Venue activity · no live guest pins</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 15, marginBottom: 7 }}>
            <div><div style={{ color: green, fontSize: 8, fontWeight: 800, letterSpacing: "1.5px" }}>ON YOUR BLOCK</div><div style={{ fontFamily: "Georgia,serif", color: ink, fontSize: 20, marginTop: 2 }}>Places with a pulse</div></div>
            <ArrowUpRight size={15} color={green} />
          </div>
          <div style={{ borderTop: `1px solid ${hairline}` }}>
            {[
              ["01", "The Sunroom Café", "Café & garden · 128 visits this week", "0.2 mi"],
              ["02", "Juniper Market", "Local market · 64 visits this week", "0.6 mi"],
              ["03", "Cypress Books", "Bookshop & café · 42 visits this week", "0.8 mi"],
            ].map(([n, title, sub, dist]) => (
              <div key={title} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: `1px solid ${hairline}` }}>
                <span style={{ color: "#98a99b", fontSize: 9, fontFamily: "Georgia,serif" }}>{n}</span>
                <div><div style={{ color: ink, fontSize: 10, fontWeight: 750 }}>{title}</div><div style={{ color: muted, fontSize: 8, marginTop: 3 }}>{sub}</div></div>
                <span style={{ color: muted, fontSize: 8 }}>{dist}</span>
              </div>
            ))}
          </div>
          <div style={{ margin: "12px 0 15px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid #a9c7a9", borderBottom: "1px solid #a9c7a9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}><CalendarDays size={15} color={green} /><div><div style={{ fontSize: 10, color: ink, fontWeight: 750 }}>Plans near you</div><div style={{ fontSize: 8, color: muted }}>Saturday · Sketch & stroll · 3 going</div></div></div><ChevronRight size={15} color={muted} />
          </div>
          <button onClick={() => setSaved(!saved)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: 0, background: green, color: "#f7f6eb", padding: "11px 10px", fontSize: 10, fontWeight: 750, cursor: "pointer" }}>
            {saved ? <Check size={14} /> : <MapPin size={14} />}{saved ? "Check-in noted for this concept" : "Check in at a venue"}
          </button>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, padding: "13px 0", borderTop: `1px solid ${hairline}`, borderBottom: `1px solid ${hairline}` }}>
            <div><div style={{ fontSize: 8, letterSpacing: "1px", color: muted, textTransform: "uppercase" }}>This week</div><div style={{ color: ink, fontFamily: "Georgia,serif", fontSize: 23, marginTop: 3 }}>12 <span style={{ font: "9px system-ui", color: muted }}>new people</span></div><div style={{ fontSize: 8, color: muted }}>4 familiar faces crossed again</div></div>
            <div style={{ borderLeft: `1px solid ${hairline}`, paddingLeft: 15 }}><div style={{ fontSize: 8, letterSpacing: "1px", color: muted, textTransform: "uppercase" }}>Local standing</div><div style={{ color: ink, fontFamily: "Georgia,serif", fontSize: 23, marginTop: 3 }}>#8 <span style={{ font: "9px system-ui", color: muted }}>at Sunroom</span></div><div style={{ fontSize: 8, color: muted }}>View this week’s visitors</div></div>
          </div>
          <div style={{ padding: "14px 0 3px", display: "flex", gap: 9, alignItems: "center" }}><div style={{ width: 28, height: 28, borderRadius: 50, background: "#e7eee0", display: "grid", placeItems: "center", color: green }}><Sparkles size={14} /></div><div><div style={{ color: ink, fontSize: 9, fontWeight: 750 }}>A good place to start</div><div style={{ color: muted, fontSize: 8 }}>Bring a friend, or meet someone new nearby.</div></div></div>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 48, background: "rgba(251,250,244,.96)", borderTop: `1px solid ${hairline}`, display: "flex", justifyContent: "space-around", alignItems: "center", color: green }}>
          {[["Home", <Compass size={16} />], ["Connections", <Users size={16} />], ["Networks", <Globe2 size={16} />], ["Profile", <span style={{ fontSize: 15 }}>A</span>]].map(([label, icon]) => <div key={String(label)} style={{ minWidth: 55, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 7, color: label === "Home" ? green : muted }}>{icon}<span>{label}</span></div>)}
        </div>
      </div>
    </PhoneFrame>
  );
}

function ProfileScreen() {
  const [editing, setEditing] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [hearted, setHearted] = useState(false);
  return (
    <PhoneFrame>
      <PhoneStatus />
      <div style={{ height: 43, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${hairline}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: ink }}><ArrowLeft size={16} /><span style={{ fontFamily: "Georgia,serif", fontSize: 17 }}>My field notes</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: muted }}><Share2 size={15} /><QrCode size={15} /><Settings2 size={15} /></div>
      </div>
      <div style={{ height: "calc(100% - 68px)", overflow: "hidden", position: "relative" }}>
        <div style={{ padding: "17px 18px 86px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ color: green, textTransform: "uppercase", fontSize: 8, fontWeight: 800, letterSpacing: "1.6px" }}>A PERSON OF THIS PLACE</div>
            <button onClick={() => setEditing(!editing)} style={{ border: 0, borderBottom: `1px solid ${green}`, background: "transparent", color: green, padding: "3px 0", fontSize: 9, fontWeight: 750, cursor: "pointer" }}>{editing ? "Save profile" : "Edit profile"}</button>
          </div>
          <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(140deg,#d8e5d1 0 44%,#a9c4a5 44% 70%,#d8be97 70%)", border: "3px solid #f0eee2", display: "grid", placeItems: "center", position: "relative", color: ink, fontFamily: "Georgia,serif", fontSize: 24, boxShadow: "0 0 0 1px #b8cbb8" }}>
              AM<div style={{ position: "absolute", right: -4, bottom: -2, width: 21, height: 21, borderRadius: "50%", background: paper, display: "grid", placeItems: "center", color: green, border: `1px solid ${hairline}` }}><Check size={12} /></div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}><h2 style={{ margin: 0, fontFamily: "Georgia,serif", fontWeight: 500, fontSize: 24, letterSpacing: "-.7px", color: ink }}>Alex Morgan</h2><ShieldCheck size={14} color={green} /></div>
              <div style={{ color: muted, fontSize: 9, marginTop: 3 }}>East Village, New York</div>
              <div style={{ color: "#927441", fontSize: 8, marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}><Award size={11} /> Met Pioneer · trusted member</div>
            </div>
          </div>
          <p style={{ color: "#51665a", fontFamily: "Georgia,serif", fontSize: 13, lineHeight: 1.4, margin: "14px 0 14px" }}>Coffee walks, live music, and getting to know my city one good corner at a time.</p>
          <div style={{ height: 142, position: "relative", overflow: "hidden", margin: "0 -18px", borderTop: "1px solid #d6e1d3", borderBottom: "1px solid #d6e1d3" }}>
            <MapArtwork profile />
            <div style={{ position: "absolute", top: 13, left: 18, background: "rgba(251,250,244,.9)", padding: "5px 7px", color: green, fontSize: 8, fontWeight: 750, letterSpacing: ".5px" }}>MY NEIGHBORHOOD</div>
            <div style={{ position: "absolute", bottom: 11, right: 13, background: paper, padding: "6px 8px", display: "flex", alignItems: "center", gap: 5, color: ink, fontSize: 8, boxShadow: "0 2px 8px #183b2a1b" }}><MapPin size={11} color={green} /> Favorite corner</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 13, marginBottom: 7 }}>
            <div><div style={{ color: green, fontSize: 8, fontWeight: 800, letterSpacing: "1.4px" }}>COLLECTED ALONG THE WAY</div><div style={{ color: ink, fontFamily: "Georgia,serif", fontSize: 19, marginTop: 2 }}>Photos from here</div></div>
            <span style={{ color: muted, fontSize: 8 }}>3 moments</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[
              ["#d9e5d2", "Sunroom, 9am", "MAIN"],
              ["#ced9da", "Sunday market", ""],
              ["#e8d8b7", "After the show", ""],
            ].map(([color, label, badge]) => <div key={label} style={{ height: 86, background: color, position: "relative", display: "flex", alignItems: "end", padding: 6, boxSizing: "border-box", overflow: "hidden" }}>
              <div style={{ position: "absolute", width: 70, height: 70, borderRadius: 70, background: "#fff8", top: -27, right: -20 }} />
              <span style={{ position: "relative", fontSize: 7, color: ink, fontWeight: 700 }}>{label}</span>
              {badge && <span style={{ position: "absolute", top: 5, left: 5, background: green, color: "white", fontSize: 6, padding: "3px 5px", letterSpacing: ".5px" }}>{badge}</span>}
            </div>)}
          </div>
          <div style={{ margin: "13px 0", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: `1px solid ${hairline}`, borderBottom: `1px solid ${hairline}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Camera size={14} color={green} /><span style={{ color: ink, fontSize: 9 }}>Photo verified</span><Check size={11} color={green} /></div>
            <span style={{ color: muted, fontSize: 8 }}>Identity confirmed</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 0 5px" }}>
            <div><div style={{ color: green, fontSize: 8, fontWeight: 800, letterSpacing: "1.4px" }}>NEIGHBORHOOD NOTES</div><div style={{ color: ink, fontFamily: "Georgia,serif", fontSize: 19, marginTop: 2 }}>What I’m into</div></div>
            <button onClick={() => setIsPublic(!isPublic)} aria-label="Toggle rewards visibility" style={{ border: 0, background: "transparent", color: muted, display: "flex", alignItems: "center", gap: 4, fontSize: 8, cursor: "pointer" }}><span>{isPublic ? "Public" : "Private"}</span><span style={{ width: 25, height: 14, borderRadius: 9, background: isPublic ? green : "#bdc8bd", display: "flex", justifyContent: isPublic ? "flex-end" : "flex-start", padding: 2, boxSizing: "border-box" }}><i style={{ width: 10, height: 10, borderRadius: 9, background: "#fff" }} /></span></button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 13px" }}>
            {["Coffee", "Photography", "Live music", "Walking"].map((item) => <span key={item} style={{ padding: "5px 8px", border: "1px solid #cbdacb", borderRadius: 99, color: ink, fontSize: 8, background: "#f3f5eb" }}>{item}</span>)}
          </div>
          <div style={{ borderTop: `1px solid ${hairline}`, padding: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Instagram size={15} color="#a35f51" /><span style={{ color: ink, fontSize: 9 }}>Instagram</span><span style={{ color: muted, fontSize: 8 }}>@alexmorgan</span></div><ArrowUpRight size={13} color={muted} />
          </div>
          <div style={{ margin: "4px 0", padding: "11px 0", borderTop: `1px solid ${hairline}`, borderBottom: `1px solid ${hairline}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Award size={16} color="#a6813d" /><div><div style={{ color: ink, fontSize: 9, fontWeight: 750 }}>Sunroom regular</div><div style={{ color: muted, fontSize: 8, marginTop: 2 }}>East Village · community favorite</div></div></div><span style={{ color: "#a6813d", fontSize: 7, letterSpacing: ".8px" }}>REWARD</span>
          </div>
          <div style={{ padding: "12px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div><div style={{ color: green, fontSize: 8, fontWeight: 800, letterSpacing: "1.3px" }}>GOOD COMPANY</div><div style={{ color: ink, fontFamily: "Georgia,serif", fontSize: 18, marginTop: 3 }}>Places I return to</div></div><button onClick={() => setHearted(!hearted)} aria-label="Save profile" style={{ background: "transparent", color: hearted ? "#a55d4c" : muted, border: 0, cursor: "pointer" }}><Heart size={17} fill={hearted ? "#a55d4c" : "none"} /></button>
          </div>
          {["The Sunroom Café · East Village", "Cypress Books · SoHo"].map((place, i) => <div key={place} style={{ padding: "8px 0", borderTop: `1px solid ${hairline}`, display: "flex", justifyContent: "space-between", alignItems: "center", color: ink, fontSize: 9 }}><span><MapPin size={11} color={i ? "#6c8b77" : green} style={{ verticalAlign: "middle", marginRight: 6 }} />{place}</span><ChevronRight size={13} color={muted} /></div>)}
          <div style={{ marginTop: 12, background: "#e9efe3", padding: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ color: ink, fontSize: 9, fontWeight: 750 }}>Share your neighborhood card</div><div style={{ color: muted, fontSize: 8, marginTop: 3 }}>A little introduction, wherever you go.</div></div><Share2 size={15} color={green} /></div>
          {editing && <div style={{ marginTop: 10, color: muted, fontSize: 8, textAlign: "center" }}>Concept preview · changes are not saved</div>}
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 48, background: "rgba(251,250,244,.96)", borderTop: `1px solid ${hairline}`, display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          {[["Home", <Compass size={16} />], ["Connections", <Users size={16} />], ["Networks", <Globe2 size={16} />], ["Profile", <span style={{ fontSize: 15 }}>A</span>]].map(([label, icon]) => <div key={String(label)} style={{ minWidth: 55, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 7, color: label === "Profile" ? green : muted }}>{icon}<span>{label}</span></div>)}
        </div>
      </div>
    </PhoneFrame>
  );
}

export function NeighborhoodAtlas() {
  return (
    <main style={{ width: 1080, height: 1000, boxSizing: "border-box", overflow: "hidden", padding: "24px 42px", color: ink, background: "radial-gradient(ellipse at 50% -20%, rgba(118,164,117,.15), transparent 54%), #f3f3e9", fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes atlas-rise { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        .atlas-screen { animation: atlas-rise .55s ease-out both; }
        .atlas-screen:nth-child(2) { animation-delay: .12s; }
      `}</style>
      <header style={{ width: 760, margin: "0 auto 16px", display: "flex", justifyContent: "space-between", alignItems: "end" }}>
        <div>
          <div style={{ color: green, fontSize: 9, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase" }}>Met · visual exploration 03</div>
          <h1 style={{ margin: "3px 0 0", fontFamily: "Georgia,serif", fontSize: 30, fontWeight: 400, letterSpacing: "-1.1px", color: ink }}>Neighborhood Atlas</h1>
        </div>
        <div style={{ color: muted, fontSize: 10, textAlign: "right", lineHeight: 1.5 }}>A place-led view of<br />Home + Profile</div>
      </header>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 30 }}>
        <section className="atlas-screen" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 342, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><h2 style={{ margin: 0, fontSize: 13, fontWeight: 750, color: ink }}>Home</h2><span style={{ color: muted, fontSize: 9 }}>The neighborhood, liveable</span></div>
          <HomeScreen />
        </section>
        <section className="atlas-screen" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 342, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><h2 style={{ margin: 0, fontSize: 13, fontWeight: 750, color: ink }}>Profile</h2><span style={{ color: muted, fontSize: 9 }}>A person rooted in place</span></div>
          <ProfileScreen />
        </section>
      </div>
      <footer style={{ width: 760, margin: "14px auto 0", paddingTop: 9, borderTop: "1px solid #dbe4d8", display: "flex", justifyContent: "space-between", color: muted, fontSize: 8 }}>
        <span>MAP-LED DISCOVERY · OPEN TYPOGRAPHY · PRIVATE BY DEFAULT</span>
        <span>Static visual concept · sample content only</span>
      </footer>
    </main>
  );
}
