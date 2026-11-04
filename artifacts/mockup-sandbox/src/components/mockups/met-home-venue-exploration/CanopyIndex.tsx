import { useState, type ReactNode } from "react";
import {
  ArrowLeft, Award, Bookmark, CalendarDays, Check,
  ChevronRight, Clock3, Coffee, Compass, Heart, MapPin, Navigation, Radio,
  ScanLine, ShieldCheck, Star, Users, Wifi, X,
} from "lucide-react";

type Panel = "checkin" | "directions" | null;
type VenueTab = "Today" | "Gather" | "Guestbook";

const venues = [
  { name: "Mira House Coffee", category: "Coffee · bakery", distance: "0.8 mi", week: 86, icon: "coffee" },
  { name: "Juniper Market", category: "Market · pantry", distance: "0.4 mi", week: 64, icon: "leaf" },
  { name: "Cypress Books", category: "Books · neighborhood", distance: "0.6 mi", week: 42, icon: "book" },
];

function Device({ title, children }: { title: string; children: ReactNode }) {
  return <section className="ci-device">
    <div className="ci-device-label"><strong>{title}</strong><span>MET · SAMPLE VIEW</span></div>
    <div className="ci-frame"><div className="ci-screen">
      <div className="ci-status"><span>9:41</span><i className="ci-island"/><span className="ci-signal"><Wifi size={14}/><i/></span></div>
      {children}
      <div className="ci-home-indicator"/>
    </div></div>
  </section>;
}

function MiniMap({ selected, onSelect, visible }: { selected: string; onSelect: (name: string) => void; visible: boolean }) {
  return <div className="ci-map" role="img" aria-label="Illustrated River District map with nearby venue markers">
    <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="250" fill="#c7ddc1"/>
      <path d="M-20 183 C48 152 82 163 130 130 S218 109 263 70 S344 46 423 16" fill="none" stroke="#dcedd2" strokeWidth="46"/>
      <path d="M-20 183 C48 152 82 163 130 130 S218 109 263 70 S344 46 423 16" fill="none" stroke="#f5fbef" strokeWidth="2"/>
      <path d="M-20 48 L420 211 M20 -22 L234 270 M150 -25 L99 278 M299 -28 L357 280 M-20 115 L420 105 M-20 230 L420 25" fill="none" stroke="#edf4e7" strokeWidth="17"/>
      <path d="M-20 48 L420 211 M20 -22 L234 270 M150 -25 L99 278 M299 -28 L357 280 M-20 115 L420 105 M-20 230 L420 25" fill="none" stroke="#7d9a79" strokeWidth="1.2" opacity=".46"/>
      <path d="M265 0 C287 31 276 51 304 76 S330 124 355 148 S373 199 407 232" fill="none" stroke="#a9cba6" strokeWidth="20"/>
      <path d="M19 15h46v32H19z M95 68h38v23H95z M183 24h44v34h-44z M336 86h45v29h-45z M30 204h50v30H30z M232 180h37v29h-37z M284 177h44v28h-44z" fill="#a9c5a0" opacity=".58"/>
      <path d="M18 13h48v34H18z M93 66h40v25H93z M181 22h46v36h-46z M334 84h47v31h-47z M28 202h52v32H28z M230 178h39v30h-39z M282 175h46v30h-46z" fill="none" stroke="#e7f3df"/>
    </svg>
    <span className="ci-district ci-river">RIVER DISTRICT</span><span className="ci-district ci-willow">WILLOW WALK</span><span className="ci-district ci-market">OLD MARKET</span>
    <span className="ci-park"><i/>Civic green</span>
    <button className={`ci-pin ci-pin-mira ${selected === "Mira House Coffee" ? "is-selected" : ""}`} aria-label="Select Mira House Coffee" onClick={() => onSelect("Mira House Coffee")}><Coffee size={14}/><span>Mira House</span></button>
    <button className={`ci-pin ci-pin-juniper ${selected === "Juniper Market" ? "is-selected" : ""}`} aria-label="Select Juniper Market" onClick={() => onSelect("Juniper Market")}><MapPin size={14}/></button>
    <button className={`ci-pin ci-pin-cypress ${selected === "Cypress Books" ? "is-selected" : ""}`} aria-label="Select Cypress Books" onClick={() => onSelect("Cypress Books")}><MapPin size={14}/></button>
    <span className="ci-you"><i/><b>you</b></span>
    <span className="ci-pooled ci-p1"/><span className="ci-pooled ci-p2"/>
    <span className="ci-map-credit"><ShieldCheck size={11}/> Pooled place activity · no live guest pins</span>
    {!visible && <span className="ci-paused"><Radio size={13}/> Beacon paused</span>}
  </div>;
}

