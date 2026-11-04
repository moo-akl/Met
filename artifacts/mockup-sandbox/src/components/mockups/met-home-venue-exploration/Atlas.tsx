import { useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Bookmark, ChevronDown, ChevronRight,
  Clock3, Coffee, Compass, Heart, MapPin, MessageCircle, Radio,
  ScanLine, ShieldCheck, Sparkles, Star, Users, Wifi, X,
} from "lucide-react";

type VenueSection = "story" | "gather" | "guestbook";

function Phone({ title, children }: { title: string; children: ReactNode }) {
  return <section className="atlas-device">
    <div className="atlas-device-label"><b>{title}</b><span>MET · SAMPLE VIEW</span></div>
    <div className="atlas-shell">
      <div className="atlas-screen">
        <div className="atlas-status"><span>9:41</span><i /><span className="atlas-status-icons"><Wifi size={12} /><span className="atlas-battery" /></span></div>
        {children}
        <div className="atlas-home-indicator" />
      </div>
    </div>
  </section>;
}

function CityMap({ expanded, selected, onSelect, onExpand }: { expanded: boolean; selected: string; onSelect: (venue: string) => void; onExpand: () => void }) {
  return <div className={`atlas-map ${expanded ? "atlas-map-expanded" : ""}`} role="img" aria-label="Illustrated River District neighborhood map showing public venue activity">
    <svg className="atlas-map-svg" viewBox="0 0 430 480" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="430" height="480" fill="#c5ceab" />
      <path d="M0 313C69 280 93 308 148 275s91-15 142-46 90-16 140-46v297H0Z" fill="#adb991" />
      <path d="M-25 83C38 104 73 81 124 105s92 42 148 20 91-39 182-12" fill="none" stroke="#a5c0a6" strokeWidth="43" />
      <path d="M-25 83C38 104 73 81 124 105s92 42 148 20 91-39 182-12" fill="none" stroke="#d4dfc7" strokeWidth="2" />
      <path d="M-22 368C39 345 89 376 142 348s98-46 144-22 94 2 169-31" fill="none" stroke="#d9e2c7" strokeWidth="2" />
      <g fill="#d8ddc4" stroke="#b6c09f" strokeWidth="1">
        <path d="M16 23h79v46H16zM133 18h86v34h-86zM280 16h112v51H280z" />
        <path d="M-8 151h65v66H-8zM79 153h105v57H79zM218 161h64v74h-64zM319 147h111v51H319z" />
        <path d="M13 251h95v68H13zM133 243h72v59h-72zM252 270h86v48h-86zM360 228h79v72h-79z" />
        <path d="M-8 392h88v63H-8zM105 363h89v64h-89zM229 382h74v65h-74zM329 351h105v80H329z" />
      </g>
      <g fill="#91a078" opacity=".78">
        <path d="M23 32h22v10H23zM144 27h31v8h-31zM293 27h24v12h-24zM90 168h29v11H90zM236 177h22v12h-22zM332 159h40v9h-40zM26 269h32v13H26zM146 259h24v11h-24zM375 245h37v12h-37zM115 382h30v11h-30zM244 396h23v10h-23zM348 368h33v12h-33z" />
      </g>
      <g fill="none" stroke="#f3f0df" strokeLinecap="round">
        <path d="M-21 130C64 135 112 116 188 139s129 45 263 5" strokeWidth="18" />
        <path d="M-15 229C70 204 108 226 194 205s137-42 262-19" strokeWidth="16" />
        <path d="M-20 342C64 314 116 337 195 318s145-41 264-13" strokeWidth="18" />
        <path d="M104 -25C94 56 118 94 108 169s-21 129-7 196 27 88 10 142" strokeWidth="16" />
        <path d="M225 -30C210 39 247 105 226 176s-24 119-4 189 35 80 23 148" strokeWidth="17" />
        <path d="M326 -26C303 44 339 105 321 179s-10 115 10 187 26 79 13 142" strokeWidth="14" />
      </g>
      <g fill="none" stroke="#b5bda1" strokeWidth="1">
        <path d="M-21 130C64 135 112 116 188 139s129 45 263 5M-15 229C70 204 108 226 194 205s137-42 262-19M-20 342C64 314 116 337 195 318s145-41 264-13" />
        <path d="M104 -25C94 56 118 94 108 169s-21 129-7 196 27 88 10 142M225 -30C210 39 247 105 226 176s-24 119-4 189 35 80 23 148M326 -26C303 44 339 105 321 179s-10 115 10 187 26 79 13 142" />
      </g>
      <path d="M-5 293C53 278 85 292 130 276s70-25 110-31" fill="none" stroke="#8b9a66" strokeWidth="2" strokeDasharray="3 7" opacity=".8" />
      <g fill="#829268" fontFamily="system-ui,sans-serif" fontSize="8" fontWeight="700" letterSpacing="1.5">
        <text x="18" y="117">RIVER WALK</text><text x="271" y="103">MARKET ROW</text><text x="30" y="382">OLD TOWN</text><text x="277" y="350">GARDEN LANE</text>
      </g>
      <g fill="#e3e7d1" opacity=".7">
        <circle cx="50" cy="210" r="3"/><circle cx="176" cy="156" r="3"/><circle cx="366" cy="204" r="3"/>
        <circle cx="61" cy="332" r="3"/><circle cx="207" cy="352" r="3"/><circle cx="381" cy="327" r="3"/>
      </g>
    </svg>
    <div className="atlas-map-grain" />
    <span className="atlas-map-tag"><Compass size={12} /> RIVER DISTRICT <span>·</span> LIVE NEIGHBORHOOD</span>
    <span className="atlas-pooled"><Users size={12} /> 8 nearby <i /> pooled at places</span>
    <button className={`atlas-pin atlas-pin-mira ${selected === "Mira House" ? "selected" : ""}`} onClick={() => onSelect("Mira House")} aria-label="Select Mira House Coffee"><span><Coffee size={14} /></span><b>Mira House</b><small>86 this week</small></button>
    <button className={`atlas-pin atlas-pin-juniper ${selected === "Juniper Market" ? "selected" : ""}`} onClick={() => onSelect("Juniper Market")} aria-label="Select Juniper Market"><span><MapPin size={13} /></span><b>Juniper Market</b></button>
    <button className={`atlas-pin atlas-pin-cypress ${selected === "Cypress Books" ? "selected" : ""}`} onClick={() => onSelect("Cypress Books")} aria-label="Select Cypress Books"><span><MapPin size={13} /></span><b>Cypress Books</b></button>
    <span className="atlas-map-scale"><i /> 500 m</span>
    {!expanded && <button className="atlas-expand" onClick={onExpand}><Compass size={12} /> Explore the map <ArrowRight size={12} /></button>}
    {expanded && <button className="atlas-collapse-map" onClick={() => onSelect("__collapse")}><ChevronDown size={14} /> Close map</button>}
  </div>;
}

