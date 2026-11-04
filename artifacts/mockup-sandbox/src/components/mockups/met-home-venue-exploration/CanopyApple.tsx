import { useState, type ReactNode } from "react";
import {
  ArrowDownRight, ArrowLeft, ArrowRight, Award, Bookmark, CalendarDays, Check,
  ChevronDown, ChevronRight, Clock3, Coffee, Compass, Heart, MapPin,
  MoreHorizontal, Navigation, Radio, ScanLine, ShieldCheck, Star, Users, Wifi, X,
} from "lucide-react";

type ScreenSheet = "checkin" | "directions" | "none";
type VenueTab = "today" | "gather" | "guestbook";

function IconButton({ children, label, onClick }: {
  children: ReactNode; label: string; onClick: () => void;
}) {
  return <button className="ca-icon-button" aria-label={label} onClick={onClick}>{children}</button>;
}

function Device({ title, children }: { title: string; children: ReactNode }) {
  return <section className="ca-device">
    <div className="ca-device-label"><strong>{title}</strong><span>MET · SAMPLE VIEW</span></div>
    <div className="ca-frame">
      <div className="ca-screen">
        <div className="ca-status"><span>9:41</span><i className="ca-island" /><span className="ca-status-icons"><Wifi size={14}/><i /></span></div>
        {children}
        <div className="ca-home-indicator" />
      </div>
    </div>
  </section>;
}

const places = [
  { name: "Mira House Coffee", detail: "Coffee · bakery · 0.8 mi", visits: "86", type: "Coffee · bakery", distance: "0.8 mi" },
  { name: "Juniper Market", detail: "Market · pantry · 0.4 mi", visits: "64", type: "Market · pantry", distance: "0.4 mi" },
  { name: "Cypress Books", detail: "Books · neighborhood · 0.6 mi", visits: "42", type: "Books · neighborhood", distance: "0.6 mi" },
];

function StreetMap({ expanded, visible, selected, onSelect }: {
  expanded: boolean; visible: boolean; selected: string; onSelect: (name: string) => void;
}) {
  return <div className={`ca-map-art ${expanded ? "ca-map-expanded" : ""}`} role="img" aria-label="Illustrated River District street map with public venue markers">
    <svg className="ca-streets" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="250" fill="#c7ddc1"/>
      <path d="M-20 183 C48 152 82 163 130 130 S218 109 263 70 S344 46 423 16" fill="none" stroke="#dcedd2" strokeWidth="46"/>
      <path d="M-20 183 C48 152 82 163 130 130 S218 109 263 70 S344 46 423 16" fill="none" stroke="#f5fbef" strokeWidth="2"/>
      <path d="M-20 48 L420 211 M20 -22 L234 270 M150 -25 L99 278 M299 -28 L357 280 M-20 115 L420 105 M-20 230 L420 25" fill="none" stroke="#edf4e7" strokeWidth="17"/>
      <path d="M-20 48 L420 211 M20 -22 L234 270 M150 -25 L99 278 M299 -28 L357 280 M-20 115 L420 105 M-20 230 L420 25" fill="none" stroke="#7d9a79" strokeWidth="1.2" opacity=".46"/>
      <path d="M-15 48 L415 211 M25 -20 L239 270 M155 -20 L104 278 M304 -20 L362 280 M-20 110 L420 100 M-20 225 L420 20" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="3 5" opacity=".8"/>
      <path d="M265 0 C287 31 276 51 304 76 S330 124 355 148 S373 199 407 232" fill="none" stroke="#a9cba6" strokeWidth="20" opacity=".9"/>
      <path d="M265 0 C287 31 276 51 304 76 S330 124 355 148 S373 199 407 232" fill="none" stroke="#dcefd7" strokeWidth="1"/>
      <path d="M19 15h46v32H19z M95 68h38v23H95z M183 24h44v34h-44z M336 86h45v29h-45z M30 204h50v30H30z M232 180h37v29h-37z M284 177h44v28h-44z" fill="#a9c5a0" opacity=".55"/>
      <path d="M18 13h48v34H18z M93 66h40v25H93z M181 22h46v36h-46z M334 84h47v31h-47z M28 202h52v32H28z M230 178h39v30h-39z M282 175h46v30h-46z" fill="none" stroke="#e7f3df" strokeWidth="1"/>
    </svg>
    <span className="ca-map-district ca-district-one">RIVER DISTRICT</span>
    <span className="ca-map-district ca-district-two">WILLOW WALK</span>
    <span className="ca-map-district ca-district-three">OLD MARKET</span>
    <span className="ca-map-park"><i/>Civic green</span>
    <button className={`ca-map-pin ca-pin-mira ${selected === "Mira House Coffee" ? "selected" : ""}`} onClick={() => onSelect("Mira House Coffee")} aria-label="Select Mira House Coffee"><Coffee size={15}/><span>Mira House</span></button>
    <button className={`ca-map-pin ca-pin-juniper ${selected === "Juniper Market" ? "selected" : ""}`} onClick={() => onSelect("Juniper Market")} aria-label="Select Juniper Market"><MapPin size={14}/></button>
    <button className={`ca-map-pin ca-pin-cypress ${selected === "Cypress Books" ? "selected" : ""}`} onClick={() => onSelect("Cypress Books")} aria-label="Select Cypress Books"><MapPin size={14}/></button>
    <div className="ca-map-me" aria-label="Approximate area only"><i/><span>you</span></div>
    <span className="ca-activity-dot ca-activity-a"/><span className="ca-activity-dot ca-activity-b"/><span className="ca-activity-dot ca-activity-c"/>
    <div className="ca-map-scale"><span/>400 m</div>
    <div className="ca-map-trust"><ShieldCheck size={12}/> Pooled venue activity · no live guest pins</div>
    {expanded && <div className="ca-map-expanded-heading"><span>YOUR NEIGHBORHOOD</span><strong>Find a place to begin.</strong></div>}
    {!visible && <div className="ca-map-quiet"><Radio size={14}/> Your visibility is paused</div>}
  </div>;
}

