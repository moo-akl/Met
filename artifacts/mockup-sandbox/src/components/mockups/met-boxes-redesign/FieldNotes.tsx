import { useState, type ReactNode } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  Bookmark,
  Camera,
  Check,
  ChevronRight,
  Coffee,
  Compass,
  Gift,
  Globe2,
  Heart,
  Instagram,
  MapPin,
  MessageCircle,
  QrCode,
  Settings,
  Shield,
  Share2,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";

const ink = "#203a2b";
const muted = "#728276";
const green = "#2d7148";
const softGreen = "#e9f1e8";
const paper = "#faf9f2";
const line = "#dce3d8";

function TinyLabel({ children }: { children: ReactNode }) {
  return <div style={{ color: muted, fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase" }}>{children}</div>;
}

function PhoneFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section style={{ width: 354, display: "flex", flexDirection: "column", gap: 9, alignItems: "center" }}>
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 7px" }}>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: 19, fontWeight: 400, margin: 0, color: ink }}>{label}</h2>
        <span style={{ color: muted, fontSize: 9, letterSpacing: ".04em" }}>FIELD NOTES / 01</span>
      </div>
      <div style={{ width: 350, height: 760, padding: 5, overflow: "hidden", borderRadius: 34, background: "#1e3025", boxShadow: "0 24px 55px rgba(43,65,46,.18)", border: "1px solid rgba(32,58,43,.23)" }}>
        <div style={{ height: "100%", borderRadius: 29, overflowY: "auto", background: paper, color: ink, scrollbarWidth: "none" }}>{children}</div>
      </div>
    </section>
  );
}

