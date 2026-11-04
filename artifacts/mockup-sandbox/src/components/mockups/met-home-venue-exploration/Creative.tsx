import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Award,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Coffee,
  Eye,
  EyeOff,
  Heart,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Pin,
  Star,
  Users,
} from "lucide-react";

const C = {
  paper: "#F4F0E5",
  paper2: "#FAF8F1",
  ink: "#27352D",
  muted: "#747C6D",
  line: "#D9D5C8",
  green: "#365B45",
  green2: "#DDE8D8",
  orange: "#C45D3C",
  orangePale: "#F3E1D5",
  blue: "#466D79",
  bluePale: "#DDE8E7",
  dark: "#23372E",
  white: "#FFFEFA",
};

function IconButton({
  children,
  onClick,
  label,
  style,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  style?: CSSProperties;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        border: `1px solid ${C.line}`,
        background: C.paper2,
        color: C.ink,
        width: 34,
        height: 34,
        borderRadius: 50,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SectionTitle({
  overline,
  title,
  right,
}: {
  overline?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", marginBottom: 10 }}>
      <div>
        {overline && <div style={eyebrow}>{overline}</div>}
        <div style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 21, lineHeight: 1.12, color: C.ink }}>{title}</div>
      </div>
      {right}
    </div>
  );
}

function MapSketch() {
  return (
    <div style={{ height: 164, position: "relative", overflow: "hidden", background: "#E7E9D9", borderRadius: 15, border: "1px solid #D6D8C6" }}>
      <svg viewBox="0 0 340 164" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <path d="M0 40 C70 57 99 27 155 45 S260 68 340 43" fill="none" stroke="#F9F7EB" strokeWidth="13" />
        <path d="M42 0 C52 36 67 75 51 164" fill="none" stroke="#FAF8EE" strokeWidth="10" />
        <path d="M224 0 C201 48 241 98 215 164" fill="none" stroke="#FAF8EE" strokeWidth="9" />
        <path d="M0 119 C78 104 136 120 194 104 S287 99 340 115" fill="none" stroke="#FBF9F1" strokeWidth="9" />
        <path d="M85 5 L93 28 L83 45 L98 67 L85 84 L99 104 L88 126 L104 158" fill="none" stroke="#C6A980" strokeDasharray="3 5" strokeWidth="2" />
        <path d="M118 68 C146 52 173 59 183 81 C195 107 226 110 256 94" fill="none" stroke={C.orange} strokeWidth="2.5" strokeDasharray="5 5" />
        <path d="M276 7 C297 17 313 28 326 43 L340 47 V0 H270Z" fill="#D7E1CE" opacity=".8" />
        <path d="M0 145 C23 137 39 140 57 164 H0Z" fill="#D7E1CE" opacity=".85" />
        {[{ x: 124, y: 66, r: 18 }, { x: 178, y: 80, r: 24 }, { x: 249, y: 95, r: 17 }].map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={p.r} fill={i === 1 ? "#C45D3C" : "#587B60"} opacity=".14" />
            <circle cx={p.x} cy={p.y} r="5" fill={i === 1 ? C.orange : C.green} />
            <circle cx={p.x} cy={p.y} r="2" fill={C.paper2} />
          </g>
        ))}
      </svg>
      <div style={{ position: "absolute", top: 13, left: 12, background: "rgba(250,248,241,.94)", borderRadius: 7, padding: "5px 8px", fontSize: 9, fontWeight: 700, color: C.green, letterSpacing: ".09em" }}>RIVER DISTRICT</div>
      <div style={{ position: "absolute", left: "48%", top: "57%", padding: "4px 7px", background: C.white, borderRadius: 6, fontSize: 9, color: C.ink, boxShadow: "0 2px 7px #243b2d22" }}>Mira House</div>
      <div style={{ position: "absolute", right: 9, bottom: 8, color: C.muted, fontFamily: "Space Mono, monospace", fontSize: 8, background: "rgba(250,248,241,.84)", padding: "4px 6px", borderRadius: 5 }}>AGGREGATE · SAMPLE</div>
    </div>
  );
}