export function CanopyIndex() {
  const [visible, setVisible] = useState(true);
  const [selected, setSelected] = useState("Mira House Coffee");
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<VenueTab>("Today");
  const [rsvp, setRsvp] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [panelSide, setPanelSide] = useState<"home" | "venue">("home");
  const [toast, setToast] = useState("");
  const place = venues.find((item) => item.name === selected) ?? venues[0];
  const openPanel = (kind: Exclude<Panel, null>, side: "home" | "venue") => {
    setPanelSide(side);
    setPanel(kind);
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  return <main className="canopy-index">
    <style>{`
      .canopy-index,.canopy-index *{box-sizing:border-box}
      .canopy-index{--ci-brand:#3DCC44;--ci-ink:#19351f;--ci-deep:#194b26;--ci-forest:#226c30;--ci-pale:#e8f5e5;--ci-wash:#f1f8ef;--ci-paper:#fbfcf8;--ci-line:#e2eae0;--ci-muted:#68776c;width:1120px;height:1020px;overflow:hidden;padding:18px 38px;position:relative;isolation:isolate;background:radial-gradient(ellipse at 50% -16%,#fbfdf8 0%,transparent 55%),#e9f0e7;color:var(--ci-ink);font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
      .canopy-index:before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.17;background-image:radial-gradient(#8ba28a .5px,transparent .5px);background-size:9px 9px}
      .canopy-index button{font:inherit;color:inherit}
      .ci-heading{height:54px;max-width:900px;margin:0 auto 8px;display:flex;align-items:center;justify-content:space-between}
      .ci-eyebrow{display:flex;align-items:center;gap:8px;color:#436f49;font-size:9px;font-weight:750;letter-spacing:.15em}
      .ci-mark{width:17px;height:17px;display:grid;place-items:center;border-radius:6px 6px 6px 2px;background:var(--ci-brand);color:#17341d}
      .ci-heading h1{margin:5px 0 0;font-size:23px;line-height:1.02;letter-spacing:-.055em;font-weight:650;color:#1d3422}
      .ci-head-note{text-align:right;color:#617363;font-size:9px;line-height:1.5;font-weight:600}
      .ci-pair{display:flex;align-items:flex-start;justify-content:center;gap:28px}
      .ci-device{width:430px;flex:0 0 430px}.ci-device-label{height:23px;padding:0 7px 5px;display:flex;align-items:center;justify-content:space-between;color:#36513b}
      .ci-device-label strong{font-size:11px;font-weight:680}.ci-device-label span{font-size:7px;font-weight:700;letter-spacing:.12em;color:#879689}
      .ci-frame{height:900px;padding:7px;border-radius:39px;background:#252b26;border:1px solid #ffffffd9;box-shadow:0 21px 48px #26412b22,0 3px 10px #263d2a17}
      .ci-screen{height:100%;position:relative;overflow:hidden;display:flex;flex-direction:column;border-radius:32px;background:var(--ci-paper)}
      .ci-status{height:32px;flex:0 0 32px;position:relative;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:var(--ci-paper);font-size:10px;font-weight:750}
      .ci-island{position:absolute;left:50%;top:5px;transform:translateX(-50%);width:84px;height:18px;border-radius:20px;background:#191f1b}
      .ci-signal{display:flex;align-items:center;gap:5px}.ci-signal i{width:15px;height:9px;border:1px solid currentColor;border-radius:2px;position:relative}.ci-signal i:before{content:"";position:absolute;inset:1px 4px 1px 1px;background:currentColor;border-radius:1px}
      .ci-scroll{flex:1;min-height:0;overflow:auto;scrollbar-width:none;overscroll-behavior:contain}.ci-scroll::-webkit-scrollbar{display:none}
      .ci-home-indicator{position:absolute;z-index:9;bottom:5px;left:50%;transform:translateX(-50%);width:92px;height:4px;border-radius:5px;background:#26332a;opacity:.75;pointer-events:none}
      .ci-home-nav{height:45px;padding:0 16px;display:flex;align-items:center;justify-content:space-between}
      .ci-brand{display:flex;align-items:center;gap:8px;color:#203b26;font-size:18px;font-weight:750;letter-spacing:-.07em}
      .ci-brand-mark{width:25px;height:25px;border-radius:8px 8px 8px 3px;background:var(--ci-brand);color:#17341d;display:grid;place-items:center}
      .ci-day{color:#758276;font-size:8px;font-weight:650;letter-spacing:.07em}
      .ci-beacon{margin:0 13px 8px;min-height:48px;padding:7px 10px;border-radius:14px;background:var(--ci-deep);color:#f4fbf3;display:flex;align-items:center;gap:9px}
      .ci-beacon-mark{width:31px;height:31px;border-radius:10px;background:#ffffff16;color:#b9f1bc;display:grid;place-items:center;flex:none}
      .ci-beacon-copy{min-width:0;flex:1}.ci-beacon-copy strong{display:block;font-size:10px;font-weight:680}.ci-beacon-copy small{display:block;margin-top:2px;color:#d4e8d3;font-size:8px;line-height:1.2}
      .ci-toggle{width:40px;height:24px;border:0;border-radius:20px;padding:3px;background:#718076;cursor:pointer;flex:none}.ci-toggle.on{background:var(--ci-brand)}.ci-toggle i{display:block;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 4px #18391d55;transition:transform .2s}.ci-toggle.on i{transform:translateX(16px)}
      .ci-privacy{padding:0 17px 8px;color:#607c63;display:flex;align-items:center;gap:5px;font-size:8px;font-weight:550}
      .ci-map{height:232px;margin:0 12px 10px;border-radius:18px;position:relative;overflow:hidden;background:#c7ddc1;box-shadow:0 5px 14px #34553622}
      .ci-map > svg{position:absolute;inset:0;width:100%;height:100%}
      .ci-district{position:absolute;color:#3e6044;font-size:7px;font-weight:750;letter-spacing:.1em;opacity:.82}.ci-river{top:13%;left:8%}.ci-willow{top:68%;left:39%}.ci-market{top:81%;right:7%}
      .ci-park{position:absolute;left:68%;top:16%;width:62px;height:38px;border-radius:13px;background:#a2c89b;color:#f5fbf2;font-size:7px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;transform:rotate(-12deg)}
      .ci-park i{width:15px;height:7px;border:1px solid #e4f3dc;border-radius:70% 10% 70% 10%;transform:rotate(-25deg)}
      .ci-pin{position:absolute;z-index:2;border:0;background:#fbfcf8;color:#2b6334;box-shadow:0 4px 11px #273f2940;display:flex;align-items:center;justify-content:center;cursor:pointer}
      .ci-pin-mira{left:40%;top:40%;gap:5px;border-radius:11px 11px 11px 4px;padding:8px 9px;font-size:8px;font-weight:750}
      .ci-pin.is-selected{color:#17341d;background:var(--ci-brand)}
      .ci-pin-juniper{left:17%;top:67%;width:32px;height:32px;border-radius:10px 10px 10px 2px}
      .ci-pin-cypress{right:13%;top:34%;width:31px;height:31px;border-radius:10px 10px 10px 2px}
      .ci-you{position:absolute;left:27%;top:25%;width:25px;height:25px;border-radius:50%;background:#f3f8ebdc;border:1px solid #3b7042;display:grid;place-items:center}.ci-you i{width:8px;height:8px;background:#3d9e46;border-radius:50%;box-shadow:0 0 0 4px #d1edc9}.ci-you b{position:absolute;top:24px;color:#36553a;font-size:7px}
      .ci-pooled{position:absolute;width:7px;height:7px;border:1px solid #fff;border-radius:50%;background:#55995d;box-shadow:0 0 0 4px #d6edc98a}.ci-p1{left:71%;top:71%}.ci-p2{left:82%;top:56%;background:#87ad69}
      .ci-map-credit{position:absolute;left:8px;bottom:8px;padding:6px 7px;border-radius:8px;background:#fbfcf3ed;color:#425e45;display:flex;align-items:center;gap:4px;font-size:7px;font-weight:650}
      .ci-paused{position:absolute;right:8px;bottom:8px;background:#194b26;color:#f5fbf2;border-radius:9px;padding:7px 8px;display:flex;align-items:center;gap:4px;font-size:8px}
      .ci-list-head{height:27px;margin:0 16px;display:flex;align-items:center;justify-content:space-between}.ci-list-head strong{color:#2e4a33;font-size:12px;letter-spacing:-.02em}.ci-list-head span{color:#78867b;font-size:8px;font-weight:700;letter-spacing:.08em}
      .ci-venue-list{margin:0 13px 9px;border:1px solid var(--ci-line);border-radius:15px;background:#fff;overflow:hidden}
      .ci-venue-row{width:100%;min-height:59px;border:0;border-bottom:1px solid #edf1eb;padding:7px 9px;background:#fff;display:flex;align-items:center;gap:9px;text-align:left;cursor:pointer;transition:background .16s}
      .ci-venue-row:last-child{border-bottom:0}.ci-venue-row.selected{background:#f2f8f0}
      .ci-row-icon{width:35px;height:35px;border-radius:11px;background:#edf6ea;color:#398346;display:grid;place-items:center;flex:none}
      .ci-row-copy{flex:1;min-width:0}.ci-row-copy b{display:block;color:#2a412e;font-size:10px;font-weight:700}.ci-row-copy small{display:block;margin-top:3px;color:#78847a;font-size:8px}
      .ci-row-aside{display:flex;flex-direction:column;align-items:flex-end;gap:4px;color:#5f7864}.ci-row-aside b{color:#338240;font-size:9px}.ci-row-aside small{font-size:7px}
      .ci-week{margin:0 13px 12px;padding:10px 11px;border-radius:14px;background:#e9f5e6;display:flex;align-items:center;justify-content:space-between}
      .ci-week-copy{font-size:10px;font-weight:700;color:#315b37}.ci-week-copy small{display:block;margin-top:3px;color:#718474;font-size:8px;font-weight:500}
      .ci-week-stats{display:flex;gap:13px}.ci-week-stat b{display:block;color:#256f30;font-size:18px;line-height:1;font-weight:680}.ci-week-stat span{display:block;margin-top:3px;color:#718474;font-size:7px;font-weight:700;letter-spacing:.08em}
      .ci-next{margin:0 13px 13px;padding:9px 10px;border:1px solid var(--ci-line);border-radius:13px;background:#fff;display:flex;align-items:center;gap:9px}
      .ci-next-copy{flex:1;min-width:0}.ci-next-copy small{display:block;color:#63816a;font-size:7px;font-weight:750;letter-spacing:.08em}.ci-next-copy b{display:block;margin-top:3px;color:#263c2a;font-size:10px}.ci-next-copy span{display:block;margin-top:2px;color:#758077;font-size:8px}
      .ci-primary{height:39px;border:0;border-radius:12px;background:#3DCC44;color:#17341d!important;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 11px;font-size:9px;font-weight:750;cursor:pointer;box-shadow:0 3px 9px #319b3930;transition:transform .16s,filter .16s}.ci-primary:hover{filter:brightness(.97)}.ci-primary:active{transform:scale(.985)}
      .ci-home-tabs{height:53px;flex:none;border-top:1px solid #e7eee5;background:#fbfcf8;display:flex;align-items:center;justify-content:space-around}
      .ci-home-tab{min-width:64px;border:0;background:none;color:#7f8c80;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:8px;cursor:pointer;padding:5px}.ci-home-tab.active{color:#267333;font-weight:750}
      .ci-icon{width:33px;height:33px;border-radius:50%;border:1px solid var(--ci-line);background:#fff;color:#3f5944;display:grid;place-items:center;padding:0;cursor:pointer}
      .ci-venue-top{height:45px;display:flex;align-items:center;justify-content:space-between;padding:0 14px}
      .ci-venue-top-label{color:#77857a;font-size:8px;font-weight:750;letter-spacing:.11em}
      .ci-hero{height:179px;margin:0 9px;border-radius:17px;overflow:hidden;position:relative;background:#758b6d}.ci-hero img{width:100%;height:100%;object-fit:cover;object-position:center 46%;filter:saturate(.82)}
      .ci-hero:after{content:"";position:absolute;inset:28% 0 0;background:linear-gradient(180deg,transparent,rgba(20,40,24,.8))}
      .ci-sample-pill{position:absolute;z-index:2;top:10px;left:10px;border-radius:20px;background:#f7fcf1ee;color:#33563a;padding:7px 9px;font-size:8px;font-weight:750;letter-spacing:.08em;display:flex;align-items:center;gap:5px}
      .ci-heart{position:absolute;z-index:3;top:10px;right:10px;width:33px;height:33px;border:0;border-radius:50%;background:#fbfcf3;color:#33563a;display:grid;place-items:center;cursor:pointer}
      .ci-venue-title{position:absolute;z-index:2;left:14px;right:14px;bottom:13px;color:#fff}.ci-venue-title small{font-size:8px;font-weight:650;letter-spacing:.08em;color:#e4f0dc}.ci-venue-title h2{margin:5px 0 0;font-size:24px;line-height:1;letter-spacing:-.06em;font-weight:680}
      .ci-venue-body{padding:9px 14px 18px}
      .ci-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:9px;border-bottom:1px solid #e8eee6}.ci-meta>span:first-child{color:#6c7a6f;font-size:9px}
      .ci-rating{display:flex;align-items:center;gap:4px;font-size:9px;font-weight:750;color:#38543c;white-space:nowrap}.ci-rating small{color:#879187;font-weight:500}
      .ci-venue-status{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:9px 0;color:#566b59;font-size:8px}.ci-venue-status span{display:flex;align-items:center;gap:4px}
      .ci-venue-actions{display:flex;gap:8px;margin-bottom:9px}.ci-venue-actions .ci-primary{flex:1;height:39px}
      .ci-directions{width:42px;border:1px solid var(--ci-line);background:#fff;color:#426449;border-radius:12px;display:grid;place-items:center;cursor:pointer}
      .ci-pulse{display:flex;align-items:center;justify-content:space-between;margin:0 0 9px;padding:9px 10px;border-radius:13px;background:#194b26;color:#f4fbf3}
      .ci-pulse-title{display:flex;align-items:center;gap:8px}.ci-pulse-icon{width:29px;height:29px;border-radius:9px;background:#ffffff19;color:#d7f2d5;display:grid;place-items:center}.ci-pulse-title strong{display:block;font-size:10px;font-weight:680}.ci-pulse-title small{display:block;color:#d0e5d0;font-size:8px;margin-top:2px}
      .ci-pulse-num{font-size:21px;color:#baf0bd;font-weight:700;letter-spacing:-.05em}
      .ci-tabs{display:flex;border-bottom:1px solid #e3ebe1;margin:0 0 9px;gap:22px}.ci-tab{height:33px;position:relative;border:0;background:none;padding:0 1px;color:#7b897e;font-size:10px;font-weight:650;cursor:pointer}.ci-tab.active{color:#236d2f}.ci-tab.active:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:3px;background:#3DCC44;border-radius:3px}
      .ci-reward{padding:9px 10px;border-radius:13px;background:#edf7e9;border:1px solid #dcebd8;margin-bottom:8px}.ci-reward-top{display:flex;align-items:center;justify-content:space-between;color:#528057;font-size:7px;font-weight:750;letter-spacing:.1em}.ci-reward h3{margin:6px 0 0;color:#2b4b30;font-size:15px;line-height:1.1;font-weight:680;letter-spacing:-.035em}.ci-reward p{margin:4px 0 0;color:#68786c;font-size:9px;line-height:1.4}
      .ci-announcement{padding:9px 10px;border-radius:13px;background:#fff;border:1px solid var(--ci-line);margin-bottom:9px;display:flex;gap:8px}.ci-announcement-mark{color:#34843c;width:26px;height:26px;border-radius:8px;background:#edf6ea;display:grid;place-items:center;flex:none}.ci-announcement small{color:#78867b;font-size:7px;font-weight:750;letter-spacing:.1em}.ci-announcement p{margin:3px 0 0;color:#405444;font-size:11px;line-height:1.35;font-weight:550}
      .ci-section-title{display:flex;align-items:baseline;justify-content:space-between;margin:10px 1px 6px}.ci-section-title strong{font-size:13px;font-weight:680;letter-spacing:-.035em;color:#2c4731}.ci-section-title span{color:#7f8c81;font-size:7px;font-weight:700;letter-spacing:.08em}
      .ci-leaderboard{display:flex;gap:5px;padding:8px 7px;border:1px solid var(--ci-line);border-radius:11px;background:#fff}.ci-leader{flex:1;min-width:0;display:flex;align-items:center;gap:4px}.ci-rank{color:#718875;font-size:8px;font-weight:750}.ci-avatar{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#e3f0df;color:#3a6940;font-size:9px;font-weight:750;flex:none}.ci-leader-copy{min-width:0}.ci-leader-copy b{display:block;font-size:8px;white-space:nowrap}.ci-leader-copy small{display:block;margin-top:2px;color:#78857b;font-size:7px}
      .ci-event{padding:8px;border-radius:12px;background:#fff;border:1px solid var(--ci-line);display:flex;gap:8px;align-items:center}.ci-date{width:35px;height:38px;border-radius:9px;background:#eaf5e7;color:#3b7041;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none}.ci-date b{font-size:7px}.ci-date strong{font-size:16px;line-height:1}.ci-event-copy{flex:1;min-width:0}.ci-event-copy strong{display:block;font-size:10px;color:#334c37}.ci-event-copy small{display:block;color:#78857a;font-size:8px;margin-top:3px}.ci-rsvp{min-height:29px;border:1px solid #d8e9d4;border-radius:9px;background:#edf6ea;color:#376b3e;padding:0 8px;font-size:8px;font-weight:750;cursor:pointer}
      .ci-guest-quote{padding:10px;border-radius:13px;background:#f0f6ed;border:1px solid #e1ebde}.ci-guest-quote blockquote{margin:0;color:#3b5540;font-size:12px;line-height:1.35;font-weight:570}.ci-guest-quote cite{display:block;margin-top:7px;color:#77847a;font-size:7px;font-weight:700;letter-spacing:.07em;font-style:normal}
      .ci-notes{display:grid;gap:6px}.ci-note{padding:9px 10px;background:#fff;border:1px solid var(--ci-line);border-radius:11px;color:#405544;font-size:10px;line-height:1.35}.ci-note small{display:block;color:#7b897e;font-size:8px;font-weight:650;margin-top:5px}
      .ci-hours{margin-top:10px;padding:9px 1px 2px;border-top:1px solid #e5ece3;display:flex;justify-content:space-between;gap:10px;color:#718075;font-size:9px;line-height:1.5}.ci-hours strong{color:#405c44;font-size:8px;letter-spacing:.07em}.ci-profile-note{margin-top:6px;color:#718075;font-size:8px;display:flex;align-items:center;gap:5px}
      .ci-bottom{min-height:56px;flex:none;padding:6px 13px 8px;background:#fbfcf8;border-top:1px solid #e7eee5;display:flex;align-items:center;gap:9px}.ci-bottom small{flex:1;color:#748176;font-size:8px;line-height:1.35}.ci-bottom small b{color:#47634b;display:block;font-size:9px}
      .ci-overlay{position:absolute;z-index:8;inset:32px 0 0;background:#203a2770;display:flex;align-items:flex-end;animation:ci-fade .18s ease}.ci-sheet{width:100%;background:#fbfcf8;border-radius:22px 22px 0 0;padding:14px 18px 33px;box-shadow:0 -10px 32px #172b1e2e;animation:ci-rise .23s ease}.ci-sheet-head{display:flex;justify-content:space-between;align-items:center;color:#748276;font-size:8px;font-weight:750;letter-spacing:.12em}.ci-sheet-head button{border:0;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#edf5ea;color:#4a684e;cursor:pointer}.ci-sheet h3{margin:7px 0 5px;color:#233d29;font-size:23px;letter-spacing:-.055em}.ci-sheet p{color:#68796c;font-size:11px;line-height:1.5;margin:0 0 11px}.ci-warning{display:flex;align-items:flex-start;gap:8px;padding:10px;border-radius:11px;background:#edf6e9;color:#476749;font-size:9px;line-height:1.45;margin-bottom:12px}.ci-warning svg{flex:none}.ci-sheet .ci-primary{width:100%;height:42px}
      .ci-toast{position:absolute;z-index:10;bottom:66px;left:50%;transform:translateX(-50%);padding:9px 12px;border-radius:18px;background:#1f3d27;color:#f4fbf3;box-shadow:0 5px 18px #1d392a44;white-space:nowrap;font-size:9px;font-weight:650}
      .ci-footer{position:absolute;bottom:7px;left:0;right:0;text-align:center;color:#758779;font-size:8px;font-weight:700;letter-spacing:.12em}
      @keyframes ci-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes ci-fade{from{opacity:0}to{opacity:1}}
      @media(prefers-reduced-motion:reduce){.canopy-index *,.canopy-index *:before,.canopy-index *:after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
      @media(max-width:760px){.canopy-index{width:100%;height:auto;min-height:100dvh;padding:16px 12px 28px;overflow:visible}.ci-heading{height:auto;margin:0 4px 15px;align-items:flex-start;flex-direction:column;gap:6px}.ci-head-note{text-align:left}.ci-pair{flex-direction:column;align-items:center;gap:22px}.ci-device{width:min(430px,100%);flex-basis:auto}.ci-frame{height:min(900px,calc(100dvh - 80px));min-height:720px}.ci-footer{position:static;margin-top:16px}}
    `}</style>

    <header className="ci-heading">
      <div><div className="ci-eyebrow"><i className="ci-mark">m</i> MET / NEIGHBORHOOD INDEX</div><h1>Find your next familiar place.</h1></div>
      <div className="ci-head-note">A neighborhood, at your pace<br/>PLACE-FIRST · PRIVACY ALWAYS</div>
    </header>
    <div className="ci-pair">
      <Device title="01 / Home · River District">
        <div className="ci-scroll">
          <div className="ci-home-nav"><div className="ci-brand"><span className="ci-brand-mark">m</span>met</div><span className="ci-day">RIVER DISTRICT · TODAY</span><span style={{width:32}}/></div>
          <div className="ci-beacon"><span className="ci-beacon-mark"><Radio size={16}/></span><span className="ci-beacon-copy"><strong>{visible ? "Beacon on · you choose when" : "Beacon paused · your choice"}</strong><small>{visible ? "Opted-in guests at shared places only" : "Nothing is shared while paused"}</small></span><button className={`ci-toggle ${visible ? "on" : ""}`} aria-label="Toggle privacy beacon" aria-pressed={visible} onClick={() => setVisible((state) => !state)}><i/></button></div>
          <div className="ci-privacy"><ShieldCheck size={12}/> Approximate area only <span>·</span> no live guest locations</div>
          <MiniMap selected={selected} onSelect={setSelected} visible={visible}/>
          <div className="ci-list-head"><strong>Places around you</strong><span>3 SELECTED · 08 NEARBY</span></div>
          <div className="ci-venue-list">{venues.map((venue) => <button key={venue.name} className={`ci-venue-row ${selected === venue.name ? "selected" : ""}`} onClick={() => setSelected(venue.name)}>
            <span className="ci-row-icon">{venue.icon === "coffee" ? <Coffee size={16}/> : venue.icon === "leaf" ? <Radio size={16}/> : <Bookmark size={16}/>}</span>
            <span className="ci-row-copy"><b>{venue.name}</b><small>{venue.category} <span>·</span> {venue.distance}</small></span>
            <span className="ci-row-aside"><b>{venue.week}</b><small>this week</small></span><ChevronRight size={15}/>
          </button>)}</div>
          <div className="ci-week"><span className="ci-week-copy">Your week, around places<small>A few familiar faces take time.</small></span><span className="ci-week-stats"><span className="ci-week-stat"><b>3</b><span>NEW</span></span><span className="ci-week-stat"><b>2</b><span>AGAIN</span></span></span></div>
          <div className="ci-next"><span className="ci-next-copy"><small>ONE GOOD NEXT STEP · {place.distance}</small><b>{place.name}</b><span>{place.category} · {place.week} pooled visits this week</span></span><button className="ci-primary" onClick={() => openPanel("checkin", "home")}><ScanLine size={14}/> Check in</button></div>
        </div>
        <nav className="ci-home-tabs" aria-label="Home navigation">
          <button className="ci-home-tab active"><MapPin size={16}/><span>Nearby</span></button>
          <button className="ci-home-tab" onClick={() => { setSaved((value) => !value); notify(saved ? "Removed from saved places." : "Mira House saved for later."); }}><Bookmark size={16} fill={saved ? "#3DCC44" : "none"}/><span>Saved</span></button>
          <button className="ci-home-tab" onClick={() => notify("People preview · shared-place connections only.")}><Users size={16}/><span>People</span></button>
          <button className="ci-home-tab" onClick={() => openPanel("directions", "home")}><Compass size={16}/><span>More</span></button>
        </nav>
        {panel && panelSide === "home" && <div className="ci-overlay" onClick={() => setPanel(null)}><div className="ci-sheet" onClick={(event) => event.stopPropagation()}>
          <div className="ci-sheet-head"><span>{panel === "checkin" ? "A MOMENT AT A PLACE" : "GETTING THERE"}<button aria-label="Close preview" onClick={() => setPanel(null)}><X size={14}/></button></span></div>
          <h3>{panel === "checkin" ? `Check in at ${place.name}?` : `A short walk to ${place.name}.`}</h3>
          <p>{panel === "checkin" ? "A check-in can help turn a familiar place into a familiar face." : `${place.name} is about a 12-minute walk through River District.`}</p>
          <div className="ci-warning"><ShieldCheck size={14}/><span>Preview only — no visit saved, no location accessed. Everything stays on this screen.</span></div>
          <button className="ci-primary" onClick={() => setPanel(null)}>{panel === "checkin" ? "Got it" : "Close directions preview"}</button>
        </div></div>}
        {toast && <div className="ci-toast" role="status">{toast}</div>}
      </Device>

      <Device title="02 / Public place · Mira House Coffee">
        <div className="ci-scroll">
          <div className="ci-venue-top"><button className="ci-icon" aria-label="Back to neighborhood" onClick={() => notify("Neighborhood index is beside this screen.")}><ArrowLeft size={16}/></button><span className="ci-venue-top-label">A PLACE IN RIVER DISTRICT</span><button className="ci-icon" aria-label={saved ? "Unsave venue" : "Save venue"} onClick={() => { setSaved((value) => !value); notify(saved ? "Mira House removed from saved places." : "Mira House saved for later."); }}><Bookmark size={15} fill={saved ? "#3DCC44" : "none"}/></button></div>
          <div className="ci-hero"><img src="/__mockup/images/coffee-shop.png" alt="Warm, sunlit neighborhood café interior"/><span className="ci-sample-pill"><ShieldCheck size={11}/> SAMPLE PLACE</span><button className="ci-heart" aria-label={saved ? "Unsave Mira House" : "Save Mira House"} onClick={() => setSaved((value) => !value)}><Heart size={15} fill={saved ? "#3DCC44" : "none"}/></button><div className="ci-venue-title"><small>COFFEE · BAKERY · NEIGHBORHOOD TABLE</small><h2>Mira House Coffee</h2></div></div>
          <div className="ci-venue-body">
            <div className="ci-meta"><span>A neighborhood room for slow mornings.</span><span className="ci-rating"><Star size={12} fill="#73a74e" color="#73a74e"/> 4.9 <small>· 128</small></span></div>
            <div className="ci-venue-status"><span><Clock3 size={12}/> Open today · 7 am–6 pm</span><span><MapPin size={12}/> River District</span></div>
            <div className="ci-venue-actions"><button className="ci-primary" onClick={() => openPanel("checkin", "venue")}><ScanLine size={14}/> Check in here</button><button className="ci-directions" aria-label="Preview directions" onClick={() => openPanel("directions", "venue")}><Navigation size={15}/></button></div>
            <div className="ci-pulse"><span className="ci-pulse-title"><i className="ci-pulse-icon"><Users size={15}/></i><span><strong>A place that brings people back</strong><small>Weekly venue interactions · sample</small></span></span><span className="ci-pulse-num">86</span></div>
            <div className="ci-tabs" role="tablist" aria-label="Venue details">{(["Today", "Gather", "Guestbook"] as VenueTab[]).map((item) => <button key={item} role="tab" aria-selected={tab === item} className={`ci-tab ${tab === item ? "active" : ""}`} onClick={() => setTab(item)}>{item}</button>)}</div>
            {tab === "Today" && <>
              <div className="ci-reward"><div className="ci-reward-top"><span>A THANK-YOU FOR SHOWING UP</span><Award size={13}/></div><h3>Coffee &amp; pastry for two</h3><p>A little treat for regulars. Sample venue reward; no purchase or membership required.</p></div>
              <div className="ci-announcement"><span className="ci-announcement-mark"><Check size={14}/></span><span><small>FROM THE MIRA HOUSE TEAM</small><p>“The community table is open all weekend. Come say hello.”</p></span></div>
              <div className="ci-section-title"><strong>Regulars, lately</strong><span>POOLED VENUE ACTIVITY</span></div>
              <div className="ci-leaderboard">{[["01","12 visits"],["02","9 visits"],["03","7 visits"]].map(([rank, visits]) => <div className="ci-leader" key={rank}><span className="ci-rank">{rank}</span><i className="ci-avatar"><Users size={11}/></i><span className="ci-leader-copy"><b>Regulars</b><small>{visits}</small></span></div>)}</div>
              <div className="ci-section-title"><strong>Next at the table</strong><span>SATURDAY · 10 AM</span></div>
              <div className="ci-event"><span className="ci-date"><b>SAT</b><strong>18</strong></span><span className="ci-event-copy"><strong>Vinyl &amp; Slow Pour</strong><small>Community table · sample event</small></span><button className="ci-rsvp" onClick={() => setRsvp((value) => !value)}>{rsvp ? "Saved" : "Save event"}</button></div>
              <div className="ci-section-title"><strong>From the guestbook</strong><span>128 SAMPLE NOTES</span></div><div className="ci-guest-quote"><blockquote>“A lovely place to slow down and meet the neighborhood.”</blockquote><cite>SHARED PLACE NOTE · SAMPLE</cite></div>
            </>}
            {tab === "Gather" && <>
              <div className="ci-section-title"><strong>Make a little time</strong><span>UPCOMING</span></div>
              <div className="ci-event"><span className="ci-date"><b>SAT</b><strong>18</strong></span><span className="ci-event-copy"><strong>Vinyl &amp; Slow Pour</strong><small>Saturday · 10 am · community table</small></span><CalendarDays size={16} color="#47804c"/></div>
              <p style={{fontSize:10,lineHeight:1.5,color:"#6c7b6f",margin:"9px 2px 10px"}}>Bring a record you love, stay for a careful pour, and meet a few neighbors. Sample event details.</p>
              <button className="ci-primary" style={{width:"100%",marginBottom:9}} onClick={() => setRsvp((value) => !value)}>{rsvp ? "Event saved to your list" : "Save this event"}</button>
              <div className="ci-reward"><div className="ci-reward-top"><span>REGULARS REWARD · SAMPLE</span><Award size={13}/></div><h3>Coffee &amp; pastry for two</h3><p>A small thank-you for returning to Mira House.</p></div>
            </>}
            {tab === "Guestbook" && <><div className="ci-section-title"><strong>Notes left here</strong><span>128 POOLED NOTES</span></div><div className="ci-notes"><div className="ci-note">“A lovely place to slow down and meet the neighborhood.”<small>SHARED PLACE NOTE · SAMPLE</small></div><div className="ci-note">“The window seat and a flat white made a rainy afternoon.”<small>SHARED PLACE NOTE · SAMPLE</small></div><div className="ci-note">“The community table made it easy to stay a little longer.”<small>SHARED PLACE NOTE · SAMPLE</small></div></div></>}
            <div className="ci-hours"><span><strong>HOURS</strong><br/>Today 7 am–6 pm<br/>Mon–Sun · 7 am–6 pm</span><span><strong>CONTACT</strong><br/>(415) 555-0142<br/>hello@mirahouse.example</span></div>
            <div className="ci-profile-note"><ShieldCheck size={11}/> Sample venue profile · illustrative details</div>
          </div>
        </div>
        <div className="ci-bottom"><small><b>{saved ? "Saved for another day" : "A familiar place, a new hello"}</b>Check-in stays your choice.</small><button className="ci-primary" onClick={() => openPanel("checkin", "venue")}><ScanLine size={14}/> Check in</button></div>
        {panel && panelSide === "venue" && <div className="ci-overlay" onClick={() => setPanel(null)}><div className="ci-sheet" onClick={(event) => event.stopPropagation()}>
          <div className="ci-sheet-head"><span>{panel === "checkin" ? "A MOMENT AT A PLACE" : "GETTING THERE"}</span><button aria-label="Close preview" onClick={() => setPanel(null)}><X size={14}/></button></div>
          <h3>{panel === "checkin" ? "Check in at Mira House?" : "A short neighborhood walk."}</h3>
          <p>{panel === "checkin" ? "A check-in can help turn a familiar place into a familiar face." : "Mira House is about a 12-minute walk through River District."}</p>
          <div className="ci-warning"><ShieldCheck size={14}/><span>Preview only — no visit saved, no location accessed. Everything stays on this screen.</span></div><button className="ci-primary" onClick={() => setPanel(null)}>{panel === "checkin" ? "Got it" : "Close directions preview"}</button>
        </div></div>}
        {toast && <div className="ci-toast" role="status">{toast}</div>}
      </Device>
    </div>
    <footer className="ci-footer">SAFE SAMPLE CONTENT · POOLED VENUE ACTIVITY ONLY · ALL PREVIEW ACTIONS STAY LOCAL</footer>
  </main>;
}