export function Atlas() {
  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState("Mira House");
  const [requestOpen, setRequestOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rsvp, setRsvp] = useState(false);
  const [venueSection, setVenueSection] = useState<VenueSection>("story");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("Home");

  const selectVenue = (name: string) => {
    if (name === "__collapse") setExpanded(false);
    else setSelected(name);
  };
  const inform = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2300);
  };

  return <main className="atlas-board">
    <style>{`
      .atlas-board,.atlas-board *{box-sizing:border-box}
      .atlas-board{--olive:#526038;--olive-deep:#344229;--olive-mid:#778652;--olive-light:#dfe5cc;--olive-wash:#eff1e5;--paper:#faf9f1;--ink:#293127;--muted:#788071;--line:#e4e5d9;--ochre:#bd8950;width:1120px;height:1020px;overflow:hidden;padding:20px 42px 18px;color:var(--ink);background:radial-gradient(ellipse at 52% -18%,#fffef5 0,#f1f0e5 60%,#e7e8d9 100%);font-family:'DM Sans',system-ui,sans-serif;position:relative;isolation:isolate}
      .atlas-board:before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.14;background-image:radial-gradient(#74785d .55px,transparent .55px);background-size:8px 8px}
      .atlas-head{max-width:910px;height:62px;margin:0 auto 13px;display:flex;align-items:center;justify-content:space-between}
      .atlas-head-mark{display:flex;align-items:center;gap:9px;color:#67734e;font:600 9px 'DM Mono',monospace;letter-spacing:.17em}
      .atlas-head-mark i{width:19px;height:19px;border-radius:50%;background:var(--olive);position:relative;display:block}
      .atlas-head-mark i:before{content:"";position:absolute;width:7px;height:7px;left:6px;top:6px;border-radius:50%;background:#e6dca9}
      .atlas-head h1{margin:4px 0 0;font:500 26px/1 'Newsreader',Georgia,serif;letter-spacing:-.035em}
      .atlas-head-note{max-width:240px;text-align:right;color:#767b69;font-size:10px;line-height:1.45}
      .atlas-screens{display:flex;justify-content:center;gap:31px;align-items:start}
      .atlas-device{width:440px;flex:0 0 440px}
      .atlas-device-label{height:23px;display:flex;align-items:center;justify-content:space-between;padding:0 8px 7px;color:#4c553e;font-size:11px;letter-spacing:.02em}
      .atlas-device-label span{font:500 8px 'DM Mono',monospace;letter-spacing:.11em;color:#8b8e7d}
      .atlas-shell{height:887px;padding:7px;border-radius:40px;background:#252922;border:1px solid rgba(255,255,255,.8);box-shadow:0 25px 58px rgba(52,57,38,.19),0 4px 9px rgba(56,60,43,.1)}
      .atlas-screen{height:100%;position:relative;display:flex;flex-direction:column;overflow:hidden;border-radius:33px;background:var(--paper)}
      .atlas-status{height:30px;flex:none;position:relative;z-index:8;display:flex;align-items:center;justify-content:space-between;padding:0 19px;font-size:10px;font-weight:800;color:#293127;background:var(--paper)}
      .atlas-status>i{position:absolute;left:50%;top:5px;transform:translateX(-50%);width:84px;height:19px;border-radius:14px;background:#1b1e19}
      .atlas-status-icons{display:flex;align-items:center;gap:5px}.atlas-battery{height:9px;width:16px;border:1px solid #42503c;border-radius:2px;position:relative}.atlas-battery:before{content:"";position:absolute;inset:1px 3px 1px 1px;background:#42503c;border-radius:1px}
      .atlas-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:none}.atlas-scroll::-webkit-scrollbar{display:none}
      .atlas-home-head{height:57px;padding:3px 17px 9px;display:flex;align-items:center;justify-content:space-between;background:var(--paper)}
      .atlas-brand{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:750;letter-spacing:-.07em}
      .atlas-brand-mark{width:25px;height:25px;border-radius:50%;background:var(--olive);display:grid;place-items:center;color:#f2efd9}
      .atlas-brand-mark i{width:7px;height:7px;border:1px solid currentColor;border-radius:50%;display:block}
      .atlas-sample{color:#8b8c7a;font:500 8px 'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase}
      .atlas-notice{width:32px;height:32px;border-radius:50%;border:1px solid var(--line);background:#fffef9;color:var(--olive-deep);display:grid;place-items:center;position:relative;cursor:pointer}
      .atlas-notice:after{content:"";position:absolute;width:6px;height:6px;border:1.5px solid #fff;border-radius:50%;right:5px;top:5px;background:#b5814a}
      .atlas-visibility{margin:0 15px 9px;padding:9px 11px;min-height:54px;border:1px solid #dce1cf;border-radius:14px;background:#edf0e1;display:flex;align-items:center;gap:9px;text-align:left;width:calc(100% - 30px);cursor:pointer;color:var(--ink)}
      .atlas-visicon{width:31px;height:31px;flex:none;border-radius:10px;background:#dce3c9;color:var(--olive);display:grid;place-items:center}
      .atlas-viscopy{flex:1}.atlas-viscopy strong{font-size:11px;display:block}.atlas-viscopy small{font-size:9px;color:#737b68;display:block;margin-top:2px}
      .atlas-toggle{width:39px;height:23px;border-radius:15px;background:#b6baa9;padding:2px;display:flex;align-items:center;transition:background .22s}
      .atlas-toggle i{width:19px;height:19px;border-radius:50%;background:#fffef9;box-shadow:0 1px 3px #29312735;transition:transform .22s}
      .atlas-toggle.on{background:var(--olive)}.atlas-toggle.on i{transform:translateX(16px)}
      .atlas-map{height:437px;margin:0 11px 9px;border:1px solid #aab493;border-radius:19px;overflow:hidden;position:relative;background:#c5ceab;isolation:isolate;transition:height .32s cubic-bezier(.2,.7,.25,1);box-shadow:0 7px 19px #4952391b}
      .atlas-map-expanded{height:600px}
      .atlas-map-svg{position:absolute;inset:0;width:100%;height:100%;transition:transform .45s ease;transform:scale(1.03)}
      .atlas-map-grain{position:absolute;inset:0;pointer-events:none;opacity:.24;background-image:radial-gradient(#495739 .55px,transparent .55px);background-size:9px 9px;mix-blend-mode:multiply}
      .atlas-map-tag{position:absolute;top:12px;left:12px;display:flex;align-items:center;gap:6px;background:#f9f8edeb;border:1px solid #e4e5d5;border-radius:20px;padding:7px 9px;color:#53603c;font:600 8px 'DM Mono',monospace;letter-spacing:.06em;box-shadow:0 3px 9px #42492d18}
      .atlas-map-tag span{color:#aaa98e}
      .atlas-pooled{position:absolute;top:51px;left:12px;display:flex;align-items:center;gap:6px;border-radius:20px;background:#f9f8eddb;padding:6px 9px;color:#596346;font-size:9px;font-weight:650}
      .atlas-pooled i{width:4px;height:4px;border-radius:50%;background:#8a9668}
      .atlas-pin{position:absolute;border:1px solid #dce0cc;background:#fcfbf3;color:#35412d;border-radius:14px;padding:7px 10px 7px 8px;box-shadow:0 5px 14px #48503930;display:flex;align-items:center;gap:7px;cursor:pointer;text-align:left;white-space:nowrap;transition:transform .2s,border-color .2s,background .2s;min-height:34px}
      .atlas-pin:active{transform:scale(.97)}.atlas-pin.selected{background:var(--olive-deep);border-color:var(--olive-deep);color:#fbf9ed}
      .atlas-pin span{width:23px;height:23px;display:grid;place-items:center;border-radius:8px;background:#e9ebdc;color:var(--olive)}
      .atlas-pin.selected span{background:#67754d;color:#fff9e8}
      .atlas-pin b{font-size:9px;font-weight:750}.atlas-pin small{font-size:8px;color:#aeb99a}
      .atlas-pin-mira{left:36%;top:39%}.atlas-pin-juniper{left:5%;top:66%}.atlas-pin-cypress{right:4%;top:23%}
      .atlas-map-scale{position:absolute;bottom:11px;left:12px;display:flex;align-items:center;gap:6px;color:#64704f;font:500 8px 'DM Mono',monospace}
      .atlas-map-scale i{width:23px;height:1px;background:#68734f;position:relative}.atlas-map-scale i:before,.atlas-map-scale i:after{content:"";position:absolute;height:5px;width:1px;background:#68734f;top:-2px}.atlas-map-scale i:after{right:0}
      .atlas-expand{position:absolute;right:10px;bottom:10px;border:1px solid #d8dcc8;border-radius:20px;padding:7px 9px;background:#fbfaef;color:#53603d;display:flex;align-items:center;gap:5px;font-size:8px;font-weight:750;cursor:pointer;box-shadow:0 3px 10px #3f482b20}
      .atlas-collapse-map{position:absolute;right:10px;bottom:10px;border:1px solid #d8dcc8;border-radius:20px;padding:7px 9px;background:#fbfaef;color:#53603d;display:flex;align-items:center;gap:5px;font-size:8px;font-weight:750;cursor:pointer}
      .atlas-place-card{margin:0 14px 9px;padding:10px 11px;background:#fffef8;border:1px solid #e5e5d8;border-radius:15px;display:flex;align-items:center;gap:10px;cursor:pointer;box-shadow:0 3px 10px #4a51321a}
      .atlas-place-thumb{width:52px;height:49px;object-fit:cover;border-radius:10px}
      .atlas-place-copy{flex:1;min-width:0}.atlas-place-kicker{display:block;color:#78825d;font:600 8px 'DM Mono',monospace;letter-spacing:.06em;text-transform:uppercase}.atlas-place-copy strong{display:block;font-size:12px;letter-spacing:-.025em;margin-top:3px}.atlas-place-copy small{display:block;color:#818476;font-size:9px;margin-top:3px}
      .atlas-place-arrow{color:var(--olive)}
      .atlas-actions{display:flex;gap:8px;margin:0 14px 10px}
      .atlas-primary,.atlas-secondary{height:43px;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:7px;font-size:11px;font-weight:750;cursor:pointer}
      .atlas-primary{flex:1;border:1px solid var(--olive);background:var(--olive);color:#fffdf1;box-shadow:0 4px 9px #4957352a}
      .atlas-secondary{padding:0 13px;border:1px solid #dfe2d5;background:#fffef9;color:#596449}
      .atlas-reassure{margin:-2px 16px 11px;color:#858876;display:flex;align-items:center;gap:5px;font-size:8px}
      .atlas-section-label{margin:13px 17px 7px;display:flex;justify-content:space-between;align-items:baseline}
      .atlas-section-label strong{font:500 19px 'Newsreader',Georgia,serif;letter-spacing:-.02em}.atlas-section-label span{color:#8a8e7d;font:500 8px 'DM Mono',monospace;letter-spacing:.06em}
      .atlas-request{width:calc(100% - 28px);margin:0 14px 9px;padding:10px 11px;border:1px solid #e8dfcf;background:#f8f1e4;border-radius:14px;display:flex;gap:9px;align-items:center;text-align:left;cursor:pointer;color:var(--ink)}
      .atlas-request-icon{height:30px;width:30px;border-radius:10px;background:#eee2cd;color:#94734a;display:grid;place-items:center}
      .atlas-request-copy{flex:1}.atlas-request-copy strong{display:block;font-size:10px}.atlas-request-copy small{display:block;color:#837966;font-size:8px;margin-top:2px}
      .atlas-week{margin:0 14px 12px;background:#e8ebdc;border-radius:15px;padding:12px 13px;display:flex;align-items:center}
      .atlas-week-title{flex:1;color:#66714f;font:600 8px 'DM Mono',monospace;letter-spacing:.08em}
      .atlas-week-stat{padding-left:13px;margin-left:10px;border-left:1px solid #d0d5c1;display:flex;align-items:baseline;gap:5px}
      .atlas-week-stat b{font:500 25px/.9 'Newsreader',Georgia,serif;color:#39472d}.atlas-week-stat small{font-size:8px;color:#777d6a}
      .atlas-note{margin:0 14px 14px;padding:10px 12px;border-left:2px solid var(--olive-mid);background:#f1f1e7;border-radius:0 12px 12px 0;color:#5f6555;font:italic 14px/1.25 'Newsreader',Georgia,serif}
      .atlas-home-tabs{height:57px;flex:none;border-top:1px solid #e9e8dc;background:#fbfaf3;display:flex;align-items:center;justify-content:space-around}
      .atlas-tab{border:0;background:none;color:#909184;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:8px;cursor:pointer;min-width:58px}
      .atlas-tab.active{color:var(--olive);font-weight:750}.atlas-tab svg{width:16px;height:16px}
      .atlas-venue-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:none}.atlas-venue-scroll::-webkit-scrollbar{display:none}
      .atlas-venue-nav{height:49px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:var(--paper)}
      .atlas-round{width:31px;height:31px;border:1px solid #e1e3d5;background:#fffef8;color:#46533a;border-radius:50%;display:grid;place-items:center;cursor:pointer}
      .atlas-venue-nav span{font:500 8px 'DM Mono',monospace;letter-spacing:.12em;color:#848777}
      .atlas-venue-hero{height:237px;margin:0 11px;position:relative;border-radius:19px;overflow:hidden;background:#8d8666}
      .atlas-venue-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 47%;filter:saturate(.78) brightness(.83)}
      .atlas-venue-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#20281920 0%,transparent 32%,#242b1edb 100%)}
      .atlas-photo-tag{position:absolute;z-index:1;top:11px;left:11px;border-radius:20px;padding:6px 9px;background:#f9f7e8e8;color:#4e5b3b;font:600 8px 'DM Mono',monospace;letter-spacing:.07em}
      .atlas-photo-save{position:absolute;z-index:1;right:11px;top:10px;width:30px;height:30px;border:0;border-radius:50%;background:#fbfaee;color:#46533a;display:grid;place-items:center;cursor:pointer}
      .atlas-venue-title{position:absolute;z-index:1;left:15px;right:13px;bottom:14px;color:#fffdf0}
      .atlas-venue-title small{font:500 8px 'DM Mono',monospace;letter-spacing:.1em;color:#e1e5c8}
      .atlas-venue-title h2{margin:5px 0 7px;font:500 29px/.98 'Newsreader',Georgia,serif;letter-spacing:-.04em}
      .atlas-title-meta{display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#f1efdc}
      .atlas-rating{display:flex;gap:4px;align-items:center;color:#e5c783;font-weight:700}
      .atlas-venue-activity{margin:11px 16px 0;padding:10px 11px;background:#e8ebdc;border-radius:13px;display:flex;align-items:center;gap:9px}
      .atlas-activity-mark{width:31px;height:31px;border-radius:10px;background:#d8dfc3;color:var(--olive);display:grid;place-items:center}
      .atlas-activity-copy{flex:1}.atlas-activity-copy strong{display:block;font-size:11px}.atlas-activity-copy small{display:block;color:#777e69;font-size:8px;margin-top:2px}
      .atlas-venue-tabs{height:43px;margin:8px 16px 0;display:flex;gap:21px;border-bottom:1px solid #e3e4d7}
      .atlas-venue-tab{border:0;background:none;padding:0 1px;position:relative;color:#858879;font-size:10px;font-weight:700;cursor:pointer}
      .atlas-venue-tab.active{color:var(--olive-deep)}.atlas-venue-tab.active:after{content:"";height:2px;position:absolute;bottom:-1px;left:0;right:0;background:var(--olive);border-radius:2px}
      .atlas-venue-content{padding:11px 15px 15px;animation:atlas-in .22s ease-out}
      .atlas-reward{position:relative;overflow:hidden;border-radius:15px;padding:13px 14px;background:#e7e9d6;border:1px solid #d7ddc2}
      .atlas-reward:after{content:"";position:absolute;width:105px;height:105px;right:-38px;top:-45px;border:1px solid #9da77a77;border-radius:50%;box-shadow:0 0 0 12px #8b98651b,0 0 0 26px #8b986510}
      .atlas-reward-kicker{display:flex;align-items:center;gap:5px;color:#69784d;font:600 8px 'DM Mono',monospace;letter-spacing:.08em;text-transform:uppercase}
      .atlas-reward h3{margin:7px 0 0;font:500 21px/1 'Newsreader',Georgia,serif;color:#35432c}
      .atlas-reward p{margin:5px 0 0;color:#6c725d;font-size:9px;line-height:1.4;max-width:285px}
      .atlas-announcement{margin-top:8px;border:1px solid #e7e4d5;border-radius:13px;padding:10px 11px;background:#fffef8;display:flex;gap:9px;align-items:flex-start}
      .atlas-announce-pin{width:26px;height:26px;border-radius:9px;background:#f0ead9;color:#987b4d;display:grid;place-items:center;flex:none}
      .atlas-announcement strong{font-size:9px}.atlas-announcement p{margin:3px 0 0;color:#686e5e;font:italic 14px/1.25 'Newsreader',Georgia,serif}
      .atlas-lower-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}
      .atlas-panel{border:1px solid #e7e6d9;border-radius:13px;background:#fffef8;padding:9px 10px;min-width:0}
      .atlas-panel h3{margin:0 0 7px;font-size:9px;letter-spacing:-.02em}
      .atlas-rank{display:flex;align-items:center;gap:5px;margin-top:6px;color:#545e4b;font-size:8px}
      .atlas-rank>i{width:15px;color:#9a9c8d;font:500 8px 'DM Mono',monospace}
      .atlas-rank b{font-weight:650;flex:1;white-space:nowrap}.atlas-rank small{color:#818674;font-size:7px}
      .atlas-event-day{color:#78845a;font:600 8px 'DM Mono',monospace;letter-spacing:.08em}
      .atlas-event-title{display:block;margin-top:4px;font-size:10px;line-height:1.2}
      .atlas-event-meta{display:block;color:#7d8172;font-size:8px;margin-top:4px}
      .atlas-rsvp{margin-top:7px;border:0;border-radius:8px;background:#e9eddd;color:#4c5c39;padding:6px 8px;font-size:8px;font-weight:750;cursor:pointer}
      .atlas-guestbook{margin-top:9px;border:1px solid #e5e5d8;border-radius:13px;background:#fffef8;padding:10px 11px}
      .atlas-guestbook-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
      .atlas-guestbook-head strong{font:500 16px 'Newsreader',Georgia,serif}.atlas-guestbook-head span{color:#8a8b78;font:500 7px 'DM Mono',monospace}
      .atlas-quote{margin:0;color:#5e6456;font:italic 15px/1.3 'Newsreader',Georgia,serif}
      .atlas-quote-by{display:flex;justify-content:space-between;margin-top:7px;color:#888978;font-size:8px}
      .atlas-contact{margin-top:10px;padding:9px 1px 2px;border-top:1px solid #e6e6da;display:flex;justify-content:space-between;color:#777d6b;font-size:8px}
      .atlas-gather-card{margin-top:0;border-radius:15px;overflow:hidden;background:#fffef8;border:1px solid #e3e4d7}
      .atlas-gather-image{height:87px;position:relative}
      .atlas-gather-image img{height:100%;width:100%;object-fit:cover;object-position:center 46%;filter:saturate(.72)}
      .atlas-gather-image:after{content:"";position:absolute;inset:30% 0 0;background:linear-gradient(transparent,#22291cbf)}
      .atlas-gather-copy{padding:10px 11px}.atlas-gather-copy h3{margin:0;font:500 20px 'Newsreader',Georgia,serif}.atlas-gather-copy p{margin:4px 0 8px;color:#7a7e6c;font-size:9px}
      .atlas-gather-action{height:34px;border:1px solid #d9dfc7;background:#edf0e2;color:#50603b;border-radius:10px;padding:0 11px;font-size:9px;font-weight:750;cursor:pointer}
      .atlas-guest-list{display:grid;gap:8px}
      .atlas-guest-note{border-radius:13px;background:#f1f1e8;padding:12px 13px;border-left:2px solid #889469}
      .atlas-guest-note p{margin:0;color:#5e6455;font:italic 17px/1.25 'Newsreader',Georgia,serif}
      .atlas-guest-note small{display:block;margin-top:8px;color:#868876;font:500 8px 'DM Mono',monospace}
      .atlas-venue-bottom{height:60px;flex:none;border-top:1px solid #e6e6d9;background:#fbfaf3;padding:7px 13px;display:flex;align-items:center;gap:8px}
      .atlas-bottom-hours{flex:1;color:#707867;font-size:8px}.atlas-bottom-hours strong{display:block;color:#35432c;font-size:9px;margin-bottom:2px}
      .atlas-bottom-check{height:40px;border:0;border-radius:11px;background:var(--olive);color:#fffdf1;padding:0 14px;display:flex;align-items:center;gap:7px;font-size:10px;font-weight:750;cursor:pointer}
      .atlas-overlay{position:absolute;inset:30px 0 0;z-index:10;background:#22291d70;display:flex;align-items:center;justify-content:center;padding:22px;animation:atlas-in .2s ease-out}
      .atlas-sheet{width:100%;border-radius:20px;padding:18px;background:#fbfaf2;box-shadow:0 20px 55px #20271842;position:relative}
      .atlas-sheet-close{position:absolute;right:13px;top:13px;width:28px;height:28px;border:0;border-radius:50%;background:#eceee2;color:#596449;display:grid;place-items:center;cursor:pointer}
      .atlas-sheet-symbol{width:38px;height:38px;border-radius:13px;background:#e5e9d7;color:var(--olive);display:grid;place-items:center;margin-bottom:10px}
      .atlas-sheet h3{margin:0;font:500 24px 'Newsreader',Georgia,serif;letter-spacing:-.02em;color:#35432c}
      .atlas-sheet p{margin:6px 0 14px;color:#767b6a;font-size:11px;line-height:1.45}
      .atlas-sheet-actions{display:flex;gap:8px}.atlas-sheet-actions button{height:39px;flex:1;border:1px solid #dfe2d4;border-radius:11px;background:#fffef8;color:#586249;font-size:10px;font-weight:750;cursor:pointer}
      .atlas-sheet-actions button:last-child{background:var(--olive);border-color:var(--olive);color:#fffdf1}
      .atlas-feedback{position:absolute;z-index:14;bottom:69px;left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100% - 28px);white-space:normal;text-align:center;border-radius:13px;padding:10px 13px;background:#35432c;color:#fffdf1;font-size:9px;font-weight:650;box-shadow:0 8px 20px #1e291f35;animation:atlas-in .2s ease-out}
      @keyframes atlas-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      @media(prefers-reduced-motion:reduce){.atlas-board *,.atlas-board *:before,.atlas-board *:after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
      @media(max-width:760px){.atlas-board{width:100%;height:auto;min-height:100dvh;overflow:visible;padding:18px 14px 28px}.atlas-head{height:auto;margin:0 4px 18px;align-items:flex-start;gap:8px}.atlas-head h1{font-size:23px}.atlas-head-note{max-width:145px;font-size:9px}.atlas-screens{flex-direction:column;align-items:center;gap:22px}.atlas-device{width:min(440px,100%);flex-basis:auto}.atlas-shell{height:min(887px,calc(100dvh - 90px));min-height:730px}}
    `}</style>
    <header className="atlas-head">
      <div><div className="atlas-head-mark"><i /> MET / ATLAS STUDY</div><h1>The neighborhood, unfolded.</h1></div>
      <div className="atlas-head-note">A place-led way to find your way in.<br /><b style={{ color: "#5c6944" }}>MAPPING PLACES, NOT PEOPLE</b></div>
    </header>
    <div className="atlas-screens">
      <Phone title="01 / Atlas · neighborhood map">
        <div className="atlas-scroll">
          <div className="atlas-home-head">
            <div className="atlas-brand"><span className="atlas-brand-mark"><i /></span> met</div>
            <span className="atlas-sample">SAMPLE DAY · RIVER DISTRICT</span>
            <button className="atlas-notice" aria-label="Open connection request" onClick={() => setRequestOpen(true)}><MessageCircle size={15} /></button>
          </div>
          <button className="atlas-visibility" onClick={() => setVisible(!visible)} aria-pressed={visible}>
            <span className="atlas-visicon"><Radio size={16} /></span>
            <span className="atlas-viscopy"><strong>{visible ? "Visible to nearby guests" : "Visibility is off"}</strong><small>{visible ? "Only when you choose · private by choice" : "Turn on whenever you feel ready"}</small></span>
            <span className={`atlas-toggle ${visible ? "on" : ""}`}><i /></span>
          </button>
          <CityMap expanded={expanded} selected={selected} onSelect={(name) => name === "__collapse" ? setExpanded(false) : setSelected(name)} onExpand={() => setExpanded(true)} />
          <button className="atlas-place-card" onClick={() => setSelected(selected === "Mira House" ? "Juniper Market" : "Mira House")}>
            <img className="atlas-place-thumb" src="/__mockup/images/coffee-shop.png" alt="Mira House Coffee, a sample neighborhood café" />
            <span className="atlas-place-copy"><span className="atlas-place-kicker">Selected place · 1.2 km</span><strong>{selected === "Mira House" ? "Mira House Coffee" : selected}</strong><small>{selected === "Mira House" ? "Coffee & bakery · 86 this week" : "Public place · pooled sample activity"}</small></span>
            <ChevronRight className="atlas-place-arrow" size={17} />
          </button>
          <div className="atlas-actions">
            <button className="atlas-primary" onClick={() => setCheckinOpen(true)}><ScanLine size={15} /> Check in</button>
            <button className="atlas-secondary" onClick={() => inform("Local leaderboard preview · sample visits only.")}><Sparkles size={14} /> Regulars</button>
          </div>
          <div className="atlas-reassure"><ShieldCheck size={11} /> Activity is grouped by public venue, never individual location.</div>
          <button className="atlas-request" onClick={() => setRequestOpen(true)}>
            <span className="atlas-request-icon"><Users size={15} /></span>
            <span className="atlas-request-copy"><strong>One connection request</strong><small>Review it privately, on your terms</small></span><ChevronRight size={15} color="#8b8b79" />
          </button>
          <div className="atlas-week"><span className="atlas-week-title">YOUR WEEK<br />AROUND PLACES</span><span className="atlas-week-stat"><b>3</b><small>new</small></span><span className="atlas-week-stat"><b>2</b><small>familiar again</small></span></div>
          <div className="atlas-note">“The community table is open all weekend.”<small style={{ display: "block", font: "500 8px 'DM Mono',monospace", marginTop: 6, color: "#858978" }}>MIRA HOUSE · SAMPLE VENUE NOTE</small></div>
        </div>
        <nav className="atlas-home-tabs" aria-label="Home navigation">
          {[[MapPin,"Home"],[Compass,"Places"],[Users,"Requests"],[Heart,"Saved"]].map(([Icon,label]) => <button key={label as string} className={`atlas-tab ${tab === label ? "active" : ""}`} onClick={() => { setTab(label as string); if (label === "Requests") setRequestOpen(true); else if (label === "Saved") inform(saved ? "Mira House is in your saved places." : "Save a place from its profile to find it later."); else if (label === "Places") setExpanded(true); }}><Icon size={16} /><span>{label as string}</span></button>)}
        </nav>
        {requestOpen && <div className="atlas-overlay"><div className="atlas-sheet"><button className="atlas-sheet-close" aria-label="Close request" onClick={() => setRequestOpen(false)}><X size={15} /></button><span className="atlas-sheet-symbol"><Users size={18} /></span><h3>A request to connect</h3><p>Jordan would like to reconnect after a shared visit nearby. Nothing is shared until you decide. Sample request only.</p><div className="atlas-sheet-actions"><button onClick={() => setRequestOpen(false)}>Not now</button><button onClick={() => { setRequestOpen(false); inform("Request review is a local sample · no connection made."); }}>Review privately</button></div></div></div>}
        {checkinOpen && <div className="atlas-overlay"><div className="atlas-sheet"><button className="atlas-sheet-close" aria-label="Close check-in preview" onClick={() => setCheckinOpen(false)}><X size={15} /></button><span className="atlas-sheet-symbol"><ScanLine size={18} /></span><h3>Arrive at a place</h3><p>Check in at {selected === "Mira House" ? "Mira House Coffee" : selected} to start a local connection. This is a preview; no visit is saved.</p><div className="atlas-sheet-actions"><button onClick={() => setCheckinOpen(false)}>Keep exploring</button><button onClick={() => { setCheckinOpen(false); inform("Preview only · no visit saved."); }}>Preview check-in</button></div></div></div>}
        {notice && <div className="atlas-feedback">{notice}</div>}
      </Phone>

      <Phone title="02 / Arrival · Mira House Coffee">
        <div className="atlas-venue-scroll">
          <div className="atlas-venue-nav"><button className="atlas-round" aria-label="Back to neighborhood" onClick={() => inform("Back to the River District map preview.")}><ArrowLeft size={15} /></button><span>RIVER DISTRICT · SAMPLE PLACE</span><button className="atlas-round" aria-label={saved ? "Remove saved place" : "Save place"} onClick={() => setSaved(!saved)}><Bookmark size={14} fill={saved ? "#526038" : "none"} color={saved ? "#526038" : "currentColor"} /></button></div>
          <div className="atlas-venue-hero">
            <img src="/__mockup/images/coffee-shop.png" alt="Warm interior at Mira House Coffee" />
            <span className="atlas-photo-tag">A NEIGHBORHOOD PLACE</span>
            <button className="atlas-photo-save" aria-label={saved ? "Unsave Mira House" : "Save Mira House"} onClick={() => setSaved(!saved)}><Heart size={15} fill={saved ? "#526038" : "none"} /></button>
            <div className="atlas-venue-title"><small>COFFEE · BAKERY · RIVER DISTRICT</small><h2>Mira House Coffee</h2><div className="atlas-title-meta"><span>Slow mornings, shared tables</span><span className="atlas-rating"><Star size={11} fill="currentColor" /> 4.9 <span style={{ color: "#ede9d8", fontWeight: 400 }}>(128)</span></span></div></div>
          </div>
          <div className="atlas-venue-activity"><span className="atlas-activity-mark"><Users size={15} /></span><span className="atlas-activity-copy"><strong>86 visits this week</strong><small>Shared place activity · sample total</small></span><ShieldCheck size={15} color="#748052" /></div>
          <div className="atlas-venue-tabs" role="tablist">
            {([["story","The place"],["gather","Gather"],["guestbook","Guestbook"]] as [VenueSection,string][]).map(([key,label]) => <button role="tab" aria-selected={venueSection === key} key={key} className={`atlas-venue-tab ${venueSection === key ? "active" : ""}`} onClick={() => setVenueSection(key)}>{label}</button>)}
          </div>
          <div className="atlas-venue-content" key={venueSection}>
            {venueSection === "story" && <>
              <div className="atlas-reward"><div className="atlas-reward-kicker"><Sparkles size={11} /> A thank-you for showing up</div><h3>Coffee &amp; pastry for two</h3><p>Mira House regular · a little something to share on a future visit.</p></div>
              <div className="atlas-announcement"><span className="atlas-announce-pin"><MapPin size={13} /></span><span><strong>A note from the team</strong><p>“The community table is open all weekend. Come say hello.”</p></span></div>
              <div className="atlas-lower-grid">
                <section className="atlas-panel"><h3>Neighborhood regulars</h3><div className="atlas-rank"><i>01</i><b>Taylor M.</b><small>12 visits</small></div><div className="atlas-rank"><i>02</i><b>Jordan E.</b><small>9 visits</small></div><div className="atlas-rank"><i>03</i><b>Alex H.</b><small>7 visits</small></div></section>
                <section className="atlas-panel"><div className="atlas-event-day">SAT · 10 AM</div><strong className="atlas-event-title">Vinyl &amp; Slow Pour</strong><small className="atlas-event-meta">31 going · sample event</small><button className="atlas-rsvp" onClick={() => setRsvp(!rsvp)}>{rsvp ? "Saved to your plans" : "Save event"}</button></section>
              </div>
              <div className="atlas-guestbook"><div className="atlas-guestbook-head"><strong>From the guestbook</strong><span>4.9 · 128 NOTES</span></div><p className="atlas-quote">“A lovely place to slow down and meet the neighborhood.”</p><div className="atlas-quote-by"><span>Taylor M. · 2 days ago</span><span>★★★★★</span></div></div>
              <div className="atlas-contact"><span><Clock3 size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />Today · open until 6 pm</span><span>Contact · (415) 555-0142</span></div>
            </>}
            {venueSection === "gather" && <>
              <div className="atlas-gather-card"><div className="atlas-gather-image"><img src="/__mockup/images/coffee-shop.png" alt="Mira House community table" /></div><div className="atlas-gather-copy"><span className="atlas-event-day">THIS SATURDAY · 10:00 AM</span><h3>Vinyl &amp; Slow Pour</h3><p>Bring a record, meet a neighbor, stay for a cup. 31 going · sample event.</p><button className="atlas-gather-action" onClick={() => setRsvp(!rsvp)}>{rsvp ? "Saved to your plans" : "Save event"}</button></div></div>
              <div className="atlas-announcement" style={{ marginTop: 10 }}><span className="atlas-announce-pin"><MessageCircle size={13} /></span><span><strong>From the team</strong><p>“The community table is open all weekend. Come say hello.”</p></span></div>
              <p style={{ color: "#7b806e", fontSize: 10, lineHeight: 1.5, margin: "12px 2px" }}>A low-key Saturday with good records and careful coffee. Drop by when it suits you.</p>
            </>}
            {venueSection === "guestbook" && <>
              <div className="atlas-guest-list">
                <article className="atlas-guest-note"><p>“A lovely place to slow down and meet the neighborhood.”</p><small>TAYLOR M. · 2 DAYS AGO · SAMPLE NOTE</small></article>
                <article className="atlas-guest-note"><p>“The cardamom bun is worth taking the long way for.”</p><small>JORDAN E. · LAST WEEK · SAMPLE NOTE</small></article>
                <article className="atlas-guest-note"><p>“Staff remembered my name, and the window seat is perfect.”</p><small>CASEY R. · 2 WEEKS AGO · SAMPLE NOTE</small></article>
              </div>
              <div style={{ marginTop: 12, color: "#7e826f", fontSize: 9, display: "flex", alignItems: "center", gap: 5 }}><ShieldCheck size={12} color="#748052" /> Guestbook notes are illustrative sample content.</div>
            </>}
          </div>
        </div>
        <div className="atlas-venue-bottom"><span className="atlas-bottom-hours"><strong>Open today · 7 am–6 pm</strong>River District · 1.2 km</span><button className="atlas-bottom-check" onClick={() => setCheckinOpen(true)}><ScanLine size={14} /> Check in</button></div>
        {checkinOpen && <div className="atlas-overlay"><div className="atlas-sheet"><button className="atlas-sheet-close" aria-label="Close check-in preview" onClick={() => setCheckinOpen(false)}><X size={15} /></button><span className="atlas-sheet-symbol"><ScanLine size={18} /></span><h3>Check in at Mira House?</h3><p>This sample lets you preview arrival. No visit is saved and nothing is sent.</p><div className="atlas-sheet-actions"><button onClick={() => setCheckinOpen(false)}>Not now</button><button onClick={() => { setCheckinOpen(false); inform("Preview only · no visit saved."); }}>Preview check-in</button></div></div></div>}
        {notice && <div className="atlas-feedback">{notice}</div>}
      </Phone>
    </div>
    <footer style={{ textAlign: "center", color: "#898b78", font: "500 8px 'DM Mono',monospace", letterSpacing: ".08em", marginTop: 9 }}>SAFE SAMPLE CONTENT · POOLED VENUE ACTIVITY · ALL PREVIEW ACTIONS STAY LOCAL</footer>
  </main>;
}