function MapArtwork() {
  return (
    <div style={{ height: 182, position: "relative", overflow: "hidden", background: "#e6efea", borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}` }}>
      <svg viewBox="0 0 340 182" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-label="Stylized geographical map of Manhattan and Brooklyn">
        <rect width="340" height="182" fill="#e4efed" />
        <path d="M0 0h132l42 182H0z" fill="#eee8d9" />
        <path d="M218 0h122v182H213l-32-182z" fill="#efe9dc" />
        <path d="M135 0h82l34 182h-75z" fill="#dcebe7" />
        <path d="M145 -10 178 194M162 -10 195 194M230 -10 203 194M0 31h340M0 74h340M0 119h340M0 158h340" fill="none" stroke="#fffdf6" strokeWidth="5" />
        <path d="M107 0l46 182M248 0l-20 182M47 0l42 182" fill="none" stroke="#d4cbb7" strokeWidth="1.4" />
        <path d="M183 3c-11 8-14 17-10 29 3 9 15 12 20 23 5 12 1 21 7 32 9-8 17-13 19-26 2-13-8-22-8-34 0-9-10-18-28-24z" fill="#b9ceb5" />
        <path d="M162 88c10 5 14 15 12 25-2 10-9 13-11 22" stroke="#c4bba7" strokeWidth="2" fill="none" />
        <text x="25" y="20" fontSize="8" fill="#6c8276" fontFamily="sans-serif" letterSpacing="1.4">MANHATTAN</text>
        <text x="251" y="153" fontSize="8" fill="#6c8276" fontFamily="sans-serif" letterSpacing="1.4">BROOKLYN</text>
        <text x="20" y="100" fontSize="7" fill="#78918a" fontFamily="sans-serif" letterSpacing="1.2">HUDSON RIVER</text>
        <circle cx="147" cy="102" r="14" fill="#2d7148" opacity=".13" />
        <path d="M147 91c-6 0-10 4-10 10 0 8 10 17 10 17s10-9 10-17c0-6-4-10-10-10z" fill="#2d7148" stroke="#fffdf6" strokeWidth="2" />
        <circle cx="147" cy="101" r="3" fill="#fffdf6" />
        <circle cx="245" cy="68" r="5" fill="#d49466" stroke="#fffdf6" strokeWidth="2" />
        <circle cx="85" cy="130" r="5" fill="#c3a15e" stroke="#fffdf6" strokeWidth="2" />
      </svg>
      <div style={{ position: "absolute", top: 11, right: 11, padding: "8px 10px", display: "flex", gap: 6, alignItems: "center", background: "rgba(250,249,242,.94)", borderRadius: 6, color: ink, fontSize: 10, fontWeight: 650 }}>
        <Compass size={13} /> Explore map
      </div>
      <div style={{ position: "absolute", left: 10, bottom: 9, display: "flex", alignItems: "center", gap: 5, fontSize: 8, color: "#526b5b", background: "rgba(250,249,242,.95)", padding: "6px 8px", borderRadius: 3 }}>
        <Shield size={11} /> Venue activity only · guest pins are never shown
      </div>
    </div>
  );
}

function BottomNav({ active }: { active: string }) {
  const items = [
    { name: "Home", icon: Compass },
    { name: "People", icon: MessageCircle },
    { name: "Places", icon: Globe2 },
    { name: "Profile", icon: Users },
  ];
  return (
    <div style={{ position: "sticky", bottom: 0, zIndex: 3, display: "flex", justifyContent: "space-around", padding: "9px 6px 10px", borderTop: `1px solid ${line}`, background: "rgba(250,249,242,.97)" }}>
      {items.map(({ name, icon: Icon }) => <div key={name} style={{ minWidth: 52, textAlign: "center", color: active === name ? green : muted, fontSize: 8, fontWeight: active === name ? 700 : 500 }}><Icon size={17} strokeWidth={active === name ? 2.2 : 1.7} /><div style={{ marginTop: 2 }}>{name}</div></div>)}
    </div>
  );
}

function HomeScreen() {
  return (
    <PhoneFrame label="01 / Nearby">
      <div style={{ padding: "18px 18px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}><div style={{ width: 25, height: 25, background: green, color: paper, borderRadius: 7, fontSize: 15, fontWeight: 800, display: "grid", placeItems: "center" }}>M</div><span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.06em" }}>met</span></div>
          <div style={{ display: "flex", gap: 14, color: ink }}><Globe2 size={17} /><Users size={17} /></div>
        </div>
        <div style={{ marginTop: 23, display: "flex", justifyContent: "space-between", alignItems: "end" }}>
          <div><TinyLabel>New York City · Tuesday</TinyLabel><h3 style={{ fontFamily: "Georgia, serif", fontSize: 27, lineHeight: 1.05, letterSpacing: "-.04em", fontWeight: 400, margin: "8px 0 5px" }}>A little closer<br />to your world.</h3><div style={{ fontSize: 10, color: muted }}>A good day to find your people.</div></div>
          <div style={{ textAlign: "right", paddingBottom: 3 }}><div style={{ fontFamily: "Georgia, serif", fontSize: 24 }}>18</div><div style={{ fontSize: 8, color: muted, maxWidth: 68 }}>people nearby</div></div>
        </div>
      </div>
      <div style={{ margin: "0 13px 14px", display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", background: "#194f32", color: "#f8f7ee" }}>
        <div style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: "50%", background: "rgba(255,255,255,.12)" }}><Activity size={15} /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 11, fontWeight: 700 }}>Your visibility is on</div><div style={{ fontSize: 8, color: "#d6e3d8", marginTop: 3 }}>Nearby discovery, on your terms.</div></div>
        <div style={{ width: 30, height: 17, borderRadius: 12, background: "#8fb69a", padding: 2, display: "flex", justifyContent: "end" }}><div style={{ width: 13, height: 13, borderRadius: "50%", background: "#fffdf6" }} /></div>
      </div>
      <div style={{ margin: "0 13px", overflow: "hidden" }}><MapArtwork /></div>
      <div style={{ padding: "16px 17px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 9 }}>
          <div><TinyLabel>Worth a wander</TinyLabel><h3 style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 400, margin: "4px 0 0" }}>Around the corner</h3></div>
          <ArrowUpRight size={16} color={green} />
        </div>
        <div style={{ borderTop: `1px solid ${line}` }}>
          <div style={{ padding: "11px 0", display: "flex", gap: 10, alignItems: "center", borderBottom: `1px solid ${line}` }}>
            <div style={{ width: 37, height: 37, display: "grid", placeItems: "center", color: "#8a6346", background: "#f1e8d8", borderRadius: 50 }}><Coffee size={17} /></div>
            <div style={{ flex: 1 }}><div style={{ fontFamily: "Georgia,serif", fontSize: 14 }}>The Sunroom Café</div><div style={{ fontSize: 8, color: muted, marginTop: 3 }}>East Village · Café & garden</div></div>
            <span style={{ color: green, fontSize: 10, fontWeight: 700 }}>128 <span style={{ fontWeight: 400, color: muted }}>this week</span></span>
          </div>
          <div style={{ padding: "10px 0", display: "flex", gap: 9, alignItems: "center", borderBottom: `1px solid ${line}` }}>
            <div style={{ width: 29, height: 29, display: "grid", placeItems: "center", color: "#6b6d92", background: "#e9e8f1", borderRadius: 50 }}><Bookmark size={14} /></div>
            <div style={{ flex: 1 }}><div style={{ fontFamily: "Georgia,serif", fontSize: 12 }}>Juniper Market</div><div style={{ fontSize: 8, color: muted, marginTop: 2 }}>Williamsburg · Local market</div></div>
            <ChevronRight size={15} color={muted} />
          </div>
        </div>
        <div style={{ marginTop: 15, padding: "11px 12px", background: green, color: paper, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}><MapPin size={15} /><div><div style={{ fontSize: 11, fontWeight: 700 }}>Check in at a venue</div><div style={{ fontSize: 8, color: "#dbe8dc", marginTop: 2 }}>Only when you choose to.</div></div></div><ArrowRight size={15} />
        </div>
        <div style={{ paddingTop: 19 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 8 }}><div><TinyLabel>On the calendar</TinyLabel><h3 style={{ fontFamily: "Georgia,serif", fontSize: 19, fontWeight: 400, margin: "4px 0 0" }}>Plans worth keeping</h3></div><ArrowDownRight size={15} color={green} /></div>
          <div style={{ display: "flex", gap: 9, alignItems: "center", padding: "9px 0", borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}` }}>
            <div style={{ textAlign: "center", width: 31, color: green }}><div style={{ fontSize: 8, fontWeight: 700 }}>FRI</div><div style={{ fontFamily: "Georgia,serif", fontSize: 18 }}>14</div></div>
            <div style={{ flex: 1 }}><div style={{ fontFamily: "Georgia,serif", fontSize: 12 }}>Slow Sunday book swap</div><div style={{ fontSize: 8, color: muted, marginTop: 2 }}>The Sunroom Café · 11:00 am</div></div>
            <span style={{ fontSize: 8, color: green, padding: "4px 6px", background: softGreen }}>Going</span>
          </div>
          <div style={{ margin: "13px 0 8px", padding: "10px 0", display: "flex", gap: 8, alignItems: "center", borderBottom: `1px solid ${line}` }}><Users size={16} color={green} /><div style={{ flex: 1 }}><b style={{ fontSize: 10 }}>2 connection requests</b><div style={{ fontSize: 8, color: muted, marginTop: 2 }}>Avery and Jordan would like to meet.</div></div><ChevronRight size={14} color={muted} /></div>
          <div style={{ padding: "9px 0" }}><TinyLabel>This week, in little moments</TinyLabel><div style={{ display: "flex", gap: 20, marginTop: 7 }}><div><strong style={{ fontFamily: "Georgia,serif", fontSize: 20 }}>6</strong><span style={{ marginLeft: 5, fontSize: 9, color: muted }}>new people</span></div><div><strong style={{ fontFamily: "Georgia,serif", fontSize: 20 }}>3</strong><span style={{ marginLeft: 5, fontSize: 9, color: muted }}>crossed again</span></div></div></div>
          <div style={{ borderTop: `1px solid ${line}`, padding: "11px 0 15px", display: "flex", alignItems: "center", gap: 8 }}><Award size={16} color="#a77b38" /><div style={{ flex: 1 }}><b style={{ fontFamily: "Georgia,serif", fontSize: 12 }}>Neighborhood regulars</b><div style={{ fontSize: 8, color: muted, marginTop: 2 }}>See this month’s venue rankings</div></div><ChevronRight size={14} color={muted} /></div>
        </div>
      </div>
      <BottomNav active="Home" />
    </PhoneFrame>
  );
}