export function CanopyApple() {
  const [visible, setVisible] = useState(true);
  const [expandedMap, setExpandedMap] = useState(false);
  const [selected, setSelected] = useState("Mira House Coffee");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestDetails, setRequestDetails] = useState(false);
  const [homeSheet, setHomeSheet] = useState<ScreenSheet>("none");
  const [venueSheet, setVenueSheet] = useState<ScreenSheet>("none");
  const [venueSaved, setVenueSaved] = useState(false);
  const [rsvp, setRsvp] = useState(false);
  const [venueTab, setVenueTab] = useState<VenueTab>("today");
  const [savedTab, setSavedTab] = useState(false);
  const [toast, setToast] = useState("");
  const selectedPlace = places.find((place) => place.name === selected) ?? places[0];

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };
  const toggleSaved = () => {
    setVenueSaved((wasSaved) => !wasSaved);
    notify(venueSaved ? "Removed from saved places." : "Mira House saved for later.");
  };
  const openSheet = (kind: ScreenSheet, venue = false) => venue ? setVenueSheet(kind) : setHomeSheet(kind);

  return <main className="canopy-apple-board">
    <style>{`
      .canopy-apple-board,.canopy-apple-board *{box-sizing:border-box}
      .canopy-apple-board{
        --ca-brand:#3DCC44;--ca-ink:#19351f;--ca-green-900:#194b26;--ca-green-800:#226c30;
        --ca-green-700:#348b3d;--ca-pale:#e8f5e5;--ca-wash:#f1f8ef;--ca-paper:#fbfcf8;
        --ca-line:#e2eae0;--ca-muted:#66756a;--ca-soft:#f5f8f3;
        width:1120px;height:1020px;overflow:hidden;padding:18px 38px 18px;position:relative;isolation:isolate;
        background:radial-gradient(ellipse at 50% -16%,#fbfdf8 0%,transparent 55%),#e9f0e7;
        color:var(--ca-ink);font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        -webkit-font-smoothing:antialiased;
      }
      .canopy-apple-board:before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.19;background-image:radial-gradient(#8ba28a .5px,transparent .5px);background-size:9px 9px}
      .canopy-apple-board button{font:inherit;color:inherit}
      .ca-heading{height:54px;max-width:900px;margin:0 auto 8px;display:flex;align-items:center;justify-content:space-between}
      .ca-eyebrow{display:flex;align-items:center;gap:8px;color:#436f49;font-size:9px;font-weight:750;letter-spacing:.15em}
      .ca-mark{width:17px;height:17px;display:grid;place-items:center;border-radius:6px 6px 6px 2px;background:var(--ca-brand);color:#17341d}
      .ca-heading h1{margin:5px 0 0;font-size:23px;line-height:1.02;letter-spacing:-.055em;font-weight:650;color:#1d3422}
      .ca-head-note{text-align:right;color:#617363;font-size:9px;line-height:1.5;font-weight:600}
      .ca-pair{display:flex;align-items:flex-start;justify-content:center;gap:28px}
      .ca-device{width:430px;flex:0 0 430px}
      .ca-device-label{height:23px;padding:0 7px 5px;display:flex;align-items:center;justify-content:space-between;color:#36513b}
      .ca-device-label strong{font-size:11px;font-weight:680;letter-spacing:-.01em}
      .ca-device-label span{font-size:7px;font-weight:700;letter-spacing:.12em;color:#879689}
      .ca-frame{height:900px;padding:7px;border-radius:39px;background:#252b26;border:1px solid #ffffffd9;box-shadow:0 21px 48px #26412b22,0 3px 10px #263d2a17}
      .ca-screen{height:100%;position:relative;overflow:hidden;display:flex;flex-direction:column;border-radius:32px;background:var(--ca-paper)}
      .ca-status{height:32px;flex:0 0 32px;position:relative;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:var(--ca-paper);font-size:10px;font-weight:750;color:#203326}
      .ca-island{position:absolute;left:50%;top:5px;transform:translateX(-50%);width:84px;height:18px;border-radius:20px;background:#191f1b}
      .ca-status-icons{display:flex;align-items:center;gap:5px}
      .ca-status-icons i{width:15px;height:9px;border:1px solid currentColor;border-radius:2px;position:relative}
      .ca-status-icons i:before{content:"";position:absolute;inset:1px 4px 1px 1px;background:currentColor;border-radius:1px}
      .ca-home-indicator{position:absolute;z-index:9;bottom:5px;left:50%;transform:translateX(-50%);width:92px;height:4px;border-radius:5px;background:#26332a;opacity:.75;pointer-events:none}
      .ca-scroll{flex:1;min-height:0;overflow:auto;scrollbar-width:none;overscroll-behavior:contain}
      .ca-scroll::-webkit-scrollbar{display:none}
      .ca-icon-button{width:34px;height:34px;border-radius:50%;border:1px solid var(--ca-line);background:#fff;color:#3f5944;display:grid;place-items:center;padding:0;cursor:pointer;transition:background .18s,transform .18s}
      .ca-icon-button:hover{background:var(--ca-wash);transform:translateY(-1px)}
      .ca-home-nav{height:47px;padding:0 17px;display:flex;align-items:center;justify-content:space-between}
      .ca-brand{display:flex;align-items:center;gap:8px;color:#203b26;font-size:18px;font-weight:750;letter-spacing:-.07em}
      .ca-brand-mark{width:25px;height:25px;border-radius:8px 8px 8px 3px;background:var(--ca-brand);color:#17341d;display:grid;place-items:center}
      .ca-sample-chip{color:#728174;font-size:8px;font-weight:650;letter-spacing:.06em}
      .ca-welcome{padding:5px 18px 11px;display:flex;align-items:flex-end;justify-content:space-between}
      .ca-welcome small{display:block;color:#528059;font-size:9px;font-weight:750;letter-spacing:.1em}
      .ca-welcome h2{margin:5px 0 0;color:#1c3823;font-size:25px;line-height:.99;font-weight:680;letter-spacing:-.065em}
      .ca-nearby-count{text-align:right;padding-bottom:2px}
      .ca-nearby-count b{display:block;color:#246932;font-size:26px;line-height:.95;font-weight:680;letter-spacing:-.06em}
      .ca-nearby-count span{display:block;margin-top:4px;color:#758277;font-size:9px}
      .ca-visibility{margin:0 14px 9px;min-height:65px;padding:9px 11px;border-radius:16px;background:#194b26;color:#f4fbf3;display:flex;align-items:center;gap:10px;box-shadow:0 6px 15px #1d552628}
      .ca-visibility-symbol{width:34px;height:34px;border-radius:11px;background:#ffffff16;color:#b9f1bc;display:grid;place-items:center;flex:none}
      .ca-visibility-copy{min-width:0;flex:1}
      .ca-visibility-copy strong{display:block;font-size:11px;font-weight:680;letter-spacing:-.015em}
      .ca-visibility-copy small{display:block;margin-top:3px;color:#d4e8d3;font-size:9px;line-height:1.25}
      .ca-toggle{width:42px;height:25px;border:0;border-radius:20px;padding:3px;background:#718076;cursor:pointer;flex:none;transition:background .2s}
      .ca-toggle.on{background:var(--ca-brand)}
      .ca-toggle i{display:block;width:19px;height:19px;border-radius:50%;background:#fff;box-shadow:0 1px 4px #18391d55;transition:transform .2s}
      .ca-toggle.on i{transform:translateX(17px)}
      .ca-permission{display:flex;align-items:center;gap:5px;padding:0 17px 8px;color:#607c63;font-size:9px;font-weight:550}
      .ca-request{width:calc(100% - 28px);min-height:48px;margin:0 14px 9px;border:1px solid var(--ca-line);border-radius:13px;padding:7px 10px;background:#fff;display:flex;align-items:center;gap:9px;text-align:left;cursor:pointer}
      .ca-request-icon{width:30px;height:30px;border-radius:10px;background:#edf6eb;color:#348a3d;display:grid;place-items:center}
      .ca-request-copy{flex:1}
      .ca-request-copy strong{display:block;font-size:11px;font-weight:680}
      .ca-request-copy small{display:block;margin-top:2px;color:#748176;font-size:9px}
      .ca-request>svg:last-child{color:#758579}
      .ca-map-shell{height:222px;margin:0 13px 10px;border-radius:19px;position:relative;overflow:hidden;background:#c7ddc1;box-shadow:0 5px 14px #34553622}
      .ca-map-art{position:absolute;inset:0;overflow:hidden;background:#c7ddc1}
      .ca-streets{position:absolute;inset:0;width:100%;height:100%}
      .ca-map-district{position:absolute;color:#3e6044;font-size:8px;font-weight:750;letter-spacing:.1em;opacity:.82}
      .ca-district-one{top:13%;left:9%}.ca-district-two{top:64%;left:41%}.ca-district-three{top:79%;right:7%}
      .ca-map-park{position:absolute;left:68%;top:17%;width:65px;height:39px;border-radius:13px;background:#a2c89b;color:#f5fbf2;font-size:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;transform:rotate(-12deg)}
      .ca-map-park i{width:16px;height:8px;border:1px solid #e4f3dc;border-radius:70% 10% 70% 10%;transform:rotate(-25deg)}
      .ca-map-pin{position:absolute;z-index:2;border:0;background:#fbfcf8;color:#2b6334;box-shadow:0 4px 11px #273f2940;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .18s,background .18s}
      .ca-pin-mira{left:42%;top:41%;gap:5px;border-radius:12px 12px 12px 4px;padding:8px 10px;font-size:9px;font-weight:750}
      .ca-pin-mira.selected{color:#18351f;background:var(--ca-brand);transform:translateY(-2px)}
      .ca-pin-juniper{left:17%;top:65%;width:34px;height:34px;border-radius:11px 11px 11px 2px}
      .ca-pin-cypress{right:13%;top:34%;width:32px;height:32px;border-radius:10px 10px 10px 2px}
      .ca-map-me{position:absolute;left:28%;top:27%;width:25px;height:25px;border-radius:50%;background:#f3f8ebdc;border:1px solid #3b7042;display:grid;place-items:center}
      .ca-map-me i{width:8px;height:8px;background:#3d9e46;border-radius:50%;box-shadow:0 0 0 4px #d1edc9}
      .ca-map-me span{position:absolute;top:25px;color:#36553a;font-size:8px;font-weight:700}
      .ca-activity-dot{position:absolute;width:8px;height:8px;border:1px solid #fff;border-radius:50%;background:#55995d;box-shadow:0 0 0 4px #d6edc98a}
      .ca-activity-a{left:69%;top:69%}.ca-activity-b{left:33%;top:74%;background:#77a961}.ca-activity-c{left:83%;top:54%;background:#87ad69}
      .ca-map-scale{position:absolute;right:12px;bottom:45px;color:#3b6040;font-size:8px;font-weight:650;display:flex;align-items:center;gap:4px}
      .ca-map-scale span{width:20px;height:5px;border-top:1px solid #456747;border-left:1px solid #456747;border-right:1px solid #456747}
      .ca-map-trust{position:absolute;left:9px;bottom:9px;padding:6px 8px;border-radius:9px;background:#fbfcf3ed;color:#425e45;display:flex;align-items:center;gap:5px;font-size:8px;font-weight:650}
      .ca-map-expand{position:absolute;right:9px;top:9px;z-index:3;height:33px;border:1px solid #ffffffd9;border-radius:11px;background:#fbfcf8;color:#315b37;padding:0 10px;display:flex;align-items:center;gap:6px;font-size:9px;font-weight:720;cursor:pointer;box-shadow:0 2px 7px #233a2630}
      .ca-map-quiet{position:absolute;z-index:4;right:8px;bottom:9px;background:#194b26;color:#f5fbf2;border-radius:10px;padding:7px 9px;display:flex;align-items:center;gap:5px;font-size:9px}
      .ca-place-card{margin:0 14px 9px;padding:8px;border:1px solid var(--ca-line);border-radius:15px;background:#fff;display:flex;align-items:center;gap:10px}
      .ca-place-photo{width:49px;height:49px;object-fit:cover;border-radius:11px;flex:none}
      .ca-place-copy{flex:1;min-width:0}
      .ca-place-copy small{display:block;color:#63816a;font-size:8px;font-weight:750;letter-spacing:.08em}
      .ca-place-copy strong{display:block;margin-top:3px;color:#263c2a;font-size:12px;font-weight:700}
      .ca-place-copy span{display:block;margin-top:3px;color:#758077;font-size:9px}
      .ca-place-arrow{color:#388641}
      .ca-home-actions{display:flex;gap:8px;margin:0 14px 9px}
      .ca-primary{height:43px;border:0;border-radius:13px;background:var(--ca-brand);color:#17341d!important;display:flex;align-items:center;justify-content:center;gap:7px;font-size:11px;font-weight:750;cursor:pointer;box-shadow:0 4px 10px #319b3930;transition:transform .16s,filter .16s}
      .ca-primary:hover{filter:saturate(1.05) brightness(.98)}
      .ca-primary:active{transform:scale(.985)}
      .ca-home-actions .ca-primary{flex:1}
      .ca-secondary-action{width:44px;height:43px;border:1px solid var(--ca-line);border-radius:13px;background:#fff;color:#416347;display:grid;place-items:center;cursor:pointer}
      .ca-week{margin:0 14px 13px;padding:11px 12px;border-radius:15px;background:#e9f5e6;display:flex;align-items:center;justify-content:space-between}
      .ca-week-intro{font-size:10px;font-weight:700;color:#315b37}
      .ca-week-intro small{display:block;margin-top:4px;color:#718474;font-size:9px;font-weight:500}
      .ca-week-numbers{display:flex;gap:15px}
      .ca-week-number b{display:block;color:#256f30;font-size:20px;line-height:1;font-weight:680}
      .ca-week-number span{display:block;margin-top:4px;color:#718474;font-size:8px;font-weight:700;letter-spacing:.08em}
      .ca-saved-view{padding:18px 17px 24px}
      .ca-saved-view>small{color:#4e7f55;font-size:9px;font-weight:750;letter-spacing:.13em}
      .ca-saved-view h2{margin:9px 0 6px;color:#1f3925;font-size:27px;line-height:1;letter-spacing:-.06em}
      .ca-saved-view p{margin:0 0 15px;color:#6e7d70;font-size:12px;line-height:1.45}
      .ca-saved-empty{padding:20px 14px;margin:12px 0;border-radius:17px;background:#eef6eb;text-align:center;color:#426548}
      .ca-saved-empty i{width:42px;height:42px;border-radius:14px;background:#ddf0d9;display:grid;place-items:center;margin:0 auto 10px}
      .ca-saved-empty strong{display:block;font-size:15px}
      .ca-saved-empty span{display:block;margin-top:5px;color:#708174;font-size:11px;line-height:1.45}
      .ca-saved-action{width:100%;height:44px;border:0;border-radius:13px;background:var(--ca-brand);color:#17341d;font-size:11px;font-weight:750;cursor:pointer}
      .ca-home-tabs{height:56px;flex:none;border-top:1px solid #e7eee5;background:#fbfcf8;display:flex;align-items:center;justify-content:space-around}
      .ca-home-tab{min-width:68px;border:0;background:none;color:#7f8c80;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:9px;font-weight:550;cursor:pointer;padding:6px 9px}
      .ca-home-tab.active{color:#267333;font-weight:750}
      .ca-map-mode{position:absolute;z-index:7;inset:32px 0 0;background:#c7ddc1;animation:ca-arrive .3s cubic-bezier(.2,.75,.25,1)}
      .ca-map-mode .ca-map-art{inset:0}
      .ca-map-expanded-heading{position:absolute;z-index:2;left:20px;right:20px;top:20px;color:#f8fff4;text-shadow:0 2px 9px #1b402880}
      .ca-map-expanded-heading span{display:block;font-size:9px;font-weight:750;letter-spacing:.14em}
      .ca-map-expanded-heading strong{display:block;font-size:26px;letter-spacing:-.05em;margin-top:5px}
      .ca-expanded-close{position:absolute;z-index:5;top:14px;right:15px;width:38px;height:38px;border:1px solid #fff;border-radius:50%;background:#fbfcf8;color:#315b37;display:grid;place-items:center;cursor:pointer}
      .ca-expanded-count{position:absolute;z-index:3;top:105px;left:17px;padding:9px 11px;background:#fbfcf3ed;border-radius:12px;color:#375d3b;font-size:10px;font-weight:650;box-shadow:0 3px 10px #29341d26}
      .ca-expanded-count strong{font-size:22px;margin-right:5px;letter-spacing:-.05em}
      .ca-expanded-sheet{position:absolute;z-index:3;left:9px;right:9px;bottom:9px;border-radius:21px;background:#fbfcf8;box-shadow:0 12px 30px #203d2845;padding:11px 13px 14px;animation:ca-reveal .25s ease}
      .ca-sheet-grab{width:33px;height:4px;border-radius:4px;background:#cbd7ca;margin:0 auto 10px}
      .ca-expanded-sheet-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
      .ca-expanded-sheet-top strong{font-size:17px;font-weight:680;letter-spacing:-.03em;color:#263d2b}
      .ca-expanded-sheet-top span{color:#748475;font-size:8px;font-weight:700;letter-spacing:.1em}
      .ca-expanded-place{width:100%;min-height:59px;border:0;border-top:1px solid #e8eee6;padding:8px 1px;background:none;display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer;color:#304a34}
      .ca-expanded-place img{width:42px;height:40px;border-radius:10px;object-fit:cover}
      .ca-expanded-place span{flex:1}
      .ca-expanded-place b{display:block;font-size:11px}
      .ca-expanded-place small{display:block;font-size:9px;color:#778579;margin-top:3px}
      .ca-expanded-place em{font-size:10px;color:#4d8353;font-weight:750;font-style:normal}
      .ca-map-trust-note{color:#708073;font-size:9px;margin-top:4px;display:flex;align-items:center;gap:5px}
      .ca-request-expanded{margin:-2px 14px 9px;padding:12px;border-radius:13px;background:#eff6ed;border:1px solid #e0ebdd;animation:ca-reveal .2s ease}
      .ca-request-expanded strong{font-size:12px;line-height:1.3}
      .ca-request-expanded p{margin:5px 0 9px;color:#68786b;font-size:10px;line-height:1.45}
      .ca-request-expanded button{border:0;border-radius:9px;background:#deefda;color:#315e36;padding:8px 10px;font-size:10px;font-weight:700;cursor:pointer}
      .ca-venue-top{height:47px;display:flex;align-items:center;justify-content:space-between;padding:0 15px}
      .ca-venue-top-label{color:#77857a;font-size:8px;font-weight:750;letter-spacing:.12em}
      .ca-venue-hero{height:174px;margin:0 10px;border-radius:18px;overflow:hidden;position:relative;background:#758b6d}
      .ca-venue-hero img{width:100%;height:100%;object-fit:cover;object-position:center 46%;filter:saturate(.82)}
      .ca-venue-hero:after{content:"";position:absolute;inset:28% 0 0;background:linear-gradient(180deg,transparent,rgba(20,40,24,.8))}
      .ca-venue-cover-top{position:absolute;z-index:2;top:10px;left:10px;right:10px;display:flex;justify-content:space-between}
      .ca-sample-pill{border-radius:20px;background:#f7fcf1ee;color:#33563a;padding:7px 9px;font-size:8px;font-weight:750;letter-spacing:.08em;display:flex;align-items:center;gap:5px}
      .ca-cover-actions{display:flex;gap:6px}
      .ca-cover-actions button{width:34px;height:34px;border:0;border-radius:50%;background:#fbfcf3;color:#33563a;display:grid;place-items:center;cursor:pointer}
      .ca-venue-title{position:absolute;z-index:2;left:15px;right:14px;bottom:13px;color:#fff}
      .ca-venue-title small{font-size:9px;font-weight:650;letter-spacing:.08em;color:#e4f0dc}
      .ca-venue-title h2{margin:5px 0 0;font-size:25px;line-height:1;letter-spacing:-.06em;font-weight:680}
      .ca-venue-body{padding:10px 15px 22px}
      .ca-venue-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:10px;border-bottom:1px solid #e8eee6}
      .ca-venue-meta>span:first-child{color:#6c7a6f;font-size:10px}
      .ca-rating{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:750;color:#38543c;white-space:nowrap}
      .ca-rating small{color:#879187;font-weight:500}
      .ca-venue-status{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:10px 0;color:#566b59;font-size:9px}
      .ca-venue-status span{display:flex;align-items:center;gap:5px}
      .ca-venue-actions{display:flex;gap:8px;margin-bottom:10px}
      .ca-venue-actions .ca-primary{flex:1}
      .ca-directions{width:46px;height:43px;border:1px solid var(--ca-line);background:#fff;color:#426449;border-radius:13px;display:grid;place-items:center;cursor:pointer}
      .ca-pulse{display:flex;align-items:center;justify-content:space-between;margin:0 0 10px;padding:10px 11px;border-radius:14px;background:#194b26;color:#f4fbf3}
      .ca-pulse-title{display:flex;align-items:center;gap:9px}
      .ca-pulse-icon{width:31px;height:31px;border-radius:10px;background:#ffffff19;color:#d7f2d5;display:grid;place-items:center}
      .ca-pulse-title strong{display:block;font-size:11px;font-weight:680}
      .ca-pulse-title small{display:block;color:#d0e5d0;font-size:9px;margin-top:3px}
      .ca-pulse-num{font-size:22px;color:#baf0bd;font-weight:700;letter-spacing:-.05em}
      .ca-venue-tabs{display:flex;border-bottom:1px solid #e3ebe1;margin:0 0 11px;gap:23px}
      .ca-venue-tab{height:36px;position:relative;border:0;background:none;padding:0 1px;color:#7b897e;font-size:11px;font-weight:650;cursor:pointer}
      .ca-venue-tab.active{color:#236d2f}
      .ca-venue-tab.active:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:3px;background:var(--ca-brand);border-radius:3px}
      .ca-reward{padding:11px 12px;border-radius:14px;background:#edf7e9;border:1px solid #dcebd8;margin-bottom:9px}
      .ca-reward-top{display:flex;align-items:center;justify-content:space-between;color:#528057;font-size:8px;font-weight:750;letter-spacing:.1em}
      .ca-reward h3{margin:7px 0 0;color:#2b4b30;font-size:16px;line-height:1.1;font-weight:680;letter-spacing:-.035em}
      .ca-reward p{margin:5px 0 0;color:#68786c;font-size:10px;line-height:1.4}
      .ca-announcement{padding:10px 11px;border-radius:14px;background:#fff;border:1px solid var(--ca-line);margin-bottom:11px;display:flex;gap:9px}
      .ca-announcement-mark{color:#34843c;width:28px;height:28px;border-radius:9px;background:#edf6ea;display:grid;place-items:center;flex:none}
      .ca-announcement small{color:#78867b;font-size:8px;font-weight:750;letter-spacing:.1em}
      .ca-announcement p{margin:4px 0 0;color:#405444;font-size:12px;line-height:1.35;font-weight:550}
      .ca-section-title{display:flex;align-items:baseline;justify-content:space-between;margin:12px 1px 7px}
      .ca-section-title strong{font-size:15px;font-weight:680;letter-spacing:-.035em;color:#2c4731}
      .ca-section-title span{color:#7f8c81;font-size:8px;font-weight:700;letter-spacing:.08em}
      .ca-leaderboard{display:flex;gap:5px;padding:9px 8px;border:1px solid var(--ca-line);border-radius:12px;background:#fff}
      .ca-leader{flex:1;min-width:0;display:flex;align-items:center;gap:5px}
      .ca-rank{color:#718875;font-size:9px;font-weight:750}
      .ca-leader-avatar{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#e3f0df;color:#3a6940;font-size:10px;font-weight:750;flex:none}
      .ca-leader-copy{min-width:0}
      .ca-leader-copy b{display:block;font-size:9px;white-space:nowrap}
      .ca-leader-copy small{display:block;margin-top:2px;color:#78857b;font-size:8px}
      .ca-event-card{padding:10px;border-radius:13px;background:#fff;border:1px solid var(--ca-line);display:flex;gap:9px;align-items:center}
      .ca-event-date{width:39px;height:42px;border-radius:10px;background:#eaf5e7;color:#3b7041;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none}
      .ca-event-date b{font-size:8px;font-weight:750}
      .ca-event-date strong{font-size:18px;line-height:1;font-weight:700}
      .ca-event-copy{flex:1;min-width:0}
      .ca-event-copy strong{display:block;font-size:11px;color:#334c37}
      .ca-event-copy small{display:block;color:#78857a;font-size:9px;margin-top:3px}
      .ca-rsvp{min-height:32px;border:1px solid #d8e9d4;border-radius:10px;background:#edf6ea;color:#376b3e;padding:0 10px;font-size:9px;font-weight:750;cursor:pointer}
      .ca-guest-quote{padding:12px;border-radius:14px;background:#f0f6ed;border:1px solid #e1ebde}
      .ca-guest-quote blockquote{margin:0;color:#3b5540;font-size:14px;line-height:1.35;font-weight:570;letter-spacing:-.02em}
      .ca-guest-quote cite{display:block;margin-top:8px;color:#77847a;font-size:8px;font-weight:700;letter-spacing:.07em;font-style:normal}
      .ca-guestbook-notes{display:grid;gap:8px}
      .ca-guestbook-note{padding:10px 11px;background:#fff;border:1px solid var(--ca-line);border-radius:12px;color:#405544;font-size:12px;line-height:1.35}
      .ca-guestbook-note small{display:block;color:#7b897e;font-size:9px;font-weight:650;margin-top:6px}
      .ca-hours-contact{margin-top:12px;padding:11px 2px 2px;border-top:1px solid #e5ece3;display:flex;justify-content:space-between;gap:12px;color:#718075;font-size:10px;line-height:1.55}
      .ca-hours-contact strong{color:#405c44;font-size:9px;letter-spacing:.07em}
      .ca-profile-note{margin-top:8px;color:#718075;font-size:9px;display:flex;align-items:center;gap:5px}
      .ca-venue-bottom{min-height:61px;flex:none;padding:7px 14px 9px;background:#fbfcf8;border-top:1px solid #e7eee5;display:flex;align-items:center;gap:10px}
      .ca-venue-bottom small{flex:1;color:#748176;font-size:9px;line-height:1.35}
      .ca-venue-bottom small b{color:#47634b;display:block;font-size:10px}
      .ca-venue-bottom .ca-primary{height:41px;padding:0 14px}
      .ca-sheet-shade{position:absolute;z-index:8;inset:32px 0 0;background:#203a2770;display:flex;align-items:flex-end;animation:ca-fade .18s ease}
      .ca-action-sheet{width:100%;background:#fbfcf8;border-radius:24px 24px 0 0;padding:14px 19px 34px;box-shadow:0 -10px 32px #172b1e2e;animation:ca-reveal .23s ease}
      .ca-sheet-close-row{display:flex;justify-content:space-between;align-items:center;color:#748276;font-size:8px;font-weight:750;letter-spacing:.12em}
      .ca-sheet-close-row button{border:0;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#edf5ea;color:#4a684e;cursor:pointer}
      .ca-action-sheet h3{margin:8px 0 5px;color:#233d29;font-size:24px;letter-spacing:-.055em;font-weight:680}
      .ca-action-sheet p{color:#68796c;font-size:12px;line-height:1.5;margin:0 0 12px}
      .ca-preview-warning{display:flex;align-items:flex-start;gap:9px;padding:11px;border-radius:12px;background:#edf6e9;color:#476749;font-size:10px;line-height:1.45;margin-bottom:13px}
      .ca-preview-warning svg{flex:none}
      .ca-sheet-primary{width:100%;height:46px;border:0;border-radius:13px;background:var(--ca-brand);color:#17341d;font-size:11px;font-weight:750;cursor:pointer}
      .ca-toast{position:absolute;z-index:10;bottom:70px;left:50%;transform:translateX(-50%);padding:10px 14px;border-radius:18px;background:#1f3d27;color:#f4fbf3;box-shadow:0 5px 18px #1d392a44;white-space:nowrap;font-size:10px;font-weight:650;animation:ca-fade .2s ease}
      @keyframes ca-reveal{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      @keyframes ca-fade{from{opacity:0}to{opacity:1}}
      @keyframes ca-arrive{from{opacity:.7;transform:scale(.985)}to{opacity:1;transform:scale(1)}}
      @media(prefers-reduced-motion:reduce){.canopy-apple-board *, .canopy-apple-board *:before,.canopy-apple-board *:after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
      @media(max-width:760px){
        .canopy-apple-board{width:100%;height:auto;min-height:100dvh;padding:16px 12px 28px;overflow:visible}
        .ca-heading{height:auto;margin:0 4px 15px;align-items:flex-start;flex-direction:column;gap:6px}
        .ca-head-note{text-align:left}
        .ca-pair{flex-direction:column;align-items:center;gap:22px}
        .ca-device{width:min(430px,100%);flex-basis:auto}
        .ca-frame{height:min(900px,calc(100dvh - 80px));min-height:720px}
      }
    `}</style>

    <header className="ca-heading">
      <div><div className="ca-eyebrow"><i className="ca-mark"><span>m</span></i> MET / NEIGHBORHOOD STUDY</div><h1>Let the neighborhood open up.</h1></div>
      <div className="ca-head-note">A softer way to be out there<br/>PLACE-FIRST · PRIVACY ALWAYS</div>
    </header>

    <div className="ca-pair">
      <Device title="01 / Home · River District">
        <div className="ca-scroll">
          <div className="ca-home-nav">
            <div className="ca-brand"><span className="ca-brand-mark">m</span>met</div>
            <span className="ca-sample-chip">SAMPLE DAY · 9:41</span>
            <IconButton label="Open connection request" onClick={() => setRequestOpen((open) => !open)}><Users size={16}/></IconButton>
          </div>
          {savedTab ? <div className="ca-saved-view">
            <small>KEEP A PLACE CLOSE</small><h2>Saved for<br/>another day.</h2>
            <p>A few familiar places, ready when you feel like stepping out.</p>
            {venueSaved ? <div className="ca-place-card" style={{margin:"0 0 12px"}}>
              <img className="ca-place-photo" src="/__mockup/images/coffee-shop.png" alt="Mira House Coffee sample venue"/>
              <span className="ca-place-copy"><small>RIVER DISTRICT · SAVED</small><strong>Mira House Coffee</strong><span>Coffee · bakery · community table</span></span>
              <button className="ca-secondary-action" aria-label="Remove Mira House from saved places" onClick={toggleSaved}><Bookmark size={15} fill="#3DCC44"/></button>
            </div> : <div className="ca-saved-empty"><i><Bookmark size={19}/></i><strong>Nothing tucked away yet.</strong><span>Save Mira House Coffee to keep this neighborhood favorite close.</span></div>}
            <button className="ca-saved-action" onClick={() => venueSaved ? setSavedTab(false) : toggleSaved()}>{venueSaved ? "Back to the neighborhood" : "Save Mira House Coffee"}</button>
          </div> : <>
            <div className="ca-welcome">
              <div><small>RIVER DISTRICT · TODAY</small><h2>Make room<br/>for a hello.</h2></div>
              <div className="ca-nearby-count"><b>{visible ? "08" : "—"}</b><span>{visible ? "nearby, by place" : "visibility paused"}</span></div>
            </div>
            <div className="ca-visibility">
              <span className="ca-visibility-symbol"><Radio size={17}/></span>
              <span className="ca-visibility-copy"><strong>{visible ? "You’re open to being found" : "You’re taking a quiet moment"}</strong><small>{visible ? "Only opted-in guests at shared places" : "Switch on whenever it feels right"}</small></span>
              <button className={`ca-toggle ${visible ? "on" : ""}`} aria-label="Toggle visibility beacon" aria-pressed={visible} onClick={() => setVisible((on) => !on)}><i/></button>
            </div>
            <div className="ca-permission"><ShieldCheck size={13}/> Privacy and permissions ready <span>·</span> sample state</div>
            <button className="ca-request" onClick={() => { setRequestOpen((open) => !open); setRequestDetails(false); }} aria-expanded={requestOpen}>
              <span className="ca-request-icon"><Users size={16}/></span><span className="ca-request-copy"><strong>1 connection request</strong><small>Review privately, on your terms</small></span>
              {requestOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
            </button>
            {requestOpen && <div className="ca-request-expanded">
              {requestDetails ? <><strong>One thoughtful hello, waiting for you.</strong><p>Shared place context only. This sample does not reveal anyone’s live location or share a profile.</p><button onClick={() => { setRequestOpen(false); setRequestDetails(false); }}>Close preview</button></> :
                <><strong>A familiar place brought you together.</strong><p>A guest sent a sample hello after a shared visit. Nothing is shared until you choose.</p><button onClick={() => setRequestDetails(true)}>Review sample request</button></>}
            </div>}
            <div className="ca-map-shell">
              <StreetMap expanded={false} visible={visible} selected={selected} onSelect={setSelected}/>
              <button className="ca-map-expand" onClick={() => setExpandedMap(true)}><Compass size={14}/> Explore map <ArrowDownRight size={12}/></button>
            </div>
            <div className="ca-place-card">
              <img className="ca-place-photo" src="/__mockup/images/coffee-shop.png" alt="Mira House Coffee, sample neighborhood café"/>
              <span className="ca-place-copy"><small>ONE GOOD NEXT STEP · {selectedPlace.distance}</small><strong>{selectedPlace.name}</strong><span>{selectedPlace.type} · {selectedPlace.visits} this week</span></span>
              <ArrowRight className="ca-place-arrow" size={17}/>
            </div>
            <div className="ca-home-actions">
              <button className="ca-primary" onClick={() => openSheet("checkin")}><ScanLine size={16}/> Check in at {selected === "Mira House Coffee" ? "Mira House" : selected.split(" ")[0]}</button>
              <button className="ca-secondary-action" aria-label="Preview selected place directions" onClick={() => openSheet("directions")}><Navigation size={16}/></button>
            </div>
            <div className="ca-week"><span className="ca-week-intro">A little more connected<small>Your week around shared places</small></span><div className="ca-week-numbers"><span className="ca-week-number"><b>3</b><span>NEW</span></span><span className="ca-week-number"><b>2</b><span>AGAIN</span></span></div></div>
          </>}
        </div>
        <nav className="ca-home-tabs" aria-label="Home navigation">
          <button className={`ca-home-tab ${!savedTab ? "active" : ""}`} onClick={() => setSavedTab(false)}><MapPin size={17}/><span>Nearby</span></button>
          <button className={`ca-home-tab ${savedTab ? "active" : ""}`} onClick={() => setSavedTab(true)}><Bookmark size={17}/><span>Saved</span></button>
          <button className="ca-home-tab" onClick={() => { setRequestOpen((open) => !open); setSavedTab(false); }}><Users size={17}/><span>People</span></button>
          <button className="ca-home-tab" onClick={() => openSheet("directions")}><MoreHorizontal size={17}/><span>More</span></button>
        </nav>
        {expandedMap && <div className="ca-map-mode">
          <StreetMap expanded visible={visible} selected={selected} onSelect={setSelected}/>
          <button className="ca-expanded-close" aria-label="Collapse map" onClick={() => setExpandedMap(false)}><X size={18}/></button>
          <div className="ca-expanded-count"><strong>{visible ? "08" : "—"}</strong> nearby around places</div>
          <div className="ca-expanded-sheet">
            <div className="ca-sheet-grab"/>
            <div className="ca-expanded-sheet-top"><strong>Places with a pulse</strong><span>RIVER DISTRICT</span></div>
            {places.map((place) => <button className="ca-expanded-place" key={place.name} onClick={() => { setSelected(place.name); setExpandedMap(false); }}>
              <img src="/__mockup/images/coffee-shop.png" alt="Sample neighborhood place"/>
              <span><b>{place.name}</b><small>{place.detail}</small></span><em>{place.visits}</em>
            </button>)}
            <div className="ca-map-trust-note"><ShieldCheck size={12}/> Activity is pooled by venue. No individual guest positions.</div>
          </div>
        </div>}
        {homeSheet !== "none" && <div className="ca-sheet-shade" onClick={() => setHomeSheet("none")}>
          <div className="ca-action-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="ca-sheet-close-row"><span>{homeSheet === "checkin" ? "A MOMENT AT A PLACE" : "GETTING THERE"}<button aria-label="Close preview" onClick={() => setHomeSheet("none")}><X size={15}/></button></span></div>
            <h3>{homeSheet === "checkin" ? `Check in at ${selectedPlace.name}?` : `A short walk to ${selectedPlace.name}.`}</h3>
            <p>{homeSheet === "checkin" ? "A check-in can help turn a familiar place into a familiar face." : `${selectedPlace.name} is about a 12-minute walk through River District.`}</p>
            <div className="ca-preview-warning"><ShieldCheck size={15}/><span>Preview only — no visit saved, no location accessed. Everything stays on this screen.</span></div>
            <button className="ca-sheet-primary" onClick={() => setHomeSheet("none")}>{homeSheet === "checkin" ? "Got it" : "Close directions preview"}</button>
          </div>
        </div>}
        {toast && <div className="ca-toast" role="status">{toast}</div>}
      </Device>

      <Device title="02 / Public place · Mira House Coffee">
        <div className="ca-scroll">
          <div className="ca-venue-top">
            <IconButton label="Back to neighborhood" onClick={() => notify("Neighborhood preview is beside this screen.")}><ArrowLeft size={17}/></IconButton>
            <span className="ca-venue-top-label">A PLACE IN RIVER DISTRICT</span>
            <IconButton label={venueSaved ? "Remove saved venue" : "Save venue"} onClick={toggleSaved}><Bookmark size={16} fill={venueSaved ? "#3DCC44" : "none"}/></IconButton>
          </div>
          <div className="ca-venue-hero">
            <img src="/__mockup/images/coffee-shop.png" alt="Warm, sunlit neighborhood café interior"/>
            <div className="ca-venue-cover-top"><span className="ca-sample-pill"><ShieldCheck size={12}/> SAMPLE PLACE</span><span className="ca-cover-actions"><button aria-label={venueSaved ? "Remove saved venue" : "Save venue"} onClick={toggleSaved}><Heart size={15} fill={venueSaved ? "#3DCC44" : "none"}/></button></span></div>
            <div className="ca-venue-title"><small>COFFEE · BAKERY · NEIGHBORHOOD TABLE</small><h2>Mira House Coffee</h2></div>
          </div>
          <div className="ca-venue-body">
            <div className="ca-venue-meta"><span>A neighborhood room for slow mornings.</span><span className="ca-rating"><Star size={12} fill="#73a74e" color="#73a74e"/> 4.9 <small>· 128</small></span></div>
            <div className="ca-venue-status"><span><Clock3 size={13}/> Open today · 7 am–6 pm</span><span><MapPin size={13}/> River District</span></div>
            <div className="ca-venue-actions"><button className="ca-primary" onClick={() => openSheet("checkin", true)}><ScanLine size={16}/> Check in here</button><button className="ca-directions" aria-label="Directions preview" onClick={() => openSheet("directions", true)}><Navigation size={16}/></button></div>
            <div className="ca-pulse"><span className="ca-pulse-title"><i className="ca-pulse-icon"><Users size={16}/></i><span><strong>A place that brings people back</strong><small>Weekly venue interactions · sample</small></span></span><span className="ca-pulse-num">86</span></div>
            <div className="ca-venue-tabs" role="tablist" aria-label="Venue details">
              <button role="tab" aria-selected={venueTab === "today"} className={`ca-venue-tab ${venueTab === "today" ? "active" : ""}`} onClick={() => setVenueTab("today")}>Today</button>
              <button role="tab" aria-selected={venueTab === "gather"} className={`ca-venue-tab ${venueTab === "gather" ? "active" : ""}`} onClick={() => setVenueTab("gather")}>Gather</button>
              <button role="tab" aria-selected={venueTab === "guestbook"} className={`ca-venue-tab ${venueTab === "guestbook" ? "active" : ""}`} onClick={() => setVenueTab("guestbook")}>Guestbook</button>
            </div>
            {venueTab === "today" && <>
              <div className="ca-reward"><div className="ca-reward-top"><span>A THANK-YOU FOR SHOWING UP</span><Award size={14}/></div><h3>Coffee &amp; pastry for two</h3><p>A little treat for regulars. Sample venue reward; no purchase or membership required.</p></div>
              <div className="ca-announcement"><span className="ca-announcement-mark"><Check size={15}/></span><span><small>FROM THE MIRA HOUSE TEAM</small><p>“The community table is open all weekend. Come say hello.”</p></span></div>
              <div className="ca-section-title"><strong>Regulars, lately</strong><span>POOLED VENUE ACTIVITY</span></div>
              <div className="ca-leaderboard">{[["01","12 visits"],["02","9 visits"],["03","7 visits"]].map(([rank, visits]) => <div className="ca-leader" key={rank}><span className="ca-rank">{rank}</span><i className="ca-leader-avatar"><Users size={12}/></i><span className="ca-leader-copy"><b>Regulars</b><small>{visits}</small></span></div>)}</div>
              <div className="ca-section-title"><strong>Next at the table</strong><span>SATURDAY · 10 AM</span></div>
              <div className="ca-event-card"><span className="ca-event-date"><b>SAT</b><strong>18</strong></span><span className="ca-event-copy"><strong>Vinyl &amp; Slow Pour</strong><small>Community table · sample event</small></span><button className="ca-rsvp" onClick={() => setRsvp((going) => !going)}>{rsvp ? "Saved" : "Save event"}</button></div>
              <div className="ca-section-title"><strong>From the guestbook</strong><span>128 SAMPLE NOTES</span></div>
              <div className="ca-guest-quote"><blockquote>“A lovely place to slow down and meet the neighborhood.”</blockquote><cite>SHARED PLACE NOTE · SAMPLE</cite></div>
            </>}
            {venueTab === "gather" && <>
              <div className="ca-section-title"><strong>Make a little time</strong><span>UPCOMING</span></div>
              <div className="ca-event-card"><span className="ca-event-date"><b>SAT</b><strong>18</strong></span><span className="ca-event-copy"><strong>Vinyl &amp; Slow Pour</strong><small>Saturday · 10 am · community table</small></span><CalendarDays size={17} color="#47804c"/></div>
              <p style={{fontSize:12,lineHeight:1.5,color:"#6c7b6f",margin:"10px 2px 12px"}}>Bring a record you love, stay for a careful pour, and meet a few neighbors. Sample event details.</p>
              <button className="ca-primary" style={{width:"100%",marginBottom:10}} onClick={() => setRsvp((going) => !going)}>{rsvp ? "Event saved to your list" : "Save this event"}</button>
              <div className="ca-reward"><div className="ca-reward-top"><span>REGULARS REWARD · SAMPLE</span><Award size={14}/></div><h3>Coffee &amp; pastry for two</h3><p>A small thank-you for returning to Mira House.</p></div>
            </>}
            {venueTab === "guestbook" && <>
              <div className="ca-section-title"><strong>Notes left here</strong><span>128 POOLED NOTES</span></div>
              <div className="ca-guestbook-notes"><div className="ca-guestbook-note">“A lovely place to slow down and meet the neighborhood.”<small>SHARED PLACE NOTE · SAMPLE</small></div><div className="ca-guestbook-note">“The window seat and a flat white made a rainy afternoon.”<small>SHARED PLACE NOTE · SAMPLE</small></div><div className="ca-guestbook-note">“The community table made it easy to stay a little longer.”<small>SHARED PLACE NOTE · SAMPLE</small></div></div>
            </>}
            <div className="ca-hours-contact"><span><strong>HOURS</strong><br/>Today 7 am–6 pm<br/>Mon–Sun · 7 am–6 pm</span><span><strong>CONTACT</strong><br/>(415) 555-0142<br/>hello@mirahouse.example</span></div>
            <div className="ca-profile-note"><ShieldCheck size={12}/> Sample venue profile · illustrative details</div>
          </div>
        </div>
        <div className="ca-venue-bottom"><small><b>{venueSaved ? "Saved for another day" : "A familiar place, a new hello"}</b>Check-in stays your choice.</small><button className="ca-primary" onClick={() => openSheet("checkin", true)}><ScanLine size={15}/> Check in</button></div>
        {venueSheet !== "none" && <div className="ca-sheet-shade" onClick={() => setVenueSheet("none")}>
          <div className="ca-action-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="ca-sheet-close-row"><span>{venueSheet === "checkin" ? "A MOMENT AT A PLACE" : "GETTING THERE"}</span><button aria-label="Close preview" onClick={() => setVenueSheet("none")}><X size={15}/></button></div>
            <h3>{venueSheet === "checkin" ? "Check in at Mira House?" : "A short neighborhood walk."}</h3>
            <p>{venueSheet === "checkin" ? "A check-in can help turn a familiar place into a familiar face." : "Mira House is about a 12-minute walk through River District."}</p>
            <div className="ca-preview-warning"><ShieldCheck size={15}/><span>Preview only — no visit saved, no location accessed. Everything stays on this screen.</span></div>
            <button className="ca-sheet-primary" onClick={() => setVenueSheet("none")}>{venueSheet === "checkin" ? "Got it" : "Close directions preview"}</button>
          </div>
        </div>}
        {toast && <div className="ca-toast" role="status">{toast}</div>}
      </Device>
    </div>
    <footer style={{position:"absolute",bottom:7,left:0,right:0,textAlign:"center",color:"#758779",fontSize:8,fontWeight:700,letterSpacing:".12em"}}>SAFE SAMPLE CONTENT · POOLED VENUE ACTIVITY ONLY · ALL PREVIEW ACTIONS STAY LOCAL</footer>
  </main>;
}