function PhoneShell({
  label,
  caption,
  children,
}: {
  label: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <section style={{ width: 362, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
      <div style={{ width: "100%", display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 3px" }}>
        <span style={{ color: C.ink, fontSize: 14, fontWeight: 700, letterSpacing: ".01em" }}>{label}</span>
        <span style={{ color: C.muted, fontSize: 10, letterSpacing: ".04em" }}>{caption}</span>
      </div>
      <div style={{ width: 362, height: 748, boxSizing: "border-box", border: "1px solid #BFC0B3", background: "#26342C", borderRadius: 32, padding: 6, boxShadow: "0 18px 42px rgba(37,49,39,.17), 0 3px 8px rgba(37,49,39,.08)" }}>
        <div style={{ height: "100%", overflow: "hidden", borderRadius: 26, position: "relative", background: C.paper2 }}>
          <div style={{ height: 22, padding: "5px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between", boxSizing: "border-box", color: C.ink, background: C.paper2, fontSize: 9, fontWeight: 700 }}>
            <span>9:41</span><span style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ letterSpacing: ".08em" }}>●●●</span><span>▰</span></span>
          </div>
          <div className="met-scroll">{children}</div>
          <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", width: 96, height: 4, borderRadius: 10, background: "#27352D", opacity: .8 }} />
        </div>
      </div>
    </section>
  );
}

const eyebrow: CSSProperties = {
  color: C.orange,
  textTransform: "uppercase",
  fontFamily: "Space Mono, monospace",
  letterSpacing: ".12em",
  fontSize: 8,
  fontWeight: 700,
  marginBottom: 4,
};

const bodyText: CSSProperties = { color: C.muted, fontSize: 10, lineHeight: 1.5 };

export function Creative() {
  const [visible, setVisible] = useState(true);
  const [notice, setNotice] = useState("");
  const [rsvp, setRsvp] = useState(false);
  const [saved, setSaved] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const ping = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  return (
    <main style={{ width: 1120, height: 900, boxSizing: "border-box", overflow: "hidden", padding: "19px 32px 21px", background: `radial-gradient(ellipse at 9% 4%, #E4E9D9 0, transparent 27%), radial-gradient(ellipse at 95% 91%, #E9D9C9 0, transparent 24%), ${C.paper}`, color: C.ink, fontFamily: "DM Sans, ui-sans-serif, sans-serif", position: "relative" }}>
      <style>{`
        .met-scroll { height: calc(100% - 22px); overflow-y: auto; scrollbar-width: none; }
        .met-scroll::-webkit-scrollbar { display: none; }
        .met-action { transition: transform .18s ease, background-color .18s ease, opacity .18s ease; }
        .met-action:hover { transform: translateY(-2px); }
        .met-button { transition: transform .16s ease, background-color .16s ease; }
        .met-button:active { transform: scale(.97); }
        @keyframes noteIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <header style={{ maxWidth: 760, margin: "0 auto 12px", display: "flex", alignItems: "end", justifyContent: "space-between" }}>
        <div>
          <div style={{ ...eyebrow, fontSize: 9 }}>MET / NEIGHBORHOOD NOTES · 01</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 13 }}>
            <h1 style={{ margin: 0, fontFamily: "Playfair Display, Georgia, serif", fontWeight: 500, fontSize: 30, letterSpacing: "-.04em", lineHeight: 1.05 }}>A neighborhood, in motion.</h1>
            <span style={{ color: C.muted, fontFamily: "Space Mono, monospace", fontSize: 9 }}>RIVER DISTRICT / TODAY</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, paddingBottom: 2 }}>
          <span style={{ width: 7, height: 7, background: C.orange, borderRadius: 50 }} />
          <span style={{ color: C.muted, fontSize: 10 }}>Two connected moments</span>
        </div>
      </header>

      <div style={{ display: "flex", alignItems: "start", justifyContent: "center", gap: 30 }}>
        <PhoneShell label="01 / Home" caption="notice → discover → meet">
          <div style={{ padding: "10px 15px 23px", display: "flex", flexDirection: "column", gap: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: 9, display: "grid", placeItems: "center", background: C.green, color: C.paper2, fontFamily: "Playfair Display, Georgia, serif", fontSize: 17 }}>m.</div>
                <div>
                  <div style={{ ...eyebrow, marginBottom: 1 }}>TUESDAY · RIVER DISTRICT</div>
                  <div style={{ fontSize: 10, color: C.muted }}>Your local field notes</div>
                </div>
              </div>
              <IconButton label="Notifications" onClick={() => setRequestOpen(!requestOpen)}><Bell size={15} /></IconButton>
            </div>

            <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 28, lineHeight: 1.02, letterSpacing: "-.03em" }}>Good morning,<br />Alex.</div>
                <div style={{ ...bodyText, marginTop: 5 }}>There’s a little life around the corner.</div>
              </div>
                <div aria-hidden="true" style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 38, lineHeight: .8, color: C.orange, transform: "rotate(-8deg)" }}>✳</div>
            </div>

            <div style={{ borderRadius: 13, background: C.dark, color: C.paper2, padding: "10px 11px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: visible ? "#496B50" : "#55635A", display: "grid", placeItems: "center" }}>
                  {visible ? <Eye size={15} /> : <EyeOff size={15} />}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{visible ? "Beacon is on" : "Beacon is off"}</div>
                  <div style={{ fontSize: 9, color: "#D1D7C9" }}>Only nearby guests can find you</div>
                </div>
              </div>
              <button className="met-button" onClick={() => setVisible(!visible)} style={{ border: 0, borderRadius: 20, padding: "6px 10px", background: visible ? "#D8E4CE" : "#F1DCCF", color: C.ink, fontSize: 9, fontWeight: 800, cursor: "pointer" }}>{visible ? "ON" : "OFF"}</button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 9, color: C.green, background: "#E7EBDD", borderRadius: 8, padding: "7px 9px" }}>
              <Check size={12} />
              <span><b>Location + Bluetooth ready</b> · permissions allow nearby discovery</span>
              <ChevronRight size={12} style={{ marginLeft: "auto", flexShrink: 0 }} />
            </div>

            <button onClick={() => { setRequestOpen(!requestOpen); ping("Sample requests opened — no guest identities shown."); }} style={{ border: `1px solid #E6C3AE`, borderRadius: 9, background: "#FAEEE5", padding: "8px 9px", width: "100%", display: "flex", gap: 8, alignItems: "center", textAlign: "left", color: C.ink, cursor: "pointer" }}>
              <div style={{ display: "flex" }}>
                {["#A36A50", "#71856D"].map((color, i) => <span key={color} style={{ width: 19, height: 19, borderRadius: 50, border: "2px solid #FAEEE5", background: color, marginLeft: i ? -6 : 0, display: "grid", placeItems: "center", color: "white", fontSize: 8 }}>{i ? "J" : "T"}</span>)}
              </div>
              <span style={{ fontSize: 9, flex: 1 }}><b>2 hello requests</b> <span style={{ color: C.muted }}>· review before connecting</span></span>
              <ChevronRight size={13} color={C.orange} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 1px" }}>
              <div style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 42, letterSpacing: "-.06em", lineHeight: .8, color: visible ? C.orange : C.muted }}>{visible ? "7" : "—"}</div>
              <div style={{ borderLeft: `1px solid ${C.line}`, paddingLeft: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{visible ? "guests within 500 m" : "You’re not discoverable"}</div>
                <div style={{ ...bodyText, fontSize: 9 }}>Community count · no live guest positions</div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right", fontFamily: "Space Mono, monospace", color: C.muted, fontSize: 8 }}>RANGE<br /><b style={{ color: C.ink, fontSize: 10 }}>500 m</b></div>
            </div>

            <section>
              <SectionTitle overline="A map, not a pin-drop" title="Around the bend" right={<button onClick={() => ping("Map is a sample neighborhood view.")} style={{ border: 0, background: "transparent", color: C.green, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>Explore map ↗</button>} />
              <MapSketch />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 1px 0", color: C.muted, fontSize: 8 }}>
                <span>Shaded circles show grouped venue activity</span><span>Sample map</span>
              </div>
            </section>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="met-button" onClick={() => ping("Demo check-in: scan a venue code in the real app.")} style={{ flex: 1, background: C.orange, color: C.white, border: 0, borderRadius: 10, padding: "10px 9px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontWeight: 700, fontSize: 10, cursor: "pointer" }}><MapPin size={14} /> Check in</button>
              <button className="met-button" onClick={() => ping("Sample leaderboard · River District")} style={{ flex: 1, background: C.green2, color: C.ink, border: `1px solid #C8D5C6`, borderRadius: 10, padding: "10px 9px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontWeight: 700, fontSize: 10, cursor: "pointer" }}><Award size={14} /> Leaderboard</button>
            </div>

            <div style={{ background: "#E8E4D7", borderRadius: 12, padding: "10px 11px" }}>
              <SectionTitle overline="GOOD PLACES, CLOSE BY" title="A reason to step out" right={<ArrowDownRight size={16} color={C.orange} />} />
              <button className="met-action" onClick={() => ping("Mira House Coffee · venue preview")} style={{ width: "100%", display: "flex", gap: 9, alignItems: "center", border: 0, background: C.paper2, borderRadius: 9, padding: 6, textAlign: "left", cursor: "pointer" }}>
                <img src="/__mockup/images/coffee-shop.png" alt="Neighbors sharing coffee at Mira House" style={{ width: 56, height: 48, borderRadius: 7, objectFit: "cover" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 15, color: C.ink }}>Mira House Coffee</div>
                  <div style={{ fontSize: 8, color: C.muted }}>Coffee & bakery · River District</div>
                </div>
                <span style={{ color: C.orange, fontSize: 9, fontWeight: 700 }}>86<br /><span style={{ fontSize: 7, color: C.muted }}>this week</span></span>
                <ChevronRight size={13} />
              </button>
            </div>

            <div style={{ borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "9px 1px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><div style={eyebrow}>YOUR WEEK · SAMPLE COUNTS</div><div style={{ fontSize: 10, fontWeight: 700 }}>The neighborhood is getting familiar.</div></div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ textAlign: "center" }}><b style={{ color: C.orange, fontFamily: "Playfair Display, Georgia, serif", fontSize: 19 }}>4</b><div style={{ fontSize: 8, color: C.muted }}>new</div></div>
                <div style={{ textAlign: "center" }}><b style={{ color: C.green, fontFamily: "Playfair Display, Georgia, serif", fontSize: 19 }}>3</b><div style={{ fontSize: 8, color: C.muted }}>again</div></div>
              </div>
            </div>

            <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 11, padding: "10px 11px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 23, height: 23, borderRadius: 50, display: "grid", placeItems: "center", background: C.orangePale, color: C.orange }}><MessageCircle size={12} /></div>
                <div style={{ flex: 1 }}><div style={eyebrow}>FROM THE COMMUNITY · SAMPLE</div><div style={{ fontSize: 10, fontWeight: 700 }}>The river path is bright after the rain.</div></div>
                <span style={{ color: C.muted, fontSize: 8 }}>2h</span>
              </div>
              <div style={{ margin: "7px 0 0 31px", ...bodyText, fontSize: 9 }}>A shared note from a nearby venue guest. Names and precise locations stay private.</div>
            </div>
          </div>
        </PhoneShell>

        <div style={{ alignSelf: "center", height: 440, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 12, color: C.orange, marginTop: 24 }}>
          <div style={{ height: 102, width: 1, background: `linear-gradient(transparent, ${C.orange}, transparent)` }} />
          <ArrowUpRight size={17} />
          <span style={{ writingMode: "vertical-rl", fontFamily: "Space Mono, monospace", fontSize: 8, letterSpacing: ".16em" }}>FROM NEARBY TO YOUR NEXT REGULAR</span>
          <div style={{ height: 102, width: 1, background: `linear-gradient(transparent, ${C.orange}, transparent)` }} />
        </div>

        <PhoneShell label="02 / Public venue" caption="Mira House Coffee · sample profile">
          <div style={{ paddingBottom: 24 }}>
            <div style={{ height: 154, position: "relative", overflow: "hidden" }}>
              <img src="/__mockup/images/coffee-shop.png" alt="Warm neighborhood coffee shop with guests sharing a table" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 48%" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(21,31,25,.02) 30%, rgba(21,31,25,.78) 100%)" }} />
              <div style={{ position: "absolute", top: 10, left: 12, right: 12, display: "flex", justifyContent: "space-between" }}>
                <IconButton label="Back to home" onClick={() => ping("Back to neighborhood notes")} style={{ background: "rgba(255,254,250,.93)", borderColor: "transparent" }}><ArrowLeft size={15} /></IconButton>
                <IconButton label={saved ? "Remove saved venue" : "Save venue"} onClick={() => setSaved(!saved)} style={{ background: "rgba(255,254,250,.93)", borderColor: "transparent", color: saved ? C.orange : C.ink }}>{saved ? <Heart size={15} fill={C.orange} /> : <Bookmark size={15} />}</IconButton>
              </div>
              <div style={{ position: "absolute", left: 14, bottom: 12, color: C.white }}>
                <div style={{ fontFamily: "Space Mono, monospace", fontSize: 8, letterSpacing: ".14em", opacity: .82 }}>A RIVER DISTRICT PLACE</div>
                <div style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 28, lineHeight: 1.1, letterSpacing: "-.02em" }}>Mira House Coffee</div>
              </div>
              <div style={{ position: "absolute", right: 12, bottom: 14, background: C.paper2, color: C.ink, borderRadius: 8, padding: "5px 7px", display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700 }}><Star size={12} fill={C.orange} color={C.orange} /> 4.9 <span style={{ fontWeight: 400, color: C.muted }}>(128)</span></div>
            </div>

            <div style={{ padding: "12px 15px 0", display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.green }}>Coffee & bakery <span style={{ color: C.muted, fontWeight: 400 }}>· Independent</span></div>
                  <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>River District · Sample public profile</div>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <IconButton label="Call venue" onClick={() => ping("Sample contact: (415) 555-0148")}><Phone size={13} /></IconButton>
                  <IconButton label="Directions" onClick={() => ping("Sample address: 28 Willow Lane")}><Navigation size={13} /></IconButton>
                </div>
              </div>

              <div style={{ display: "flex", gap: 7 }}>
                <button className="met-button" onClick={() => ping("Demo check-in: this preview does not record visits.")} style={{ flex: 1, border: 0, borderRadius: 9, background: C.orange, color: C.white, padding: "9px 6px", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><MapPin size={13} /> Check in</button>
                <button className="met-button" onClick={() => ping("Sample Mira House leaderboard")} style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 9, background: C.paper, color: C.ink, padding: "9px 6px", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Award size={13} /> Leaderboard</button>
              </div>

              <div style={{ background: "#E5EBDD", borderRadius: 11, padding: "10px 11px", display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 32, height: 32, borderRadius: 50, display: "grid", placeItems: "center", background: C.green, color: C.paper2 }}><Coffee size={16} /></div>
                <div style={{ flex: 1 }}>
                  <div style={eyebrow}>A LITTLE THANK-YOU · ACTIVE</div>
                  <div style={{ fontFamily: "Playfair Display, Georgia, serif", color: C.ink, fontSize: 15 }}>Mira House regular</div>
                  <div style={{ fontSize: 9, color: C.muted }}>Coffee and pastry for two</div>
                </div>
                <ChevronRight size={15} color={C.green} />
              </div>

              <div style={{ border: `1px solid #E9C8B5`, background: "#FBF2E9", borderRadius: 10, padding: "9px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...eyebrow }}><Pin size={10} fill={C.orange} /> PINNED NOTE FROM THE TEAM</div>
                <div style={{ color: C.ink, fontFamily: "Playfair Display, Georgia, serif", fontSize: 15, margin: "3px 0" }}>The community table is open all weekend.</div>
                <div style={{ ...bodyText, fontSize: 9 }}>Come say hello. There’s always room for one more.</div>
              </div>

              <section>
                <SectionTitle overline="REGULARS BOARD · THIS MONTH" title="Familiar faces" right={<button onClick={() => ping("Sample local leaderboard")} style={{ color: C.green, border: 0, background: "transparent", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>All ranks ↗</button>} />
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { place: "01", name: "Taylor M.", n: "12 visits", tint: "#E9D9B5" },
                    { place: "02", name: "Jordan E.", n: "9 visits", tint: "#D9E2D3" },
                    { place: "03", name: "Alex H.", n: "7 visits", tint: "#EED9CA" },
                  ].map((person) => (
                    <div key={person.place} style={{ flex: 1, borderRadius: 9, background: person.tint, padding: "7px 5px", textAlign: "center" }}>
                      <div style={{ color: C.orange, fontFamily: "Space Mono, monospace", fontSize: 8 }}>{person.place}</div>
                      <div style={{ width: 24, height: 24, margin: "3px auto", borderRadius: 50, display: "grid", placeItems: "center", color: C.ink, background: "rgba(255,254,250,.75)", fontFamily: "Playfair Display, Georgia, serif", fontSize: 11 }}>{person.name.split(" ").map((p) => p[0]).join("")}</div>
                      <div style={{ color: C.ink, fontSize: 9, fontWeight: 700 }}>{person.name}</div>
                      <div style={{ color: C.muted, fontSize: 8 }}>{person.n}</div>
                    </div>
                  ))}
                </div>
                <div style={{ ...bodyText, fontSize: 8, marginTop: 5 }}>Illustrative leaderboard names and counts.</div>
              </section>

              <section>
                <SectionTitle overline="PUT IT IN THE DIARY" title="Coming up" right={<CalendarDays size={15} color={C.orange} />} />
                <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 10px", display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 38, borderRight: `1px solid ${C.line}`, paddingRight: 7, textAlign: "center", color: C.orange }}>
                    <div style={{ fontFamily: "Space Mono, monospace", fontSize: 8, fontWeight: 700 }}>SAT</div>
                    <div style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 17, lineHeight: 1.1 }}>+3d</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.ink, fontFamily: "Playfair Display, Georgia, serif", fontSize: 14 }}>Vinyl & Slow Pour</div>
                    <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 3, color: C.muted, fontSize: 8 }}><Clock3 size={10} /> 10:00 am <Users size={10} /> 31 going</div>
                  </div>
                  <button className="met-button" onClick={() => { setRsvp(!rsvp); ping(rsvp ? "Sample RSVP removed." : "You’re on the sample RSVP list."); }} style={{ border: 0, background: rsvp ? C.green2 : C.green, color: rsvp ? C.green : C.white, borderRadius: 7, padding: "7px 8px", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>{rsvp ? "Going ✓" : "RSVP"}</button>
                </div>
                <div style={{ display: "flex", gap: 7, alignItems: "center", padding: "7px 2px 0", color: C.muted, fontSize: 9 }}><span style={{ width: 5, height: 5, borderRadius: 50, background: C.orange }} /> Meet the Makers Morning · next week <ChevronRight size={11} /></div>
              </section>

              <section style={{ borderTop: `1px solid ${C.line}`, paddingTop: 9 }}>
                <SectionTitle overline="GUESTBOOK" title="Notes left at the table" right={<span style={{ color: C.orange, fontSize: 9, fontWeight: 700 }}>4.9 ★</span>} />
                {[
                  ["T.M.", "A lovely place to slow down and meet the neighborhood.", "2 days ago"],
                  ["J.E.", "Great coffee and a warm welcome every time.", "5 days ago"],
                ].map(([initials, review, when]) => (
                  <div key={initials} style={{ display: "flex", gap: 8, borderTop: `1px solid ${C.line}`, padding: "8px 0 2px" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 50, display: "grid", placeItems: "center", background: C.bluePale, color: C.blue, fontSize: 8, fontWeight: 700 }}>{initials}</div>
                    <div style={{ flex: 1 }}><div style={{ color: C.orange, letterSpacing: ".06em", fontSize: 8 }}>★★★★★</div><div style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 12, color: C.ink, lineHeight: 1.3 }}>{review}</div><div style={{ color: C.muted, fontSize: 8, marginTop: 3 }}>Sample guest · {when}</div></div>
                  </div>
                ))}
              </section>

              <section style={{ borderTop: `1px solid ${C.line}`, paddingTop: 9 }}>
                <SectionTitle overline="PLAN A VISIT" title="Good to know" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  <div style={{ background: "#ECE9DE", borderRadius: 8, padding: "8px" }}><div style={{ fontSize: 9, fontWeight: 700, color: C.ink }}>Open today · 7 am–6 pm</div><div style={{ color: C.muted, fontSize: 8, marginTop: 3 }}>Thu–Fri until 8 pm</div></div>
                  <div style={{ background: "#ECE9DE", borderRadius: 8, padding: "8px" }}><div style={{ fontSize: 9, fontWeight: 700, color: C.ink }}>28 Willow Lane</div><div style={{ color: C.muted, fontSize: 8, marginTop: 3 }}>(415) 555-0148 · sample</div></div>
                </div>
                <div style={{ ...bodyText, fontSize: 9, marginTop: 7 }}>A neighborhood coffee counter for thoughtful cups, fresh pastry, and the conversations that happen when you stay a little longer.</div>
              </section>
            </div>
          </div>
        </PhoneShell>
      </div>

      <div style={{ position: "absolute", left: 35, bottom: 13, color: "#818477", fontFamily: "Space Mono, monospace", fontSize: 8, letterSpacing: ".08em" }}>CREATIVE STUDY / SOURCE-BASED / ALL PEOPLE + COUNTS SHOWN ARE ILLUSTRATIVE</div>
      {requestOpen && <div style={{ position: "absolute", top: 138, left: 265, width: 216, zIndex: 5, padding: 12, borderRadius: 12, background: C.dark, color: C.paper2, boxShadow: "0 12px 34px #20332738", animation: "noteIn .2s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontWeight: 700 }}><span>Two hello requests</span><button onClick={() => setRequestOpen(false)} style={{ border: 0, background: "transparent", color: C.paper2, cursor: "pointer", fontSize: 14 }}>×</button></div>
        <div style={{ color: "#D5DDCF", fontSize: 9, lineHeight: 1.45, marginTop: 5 }}>Sample requests are private until you choose to connect. No profile or live position is exposed here.</div>
        <button onClick={() => { setRequestOpen(false); ping("Request review dismissed for this demo."); }} style={{ marginTop: 8, border: 0, background: "#DDE8D8", color: C.ink, fontSize: 9, fontWeight: 700, padding: "6px 8px", borderRadius: 6, cursor: "pointer" }}>Review requests</button>
      </div>}
      {notice && <div role="status" style={{ position: "absolute", bottom: 25, left: "50%", transform: "translateX(-50%)", borderRadius: 30, padding: "9px 15px", color: C.paper2, background: C.dark, fontSize: 11, boxShadow: "0 5px 18px #20332733", animation: "noteIn .2s ease-out", whiteSpace: "nowrap" }}>{notice}</div>}
    </main>
  );
}