function ProfileScreen() {
  const [editing, setEditing] = useState(false);
  return (
    <PhoneFrame label="02 / Profile">
      <div style={{ padding: "16px 17px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 25, height: 25, border: `1px solid ${green}`, borderRadius: "50%", display: "grid", placeItems: "center", color: green, fontSize: 13 }}>M</span><span style={{ fontFamily: "Georgia,serif", fontSize: 17 }}>My profile</span></div>
          <div style={{ display: "flex", gap: 12, color: ink }}><Share2 size={16} /><QrCode size={16} /><Settings size={16} /></div>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center", color: green, fontSize: 9, fontWeight: 700 }}><span style={{ padding: "5px 8px", borderRadius: 18, background: softGreen }}>● &nbsp;VISIBLE</span><span style={{ color: muted, fontWeight: 400 }}>Nearby, by choice</span></div>
      </div>
      <div style={{ padding: "14px 19px 14px", borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}`, textAlign: "center", background: "#f4f4e9" }}>
        <div style={{ width: 83, height: 83, margin: "0 auto 9px", borderRadius: "50%", border: "3px solid #fffdf6", boxShadow: "0 0 0 1px #cbd9c8", background: "radial-gradient(circle at 54% 34%, #e1b49a 0 12%, transparent 13%), radial-gradient(ellipse at 50% 84%, #385447 0 34%, transparent 35%), linear-gradient(135deg,#566552,#d8bd97 48%,#324c40)", display: "grid", placeItems: "center", overflow: "hidden" }}>
          <div style={{ width: 34, height: 51, marginTop: 28, borderRadius: "48% 48% 8px 8px", background: "linear-gradient(90deg,#394e41,#89977b 45%,#334a3b)", opacity: .93 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 5 }}><h3 style={{ fontFamily: "Georgia,serif", fontSize: 23, fontWeight: 400, letterSpacing: "-.03em", margin: 0 }}>Alex Morgan</h3><Check size={14} color={green} /></div>
        <div style={{ marginTop: 5, display: "flex", gap: 4, alignItems: "center", justifyContent: "center", fontSize: 8, color: "#8a6a33", letterSpacing: ".1em", fontWeight: 700 }}><Award size={12} /> MET PIONEER · TRUST 94</div>
        <p style={{ margin: "8px auto 0", maxWidth: 245, fontFamily: "Georgia,serif", fontSize: 12, lineHeight: 1.45, color: "#617064" }}>Coffee walks, live music, and getting to know my city.</p>
        <button onClick={() => setEditing(!editing)} style={{ marginTop: 10, border: `1px solid ${green}`, background: editing ? green : "transparent", color: editing ? paper : green, padding: "6px 12px", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>{editing ? "Save profile · sample" : "Edit profile"}</button>
        {editing && <div style={{ marginTop: 7, display: "flex", justifyContent: "center", gap: 12, fontSize: 8, color: muted }}><span style={{ display: "flex", gap: 3, alignItems: "center" }}><Camera size={10} /> Change photo</span><span style={{ display: "flex", gap: 3, alignItems: "center" }}><X size={10} /> Cancel</span></div>}
      </div>
      <div style={{ padding: "14px 17px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}><TinyLabel>Little windows into my world</TinyLabel><span style={{ fontFamily: "Georgia,serif", fontSize: 12, color: muted }}>03</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 6 }}>
          <div style={{ height: 74, position: "relative", background: "linear-gradient(140deg,#344a3d 0 35%,#d2b58f 36% 60%,#869775 61%)", overflow: "hidden" }}><div style={{ position: "absolute", inset: "17px 24px 0", borderRadius: "50% 50% 5px 5px", background: "linear-gradient(90deg,#384f42,#e0b69a 45%,#394e42)" }} /><span style={{ position: "absolute", bottom: 4, left: 5, fontSize: 7, background: green, color: "white", padding: "3px 5px" }}>MAIN</span></div>
          <div style={{ height: 74, background: "linear-gradient(160deg,#d7e2d9,#73877d 45%,#384b40)" }} />
          <div style={{ height: 74, background: "linear-gradient(140deg,#e2ccae,#c5a275 46%,#5d6c54)" }} />
        </div>
        <div style={{ marginTop: 7, fontSize: 8, color: muted }}>Photo verified · 3 photos in the album</div>
      </div>
      <div style={{ margin: "13px 17px 0", padding: "10px 0", borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}`, display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 27, height: 27, background: "#f4e7e5", color: "#a75a55", display: "grid", placeItems: "center", borderRadius: "50%" }}><Instagram size={14} /></div><div style={{ flex: 1, fontFamily: "Georgia,serif", fontSize: 12 }}>Instagram</div><span style={{ fontSize: 9, color: muted }}>@alexmorgan</span><ArrowUpRight size={13} color={muted} />
      </div>
      <div style={{ padding: "14px 17px 2px" }}>
        <TinyLabel>Things I’m into</TinyLabel>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>{["Coffee", "Photography", "Live music"].map((interest) => <span key={interest} style={{ borderBottom: `1px solid ${green}`, padding: "4px 2px", marginRight: 8, fontFamily: "Georgia,serif", fontSize: 11 }}>{interest}</span>)}</div>
      </div>
      <div style={{ margin: "14px 17px 0", padding: "12px 0", borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><TinyLabel>Rewards collected</TinyLabel><span style={{ fontSize: 8, color: green }}>PUBLIC</span></div>
        <div style={{ display: "flex", gap: 9, alignItems: "center", marginTop: 9 }}>
          <div style={{ width: 35, height: 35, borderRadius: "50%", display: "grid", placeItems: "center", color: "#94723a", background: "#f4ecd8" }}><Award size={17} /></div>
          <div style={{ flex: 1 }}><div style={{ fontFamily: "Georgia,serif", fontSize: 12 }}>East Village regular</div><div style={{ fontSize: 8, color: muted, marginTop: 3 }}>The Sunroom Café · March 2025</div></div><Star size={13} fill="#b48b48" color="#b48b48" />
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", paddingTop: 9, borderTop: `1px solid ${line}` }}><Gift size={14} color={green} /><span style={{ flex: 1, fontSize: 9 }}>Pioneer monthly reward eligible</span><ChevronRight size={13} color={muted} /></div>
      </div>
      <div style={{ padding: "12px 17px 18px", display: "flex", alignItems: "center", gap: 7, color: muted, fontSize: 8 }}><Heart size={12} color={green} /> A familiar face makes a city feel smaller.</div>
      <BottomNav active="Profile" />
    </PhoneFrame>
  );
}

export function FieldNotes() {
  return (
    <main style={{ width: 1080, height: 1000, boxSizing: "border-box", overflow: "hidden", padding: "26px 40px", color: ink, background: "radial-gradient(ellipse at 52% -20%, #edf2e4 0%, transparent 48%), #f3f2e9", fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap'); * { box-sizing: border-box; } button { font-family: inherit; }`}</style>
      <header style={{ width: 760, margin: "0 auto 17px" }}>
        <div style={{ color: green, fontSize: 9, fontWeight: 700, letterSpacing: ".22em", textTransform: "uppercase" }}>Met · visual exploration / 03</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 }}>
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400, fontSize: 30, letterSpacing: "-.04em", margin: 0 }}>Open Field Notes</h1>
          <span style={{ fontSize: 10, color: muted }}>A neighborhood guide, and the person finding their way.</span>
        </div>
      </header>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 34 }}>
        <HomeScreen />
        <ProfileScreen />
      </div>
      <footer style={{ width: 740, margin: "12px auto 0", display: "flex", alignItems: "center", justifyContent: "space-between", color: muted, fontSize: 9 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={12} color={green} /> OPEN SECTIONS · THIN RULES · PLACE-FIRST PRIVACY</span>
        <span>Illustrative screens · sample actions do not persist</span>
      </footer>
    </main>
  );
}
