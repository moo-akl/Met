import {
  Award,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Coffee,
  Compass,
  EyeOff,
  Gift,
  Globe2,
  Heart,
  Home,
  Instagram,
  MapPin,
  MoreHorizontal,
  MoveUpRight,
  QrCode,
  Radio,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

const ink = "#1C3929";
const muted = "#708174";
const green = "#3DCC44";
const paper = "#F7F8F1";
const line = "#DDE7DC";

const iconStyle = { strokeWidth: 1.8 };

function PhoneFrame({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ width: 350, display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 3px" }}>
        <strong style={{ color: ink, fontSize: 15, letterSpacing: "-.02em" }}>{title}</strong>
        <span style={{ color: muted, fontSize: 10 }}>{note}</span>
      </div>
      <div
        style={{
          height: 770,
          boxSizing: "border-box",
          borderRadius: 34,
          padding: 5,
          background: "#193525",
          boxShadow: "0 22px 52px rgba(27,55,36,.18), 0 4px 10px rgba(27,55,36,.09)",
          border: "1px solid rgba(19,49,29,.2)",
        }}
      >
        <div style={{ height: "100%", overflow: "hidden", position: "relative", borderRadius: 29, background: paper }}>
          <div style={{ position: "absolute", zIndex: 10, top: 7, left: "50%", transform: "translateX(-50%)", width: 76, height: 17, borderRadius: 20, background: "#193525" }} />
          {children}
        </div>
      </div>
    </section>
  );
}

function ScreenHeader({ right }: { right: React.ReactNode }) {
  return (
    <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 17px 0", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <div style={{ width: 24, height: 24, borderRadius: 8, background: green, display: "grid", placeItems: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>M</div>
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-.06em", color: ink }}>met</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 13, color: ink }}>{right}</div>
    </div>
  );
}

function BottomNav({ active }: { active: "home" | "profile" }) {
  const items = [
    { name: "Home", icon: Home, key: "home" },
    { name: "Connections", icon: Users, key: "connections" },
    { name: "Networks", icon: Globe2, key: "networks" },
    { name: "Profile", icon: Users, key: "profile" },
  ];
  return (
    <div style={{ position: "absolute", zIndex: 5, bottom: 0, left: 0, right: 0, height: 48, display: "flex", alignItems: "center", justifyContent: "space-around", background: "rgba(249,250,245,.97)", borderTop: `1px solid ${line}` }}>
      {items.map(({ name, icon: Icon, key }) => {
        const selected = active === key;
        return (
          <div key={name} style={{ width: 67, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: selected ? "#258737" : "#748078" }}>
            <Icon size={17} {...iconStyle} />
            <span style={{ fontSize: 9, fontWeight: selected ? 700 : 500, letterSpacing: ".01em" }}>{name}</span>
          </div>
        );
      })}
    </div>
  );
}

function MapArtwork() {
  return (
    <div style={{ height: 168, position: "relative", overflow: "hidden", borderRadius: 18, background: "#E4EEEA", border: "1px solid #C7D9CF" }}>
      <svg viewBox="0 0 320 168" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "100%" }} aria-label="Illustrated New York City street map">
        <rect width="320" height="168" fill="#D9E9E9" />
        <path d="M0 0h102l34 168H0zM245 0h75v168h-96l-19-168z" fill="#EBE6D7" />
        <path d="M104 -10l29 188M121 -10l34 188M260 -10l-25 190M294 -8l-22 185" stroke="#F8F5EA" strokeWidth="12" />
        <path d="M-8 35h350M-8 76h350M-8 119h350M-8 151h350" stroke="#FBFAF1" strokeWidth="5" />
        <path d="M153 -12l15 192M179 -12l16 192M207 -12l17 192" stroke="#F7F5EC" strokeWidth="4" />
        <path d="M160 0l37 16-10 22-27-9-12-15z" fill="#AAC99D" />
        <path d="M163 51l21-6M168 101l17-7" stroke="#C4D3CA" strokeWidth="2" />
        <text x="16" y="20" fill="#5E786A" fontSize="8" fontWeight="700" letterSpacing="1">MANHATTAN</text>
        <text x="246" y="144" fill="#5E786A" fontSize="8" fontWeight="700" letterSpacing="1">BROOKLYN</text>
        <text x="119" y="90" fill="#789187" fontSize="7" fontWeight="700" transform="rotate(80 119 90)">EAST RIVER</text>
        <text x="26" y="114" fill="#87958C" fontSize="7" fontWeight="700" letterSpacing=".8">EAST VILLAGE</text>
        <path d="M73 79h38M72 129h61" stroke="#F4F0E5" strokeWidth="3" />
      </svg>
      <div style={{ position: "absolute", left: "24%", top: "45%", width: 22, height: 22, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", background: "#3DCC44", border: "2px solid #fff", boxShadow: "0 2px 6px #365e4060", display: "grid", placeItems: "center" }}>
        <Coffee size={11} color="#fff" style={{ transform: "rotate(45deg)" }} />
      </div>
      <div style={{ position: "absolute", left: "60%", top: "33%", width: 17, height: 17, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", background: "#E1A95E", border: "2px solid #fff" }} />
      <div style={{ position: "absolute", left: "79%", top: "59%", width: 17, height: 17, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", background: "#CC766A", border: "2px solid #fff" }} />
      <div style={{ position: "absolute", left: 10, bottom: 9, display: "flex", alignItems: "center", gap: 5, color: "#466656", background: "rgba(250,251,246,.9)", borderRadius: 8, padding: "5px 7px", fontSize: 8, fontWeight: 650 }}>
        <Shield size={11} /> Venue activity only · guest pins hidden
      </div>
      <div style={{ position: "absolute", right: 9, top: 9, background: "#FBFCF7", color: ink, borderRadius: 9, padding: "7px 9px", display: "flex", gap: 5, alignItems: "center", fontSize: 9, fontWeight: 700 }}>
        <Compass size={12} /> Explore map
      </div>
    </div>
  );
}

function TimelineMark({ color = green }: { color?: string }) {
  return <div style={{ position: "absolute", left: 2, top: 4, width: 9, height: 9, borderRadius: "50%", background: color, outline: "3px solid #EAF3E9" }} />;
}

export function PeoplesAlmanac() {
  return (
    <main
      style={{
        width: 1080,
        height: 1000,
        boxSizing: "border-box",
        overflow: "hidden",
        padding: "25px 42px",
        color: ink,
        background: "radial-gradient(ellipse at 48% -20%, rgba(61,204,68,.14), transparent 58%), #F4F6EF",
        fontFamily: "'Trebuchet MS', ui-sans-serif, sans-serif",
      }}
    >
      <header style={{ width: 760, margin: "0 auto 17px" }}>
        <div style={{ color: "#388A42", fontSize: 10, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase" }}>Met · design exploration 03</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
          <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 30, fontWeight: 400, letterSpacing: "-.045em" }}>People’s Almanac</h1>
          <span style={{ color: muted, fontSize: 12 }}>Home + Profile · moments, not metrics</span>
        </div>
      </header>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 34 }}>
        <PhoneFrame title="Home" note="A week among people & places">
          <ScreenHeader right={<><Globe2 size={19} /><Users size={19} /></>} />
          <div style={{ height: 666, boxSizing: "border-box", overflow: "hidden", padding: "7px 14px 60px", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 11 }}>
              <div>
                <div style={{ color: "#62826C", fontSize: 8, fontWeight: 800, letterSpacing: ".17em" }}>NEW YORK CITY · THIS WEEK</div>
                <div style={{ marginTop: 4, font: "24px/1.02 Georgia,serif", letterSpacing: "-.04em", color: ink }}>A little closer<br />to your world.</div>
              </div>
              <div style={{ textAlign: "right", paddingBottom: 2 }}>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.05em" }}>18</div>
                <div style={{ color: muted, fontSize: 8 }}>people nearby</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 9, alignItems: "center", background: "#194F30", color: "#F6FBF2", borderRadius: 15, padding: "9px 11px", marginBottom: 11 }}>
              <Radio size={17} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 800 }}>Your visibility is on</div>
                <div style={{ fontSize: 8, marginTop: 2, color: "#D0E3D0" }}>Nearby discovery, on your terms.</div>
              </div>
              <div style={{ width: 30, height: 17, borderRadius: 12, background: "#3DCC44", padding: 2, boxSizing: "border-box" }}><div style={{ width: 13, height: 13, borderRadius: 10, background: "#fff", marginLeft: 13 }} /></div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 1px 6px" }}>
                <span style={{ color: muted, fontSize: 8, fontWeight: 800, letterSpacing: ".13em" }}>YOUR NEIGHBORHOOD, IN VIEW</span>
                <span style={{ color: "#438451", fontSize: 8, fontWeight: 700 }}>Map details <ChevronRight size={10} style={{ verticalAlign: "middle" }} /></span>
              </div>
              <MapArtwork />
            </div>

            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "1px 0 4px" }}>
              <span style={{ font: "16px Georgia,serif", letterSpacing: "-.03em" }}>Your week, in people</span>
              <span style={{ color: "#54815D", fontSize: 8, fontWeight: 750 }}>SEE ALL <MoveUpRight size={10} style={{ verticalAlign: "middle" }} /></span>
            </div>
            <div style={{ position: "relative", padding: "2px 0 1px 17px", borderLeft: "1px solid #BCD2BE", marginLeft: 6 }}>
              <div style={{ position: "relative", padding: "3px 0 7px" }}>
                <TimelineMark />
                <div style={{ color: "#6D8372", fontSize: 7, fontWeight: 750, letterSpacing: ".1em" }}>TODAY · 11:20 AM</div>
                <div style={{ marginTop: 2, color: ink, fontSize: 9, fontWeight: 700 }}>A new hello at The Sunroom Café</div>
                <div style={{ color: muted, fontSize: 8, marginTop: 1 }}>Maya was nearby too. A first connection.</div>
              </div>
              <div style={{ position: "relative", padding: "3px 0 7px" }}>
                <TimelineMark color="#D79B4E" />
                <div style={{ color: "#6D8372", fontSize: 7, fontWeight: 750, letterSpacing: ".1em" }}>YESTERDAY · EAST VILLAGE</div>
                <div style={{ marginTop: 2, color: ink, fontSize: 9, fontWeight: 700 }}>Crossed paths with Eli again</div>
                <div style={{ color: muted, fontSize: 8, marginTop: 1 }}>A familiar face, another shared place.</div>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${line}`, paddingTop: 8, display: "flex", gap: 9, alignItems: "center" }}>
              <div style={{ width: 31, height: 31, borderRadius: 10, background: "#E6EEDC", color: "#367744", display: "grid", placeItems: "center" }}><CalendarDays size={16} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#68816D", fontSize: 7, fontWeight: 800, letterSpacing: ".1em" }}>COMING UP · SATURDAY</div>
                <div style={{ marginTop: 2, color: ink, fontSize: 9, fontWeight: 750 }}>Coffee & sketchbooks</div>
                <div style={{ marginTop: 1, color: muted, fontSize: 8 }}>The Sunroom Café · 10:30 AM</div>
              </div>
              <ChevronRight size={15} color={muted} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 1px 8px", borderBottom: `1px solid ${line}` }}>
              <div style={{ width: 27, height: 27, borderRadius: 9, background: "#F4EBD9", color: "#9B7442", display: "grid", placeItems: "center" }}><Coffee size={14} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ color: ink, fontSize: 9, fontWeight: 750 }}>The Sunroom Café</div>
                <div style={{ color: muted, fontSize: 8 }}>East Village · Café & garden</div>
              </div>
              <span style={{ color: "#55805E", fontSize: 8, fontWeight: 700 }}>128 this week</span>
              <ChevronRight size={13} color={muted} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 35, borderRadius: 11, background: green, color: "#143D20", fontSize: 9, fontWeight: 800 }}>
                <MapPin size={14} /> Check in at a venue
              </div>
              <div style={{ width: 36, height: 35, border: `1px solid ${line}`, borderRadius: 11, display: "grid", placeItems: "center", color: "#56805D" }}><Bookmark size={15} /></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "7px 1px", borderTop: `1px solid ${line}` }}>
              <div>
                <div style={{ color: "#6E8373", fontSize: 7, fontWeight: 800, letterSpacing: ".1em" }}>A FEW MORE MOMENTS</div>
                <div style={{ marginTop: 3, color: ink, fontSize: 9, fontWeight: 700 }}>3 new · 2 familiar · 1 plan</div>
              </div>
              <div style={{ color: "#A17C3D", display: "flex", alignItems: "center", gap: 4, fontSize: 8, fontWeight: 700 }}><Award size={14} /> Visit stories</div>
            </div>
          </div>
          <BottomNav active="home" />
        </PhoneFrame>

        <PhoneFrame title="Profile" note="A personal social story">
          <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 15px 0", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 24, height: 24, borderRadius: 8, background: green, display: "grid", placeItems: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>M</div>
              <span style={{ fontWeight: 800, fontSize: 17, color: ink, letterSpacing: "-.04em" }}>My Profile</span>
            </div>
            <div style={{ display: "flex", gap: 10, color: ink }}><Share2 size={17} /><QrCode size={17} /><Settings size={17} /></div>
          </div>
          <div style={{ height: 666, overflow: "hidden", boxSizing: "border-box", padding: "8px 16px 57px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${line}`, paddingBottom: 9 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", color: "#328245", fontSize: 8, fontWeight: 750 }}>
                <Radio size={13} /> VISIBLE ON RADAR
              </div>
              <div style={{ height: 16, width: 30, borderRadius: 10, background: green, padding: 2, boxSizing: "border-box" }}><div style={{ height: 12, width: 12, borderRadius: 8, background: "#fff", marginLeft: 14 }} /></div>
            </div>

            <div style={{ display: "flex", gap: 13, alignItems: "center", padding: "13px 0 12px" }}>
              <div style={{ position: "relative", width: 76, height: 76, flexShrink: 0, borderRadius: "50%", overflow: "hidden", background: "#D6C5A5", border: "3px solid #E1EDDC" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/__mockup/images/met-profile-2026.png')", backgroundSize: "263px 572px", backgroundPosition: "-92px -146px", backgroundRepeat: "no-repeat" }} />
                <div style={{ position: "absolute", right: 0, bottom: 1, width: 18, height: 18, borderRadius: 9, background: "#3DCC44", border: "2px solid #F7F8F1", display: "grid", placeItems: "center", color: "#fff" }}><Check size={10} /></div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ font: "22px Georgia,serif", letterSpacing: "-.04em" }}>Alex Morgan</span>
                  <span style={{ width: 17, height: 17, display: "grid", placeItems: "center", borderRadius: "50%", background: "#E4F0DF", color: "#328245" }}><Check size={11} /></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#92713A", fontSize: 8, fontWeight: 700, marginTop: 4 }}><Award size={12} /> Met Pioneer · community regular</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, color: "#A37D39", fontSize: 8 }}><Star size={11} fill="#D6AF59" /> 4.8 · trusted by the community</div>
              </div>
            </div>

            <div style={{ color: "#4F6555", font: "italic 12px/1.35 Georgia,serif", paddingBottom: 11, borderBottom: `1px solid ${line}` }}>
              “Coffee walks, live music, and getting to know my city.”
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0 6px" }}>
              <span style={{ color: "#66806C", fontSize: 8, fontWeight: 800, letterSpacing: ".14em" }}>LITTLE WINDOWS INTO MY WORLD</span>
              <span style={{ color: muted, fontSize: 8 }}>3 photos</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
              {[
                { label: "MAIN", x: "-15px", y: "-330px" },
                { label: "A quiet morning", x: "-67px", y: "-333px" },
                { label: "At the garden", x: "-172px", y: "-333px" },
              ].map((photo) => (
                <div key={photo.label} style={{ height: 74, overflow: "hidden", borderRadius: 12, position: "relative", background: "#E1E9DC" }}>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/__mockup/images/met-profile-2026.png')", backgroundSize: "300px 653px", backgroundPosition: `${photo.x} ${photo.y}`, backgroundRepeat: "no-repeat" }} />
                  {photo.label === "MAIN" && <span style={{ position: "absolute", left: 5, bottom: 5, borderRadius: 5, background: "#215B34", color: "#fff", padding: "3px 5px", fontSize: 6, fontWeight: 800, letterSpacing: ".08em" }}>MAIN</span>}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: `1px solid ${line}` }}>
              <div style={{ width: 25, height: 25, borderRadius: 8, background: "#F1E8E4", color: "#9A6855", display: "grid", placeItems: "center" }}><Instagram size={14} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ color: ink, fontSize: 9, fontWeight: 750 }}>Instagram</div>
                <div style={{ color: muted, fontSize: 8 }}>@alexmorgan · shared by choice</div>
              </div>
              <MoveUpRight size={13} color={muted} />
            </div>

            <div style={{ padding: "9px 0 8px", borderBottom: `1px solid ${line}` }}>
              <div style={{ color: "#66806C", fontSize: 8, fontWeight: 800, letterSpacing: ".14em", marginBottom: 6 }}>THINGS I’M INTO</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {["Coffee", "Photography", "Live music", "City walks"].map((interest, i) => (
                  <span key={interest} style={{ padding: "5px 8px", borderRadius: 20, background: i === 0 ? "#E7F1DF" : "#F0F1E9", color: "#43634B", fontSize: 8, fontWeight: 650 }}>{interest}</span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: `1px solid ${line}` }}>
              <div style={{ width: 27, height: 27, borderRadius: 9, background: "#F4EEDC", color: "#98783F", display: "grid", placeItems: "center" }}><Gift size={15} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ color: ink, fontSize: 9, fontWeight: 750 }}>Rewards & little wins</div>
                <div style={{ color: muted, fontSize: 8 }}>Pioneer · Sunroom regular · 2 venue awards</div>
              </div>
              <ChevronRight size={14} color={muted} />
            </div>

            <div style={{ paddingTop: 9 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#66806C", fontSize: 8, fontWeight: 800, letterSpacing: ".13em" }}>
                RECENTLY, AROUND TOWN <MoreHorizontal size={15} />
              </div>
              <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 7 }}>
                <div style={{ width: 26, height: 26, borderRadius: 9, background: "#E4EFDE", color: "#47834F", display: "grid", placeItems: "center" }}><Heart size={13} /></div>
                <span style={{ color: ink, fontSize: 8 }}><b>3 new hellos</b> and <b>2 familiar faces</b> this week</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1, height: 33, borderRadius: 10, background: green, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#17421F", fontSize: 8, fontWeight: 800 }}><Sparkles size={13} /> Edit profile</div>
              <div style={{ height: 33, width: 37, border: `1px solid ${line}`, borderRadius: 10, display: "grid", placeItems: "center", color: "#52775B" }}><Share2 size={14} /></div>
            </div>
            <div style={{ display: "flex", gap: 5, alignItems: "center", color: muted, fontSize: 7, marginTop: 8 }}><EyeOff size={11} /> You choose what to share. Nearby guest pins stay hidden.</div>
          </div>
          <BottomNav active="profile" />
        </PhoneFrame>
      </div>
    </main>
  );
}
