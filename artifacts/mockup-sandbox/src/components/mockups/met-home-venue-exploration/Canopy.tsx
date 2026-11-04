import { useState, type ReactNode } from "react";
import {
  ArrowDownRight, ArrowLeft, ArrowRight, Award, Bookmark, CalendarDays, Check,
  ChevronDown, ChevronRight, Clock3, Coffee, Compass, Heart, MapPin, MoreHorizontal,
  Navigation, Radio, ScanLine, ShieldCheck, Star, Users, Wifi, X,
} from "lucide-react";

type IconProps = { children: ReactNode; label: string; onClick: () => void };

function RoundButton({ children, label, onClick }: IconProps) {
  return <button className="canopy-round" aria-label={label} onClick={onClick}>{children}</button>;
}

function Phone({ label, children }: { label: string; children: ReactNode }) {
  return <section className="canopy-device">
    <div className="canopy-device-label"><strong>{label}</strong><span>MET · SAMPLE VIEW</span></div>
    <div className="canopy-frame">
      <div className="canopy-screen">
        <div className="canopy-status">
          <span>9:41</span><i className="canopy-island" />
          <span className="canopy-status-icons"><Wifi size={13}/><i /></span>
        </div>
        {children}
        <div className="canopy-home-indicator" />
      </div>
    </div>
  </section>;
}

function StreetMap({ expanded, visible, selected, onSelect }: {
  expanded: boolean; visible: boolean; selected: string; onSelect: (name: string) => void;
}) {
  return <div className={`canopy-map-art ${expanded ? "map-expanded" : ""}`} role="img" aria-label="Illustrated River District street map with public venue markers">
    <svg className="canopy-streets" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="250" fill="#a9b18b"/>
      <path d="M-20 183 C48 152 82 163 130 130 S218 109 263 70 S344 46 423 16" fill="none" stroke="#c7d1a6" strokeWidth="46"/>
      <path d="M-20 183 C48 152 82 163 130 130 S218 109 263 70 S344 46 423 16" fill="none" stroke="#dce2c6" strokeWidth="2"/>
      <path d="M-20 48 L420 211 M20 -22 L234 270 M150 -25 L99 278 M299 -28 L357 280 M-20 115 L420 105 M-20 230 L420 25" fill="none" stroke="#dce1c4" strokeWidth="17"/>
      <path d="M-20 48 L420 211 M20 -22 L234 270 M150 -25 L99 278 M299 -28 L357 280 M-20 115 L420 105 M-20 230 L420 25" fill="none" stroke="#78845f" strokeWidth="1.3" opacity=".56"/>
      <path d="M-15 48 L415 211 M25 -20 L239 270 M155 -20 L104 278 M304 -20 L362 280 M-20 110 L420 100 M-20 225 L420 20" fill="none" stroke="#f0ecd9" strokeWidth="1" strokeDasharray="3 5" opacity=".8"/>
      <path d="M265 0 C287 31 276 51 304 76 S330 124 355 148 S373 199 407 232" fill="none" stroke="#899b7b" strokeWidth="20" opacity=".75"/>
      <path d="M265 0 C287 31 276 51 304 76 S330 124 355 148 S373 199 407 232" fill="none" stroke="#bdc9a4" strokeWidth="1"/>
      <path d="M19 15h46v32H19z M95 68h38v23H95z M183 24h44v34h-44z M336 86h45v29h-45z M30 204h50v30H30z M232 180h37v29h-37z M284 177h44v28h-44z" fill="#87936e" opacity=".48"/>
      <path d="M18 13h48v34H18z M93 66h40v25H93z M181 22h46v36h-46z M334 84h47v31h-47z M28 202h52v32H28z M230 178h39v30h-39z M282 175h46v30h-46z" fill="none" stroke="#dce1c1" strokeWidth="1"/>
    </svg>
    <span className="map-district district-one">RIVER DISTRICT</span>
    <span className="map-district district-two">WILLOW WALK</span>
    <span className="map-district district-three">OLD MARKET</span>
    <span className="map-park"><i/>Civic green</span>
    <button className={`map-pin map-pin-mira ${selected === "Mira House Coffee" ? "selected" : ""}`} onClick={() => onSelect("Mira House Coffee")} aria-label="Select Mira House Coffee">
      <Coffee size={14}/><span>Mira House</span>
    </button>
    <button className={`map-pin map-pin-juniper ${selected === "Juniper Market" ? "selected" : ""}`} onClick={() => onSelect("Juniper Market")} aria-label="Select Juniper Market"><MapPin size={13}/></button>
    <button className={`map-pin map-pin-cypress ${selected === "Cypress Books" ? "selected" : ""}`} onClick={() => onSelect("Cypress Books")} aria-label="Select Cypress Books"><MapPin size={13}/></button>
    <div className="map-me" aria-label="Your approximate area"><i/><span>you</span></div>
    <span className="map-activity-dot activity-a"/><span className="map-activity-dot activity-b"/><span className="map-activity-dot activity-c"/>
    <div className="map-scale"><span/>400 m</div>
    <div className="map-trust"><ShieldCheck size={11}/> Venue activity pooled · no live guest pins</div>
    {expanded && <div className="map-expanded-heading"><span>YOUR NEIGHBORHOOD</span><strong>Find a place to begin.</strong></div>}
    {!visible && <div className="map-quiet"><Radio size={13}/> Your visibility is paused</div>}
  </div>;
}

export function Canopy() {
  const [visible, setVisible] = useState(true);
  const [expandedMap, setExpandedMap] = useState(false);
  const [selected, setSelected] = useState("Mira House Coffee");
  const [requestOpen, setRequestOpen] = useState(false);
  const [homeSheet, setHomeSheet] = useState<"checkin" | "directions" | "none">("none");
  const [venueSheet, setVenueSheet] = useState<"checkin" | "directions" | "none">("none");
  const [venueSaved, setVenueSaved] = useState(false);
  const [rsvp, setRsvp] = useState(false);
  const [venueTab, setVenueTab] = useState<"today" | "gather" | "guestbook">("today");
  const [savedTab, setSavedTab] = useState(false);

  const selectedMeta = selected === "Mira House Coffee"
    ? { visits: "86", distance: "0.8 mi", type: "Coffee · bakery" }
    : selected === "Juniper Market"
      ? { visits: "64", distance: "0.4 mi", type: "Market · pantry" }
      : { visits: "42", distance: "0.6 mi", type: "Books · neighborhood" };

  return <main className="canopy-board">
    <style>{`
      .canopy-board, .canopy-board * { box-sizing:border-box; }
      .canopy-board {
        --olive-950:#27311f; --olive-900:#35432a; --olive-800:#4b5c36; --olive-700:#607344;
        --olive-600:#788953; --olive-500:#929d68; --olive-300:#c1c99a; --olive-200:#d8ddbd;
        --olive-100:#e8ebd6; --olive-50:#f2f3e8; --paper:#f6f4e8; --cream:#fcfbf4;
        --ink:#263022; --muted:#777c68; --line:#dfe1ce; --sun:#dbbd69; --clay:#b87958;
        width:1120px;height:1020px;overflow:hidden;padding:20px 43px 16px;
        background:
          radial-gradient(ellipse at 50% -30%,rgba(255,255,255,.9),transparent 60%),
          #e7e9d9;
        color:var(--ink);font-family:'DM Sans',system-ui,sans-serif;position:relative;isolation:isolate;
      }
      .canopy-board:before { content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.12;background-image:radial-gradient(#6a7453 .6px,transparent .6px);background-size:8px 8px; }
      .canopy-board button { font:inherit; }
      .canopy-heading { max-width:900px;margin:0 auto 12px;display:flex;align-items:end;justify-content:space-between; }
      .canopy-eyebrow { display:flex;align-items:center;gap:8px;color:var(--olive-800);font-size:9px;font-weight:800;letter-spacing:.17em; }
      .canopy-mark { width:16px;height:16px;position:relative;border-radius:50%;background:var(--olive-800); }
      .canopy-mark:before { content:"";position:absolute;width:5px;height:9px;left:6px;top:3px;border-radius:100% 0 100% 0;background:#dce1bb;transform:rotate(22deg); }
      .canopy-heading h1 { margin:5px 0 0;font:500 24px/1 'Fraunces',Georgia,serif;letter-spacing:-.035em;color:var(--olive-950); }
      .canopy-head-note { color:#727962;font:500 9px/1.5 'DM Mono',monospace;letter-spacing:.035em;text-align:right; }
      .canopy-pair { display:flex;justify-content:center;align-items:flex-start;gap:30px; }
      .canopy-device { width:390px;flex:0 0 390px; }
      .canopy-device-label { height:22px;padding:0 6px 5px;display:flex;align-items:center;justify-content:space-between;color:#4f5a3d; }
      .canopy-device-label strong { font-size:11px;letter-spacing:.015em; }
      .canopy-device-label span { font:500 7px 'DM Mono',monospace;letter-spacing:.13em;color:#899078; }
      .canopy-frame { height:900px;border-radius:39px;padding:7px;background:#272a21;border:1px solid rgba(255,255,255,.84);box-shadow:0 20px 48px rgba(53,62,36,.2),0 3px 9px rgba(35,43,26,.12); }
      .canopy-screen { height:100%;position:relative;overflow:hidden;display:flex;flex-direction:column;border-radius:32px;background:var(--cream); }
      .canopy-status { height:31px;flex:0 0 31px;position:relative;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:0 19px;color:#273020;font-size:9px;font-weight:800;background:var(--cream); }
      .canopy-island { position:absolute;left:50%;top:5px;transform:translateX(-50%);width:82px;height:18px;border-radius:20px;background:#1d201b; }
      .canopy-status-icons { display:flex;align-items:center;gap:5px; }
      .canopy-status-icons i { width:15px;height:8px;border:1px solid currentColor;border-radius:2px;position:relative; }
      .canopy-status-icons i:before { content:"";position:absolute;inset:1px 4px 1px 1px;background:currentColor;border-radius:1px; }
      .canopy-home-indicator { position:absolute;z-index:8;bottom:5px;left:50%;transform:translateX(-50%);width:93px;height:4px;border-radius:5px;background:#24281f;opacity:.7;pointer-events:none; }
      .canopy-scroll { flex:1;min-height:0;overflow:auto;scrollbar-width:none;overscroll-behavior:contain; }
      .canopy-scroll::-webkit-scrollbar { display:none; }
      .home-nav { height:43px;display:flex;align-items:center;justify-content:space-between;padding:0 18px; }
      .brand-lockup { display:flex;align-items:center;gap:7px;font-weight:800;font-size:17px;letter-spacing:-.075em;color:var(--olive-950); }
      .brand-leaf { width:23px;height:23px;background:var(--olive-800);border-radius:8px 8px 8px 3px;display:grid;place-items:center;color:#f4f3e5; }
      .sample-chip { color:#82886e;font:500 7px 'DM Mono',monospace;letter-spacing:.12em;text-transform:uppercase; }
      .canopy-round { border:1px solid #dfe2d1;background:#f8f8ef;color:#46513a;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;cursor:pointer;transition:transform .18s,background .18s; }
      .canopy-round:hover { transform:translateY(-1px);background:white; }
      .home-welcome { padding:4px 18px 10px;display:flex;align-items:end;justify-content:space-between; }
      .home-welcome small { display:block;color:var(--olive-700);font:700 8px 'DM Mono',monospace;letter-spacing:.11em; }
      .home-welcome h2 { margin:5px 0 0;font:500 24px/.98 'Fraunces',Georgia,serif;letter-spacing:-.035em;color:var(--olive-950); }
      .nearby-count { text-align:right;padding-bottom:1px; }
      .nearby-count b { display:block;color:var(--olive-800);font:500 25px/.9 'Fraunces',Georgia,serif; }
      .nearby-count span { display:block;margin-top:5px;font-size:8px;color:#7d836b; }
      .visibility-control { margin:0 14px 10px;padding:9px 11px;min-height:54px;border-radius:16px;background:var(--olive-900);color:#f9f7e9;display:flex;align-items:center;gap:9px;box-shadow:0 7px 16px rgba(51,64,37,.15); }
      .visibility-symbol { width:30px;height:30px;border-radius:11px;background:rgba(227,232,196,.14);display:grid;place-items:center;color:#d5dcb0;flex:none; }
      .visibility-copy { flex:1;min-width:0; }
      .visibility-copy strong { display:block;font-size:10px;font-weight:700; }
      .visibility-copy small { display:block;margin-top:3px;color:#d0d5b7;font-size:7.5px; }
      .visibility-toggle { width:39px;height:23px;border:0;border-radius:14px;padding:3px;background:#747b64;cursor:pointer;flex:none;transition:background .2s; }
      .visibility-toggle.on { background:#c5ce91; }
      .visibility-toggle i { width:17px;height:17px;background:#fffdf2;border-radius:50%;display:block;box-shadow:0 1px 4px #17201244;transition:transform .2s; }
      .visibility-toggle.on i { transform:translateX(16px); }
      .map-shell { margin:0 13px 9px;height:219px;border-radius:20px;position:relative;overflow:hidden;background:#a9b18b;box-shadow:0 7px 18px rgba(70,83,47,.18); }
      .canopy-map-art { position:absolute;inset:0;overflow:hidden;background:#a9b18b; }
      .canopy-streets { position:absolute;inset:0;width:100%;height:100%; }
      .map-district { position:absolute;color:#46523a;font:700 6.5px 'DM Mono',monospace;letter-spacing:.11em;opacity:.8; }
      .district-one { top:13%;left:10%; }.district-two { top:63%;left:41%; }.district-three { top:78%;right:8%; }
      .map-park { position:absolute;left:68%;top:17%;width:56px;height:34px;border-radius:12px;background:#8a9b72;color:#eff0d9;font-size:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;transform:rotate(-12deg); }
      .map-park i { width:14px;height:7px;border:1px solid #d3dbb6;border-radius:70% 10% 70% 10%;transform:rotate(-25deg); }
      .map-pin { position:absolute;z-index:2;border:0;background:#f9f8ea;color:#455435;box-shadow:0 4px 12px #29321d3b;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .18s,background .18s; }
      .map-pin-mira { left:45%;top:42%;gap:5px;border-radius:12px 12px 12px 4px;padding:7px 9px;font-size:8px;font-weight:800; }
      .map-pin-mira.selected { color:#f9f8eb;background:var(--olive-800);transform:translateY(-2px); }
      .map-pin-juniper { left:18%;top:65%;width:29px;height:29px;border-radius:10px 10px 10px 2px; }
      .map-pin-cypress { right:14%;top:34%;width:27px;height:27px;border-radius:9px 9px 9px 2px; }
      .map-me { position:absolute;left:28%;top:27%;width:22px;height:22px;border-radius:50%;background:#eef0d8d9;border:1px solid #4c5c37;display:grid;place-items:center; }
      .map-me i { width:7px;height:7px;background:#657848;border-radius:50%;box-shadow:0 0 0 4px #d3dbab; }
      .map-me span { position:absolute;top:23px;color:#47533a;font-size:6px;font-weight:700; }
      .map-activity-dot { position:absolute;width:7px;height:7px;border:1px solid #f7f4db;border-radius:50%;background:#be855b;box-shadow:0 0 0 4px #d4c9908a; }
      .activity-a { left:69%;top:69%; }.activity-b { left:33%;top:74%;background:#768451; }.activity-c { left:83%;top:54%;background:#a56d4d; }
      .map-scale { position:absolute;right:10px;bottom:37px;color:#445139;font:600 6px 'DM Mono',monospace;display:flex;align-items:center;gap:4px; }
      .map-scale span { width:18px;height:4px;border-top:1px solid #48543b;border-left:1px solid #48543b;border-right:1px solid #48543b; }
      .map-trust { position:absolute;left:9px;bottom:8px;padding:5px 7px;border-radius:8px;background:#f7f6e8e8;color:#566047;display:flex;align-items:center;gap:4px;font-size:6px;font-weight:600; }
      .map-expand { position:absolute;right:9px;top:9px;z-index:3;height:29px;border:1px solid #fff9;border-radius:10px;background:#f8f7e8;color:#435137;padding:0 9px;display:flex;align-items:center;gap:5px;font-size:7px;font-weight:800;cursor:pointer;box-shadow:0 2px 7px #26301d24; }
      .map-quiet { position:absolute;z-index:4;right:8px;bottom:8px;background:#39472b;color:#f5f2df;border-radius:9px;padding:6px 8px;display:flex;align-items:center;gap:4px;font-size:7px; }
      .next-place { margin:0 14px 9px;padding:10px 11px;border:1px solid #dfe2d0;border-radius:16px;background:#fffef6;display:flex;align-items:center;gap:9px; }
      .place-photo { width:47px;height:47px;border-radius:12px;object-fit:cover;flex:none; }
      .place-copy { flex:1;min-width:0; }
      .place-copy small { color:#86896f;font:700 6.5px 'DM Mono',monospace;letter-spacing:.1em; }
      .place-copy strong { display:block;color:#313c29;font-size:11px;margin-top:3px; }
      .place-copy span { display:block;color:#747b66;font-size:7.5px;margin-top:3px; }
      .place-arrow { color:var(--olive-700); }
      .home-primary-row { display:flex;gap:8px;margin:0 14px 10px; }
      .checkin-button { height:42px;border:0;border-radius:13px;background:var(--olive-800);color:#fffdf1;display:flex;align-items:center;justify-content:center;gap:7px;font-size:10px;font-weight:800;cursor:pointer;box-shadow:0 5px 12px #41532e2d;transition:transform .16s; }
      .checkin-button:active { transform:scale(.98); }
      .home-primary-row .checkin-button { flex:1; }
      .nearby-cta { width:43px;height:42px;border:1px solid #dfe2d1;border-radius:13px;background:#fffef6;color:#566342;display:grid;place-items:center;cursor:pointer; }
      .request-line { width:calc(100% - 28px);margin:0 14px 10px;border:0;padding:0;background:transparent;color:#323c2c;text-align:left;display:flex;align-items:center;gap:9px;cursor:pointer; }
      .request-icon { width:31px;height:31px;border-radius:11px;background:#ebe9d6;color:#677448;display:grid;place-items:center; }
      .request-line strong { display:block;font-size:9px; }.request-line small { display:block;font-size:7px;color:#858875;margin-top:2px; }
      .request-line > svg:last-child { margin-left:auto;color:#889076; }
      .request-expanded { margin:-4px 14px 9px;padding:9px 10px;border-radius:12px;background:#f0efdf;border:1px solid #e1e1ca;animation:canopy-reveal .24s ease; }
      .request-expanded strong { font:500 15px 'Fraunces',Georgia,serif; }.request-expanded p { margin:4px 0 7px;font-size:7.5px;line-height:1.45;color:#6c725d; }
      .request-expanded button { border:0;background:var(--olive-800);color:#fff;border-radius:8px;padding:7px 9px;font-size:7px;font-weight:700;cursor:pointer; }
      .week-strip { margin:0 14px 13px;padding:10px 11px;border-radius:15px;background:#e8ebd6;display:flex;align-items:center;justify-content:space-between; }
      .week-intro { font-size:8px;font-weight:800;color:#47563a; }.week-intro small { display:block;font-weight:500;color:#777f63;margin-top:3px;font-size:7px; }
      .week-numbers { display:flex;align-items:center;gap:12px; }
      .week-number b { font:500 19px/.9 'Fraunces',Georgia,serif;color:#455534; }.week-number span { display:block;margin-top:3px;color:#777f65;font-size:6px; }
      .saved-view { padding:12px 16px 24px;animation:canopy-reveal .22s ease; }
      .saved-view > small { color:#687a49;font:700 7px 'DM Mono',monospace;letter-spacing:.12em; }
      .saved-view h2 { margin:8px 0 5px;color:#303a28;font:500 26px/1 'Fraunces',Georgia,serif; }
      .saved-view p { margin:0 0 16px;color:#747a65;font-size:9px;line-height:1.5; }
      .saved-empty { margin:14px 0;padding:17px 14px;border-radius:17px;background:#e9ebd8;color:#4f5e3c;text-align:center; }
      .saved-empty i { width:40px;height:40px;border-radius:14px;background:#d8dfbf;display:grid;place-items:center;margin:0 auto 9px;color:#5e7242; }
      .saved-empty strong { display:block;font:500 18px 'Fraunces',Georgia,serif; }
      .saved-empty span { display:block;margin-top:4px;color:#7a8069;font-size:8px;line-height:1.45; }
      .saved-action { width:100%;height:40px;border:0;border-radius:12px;background:var(--olive-800);color:#fffdf1;font-size:9px;font-weight:800;cursor:pointer; }
      .home-tabs { height:49px;flex:none;border-top:1px solid #e8e8d9;background:#fcfbf4;display:flex;align-items:center;justify-content:space-around; }
      .home-tab { border:0;background:none;color:#858a77;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:6.5px;cursor:pointer;padding:5px 12px; }
      .home-tab.active { color:var(--olive-800);font-weight:800; }
      .map-mode { position:absolute;z-index:7;inset:31px 0 0;background:#a9b18b;animation:map-arrive .33s cubic-bezier(.2,.75,.25,1); }
      .map-mode .canopy-map-art { inset:0; }
      .map-mode .canopy-streets { width:100%;height:100%; }
      .map-expanded-heading { position:absolute;z-index:2;left:18px;right:18px;top:16px;color:#f8f7e9;text-shadow:0 2px 8px #29341d65; }
      .map-expanded-heading span { display:block;font:700 7px 'DM Mono',monospace;letter-spacing:.15em; }
      .map-expanded-heading strong { display:block;font:500 23px 'Fraunces',Georgia,serif;margin-top:4px; }
      .expanded-close { position:absolute;z-index:5;top:14px;right:15px;width:34px;height:34px;border:1px solid #fff9;border-radius:50%;background:#f8f7e8;color:#455438;display:grid;place-items:center;cursor:pointer; }
      .expanded-count { position:absolute;z-index:3;top:83px;left:17px;padding:8px 10px;background:#f9f7e8e8;border-radius:12px;color:#455438;font-size:8px;font-weight:700;box-shadow:0 3px 10px #29341d30; }
      .expanded-count strong { font:500 21px 'Fraunces',Georgia,serif;margin-right:4px; }
      .expanded-sheet { position:absolute;z-index:3;left:9px;right:9px;bottom:8px;border-radius:21px;background:#faf9ef;box-shadow:0 12px 30px #29321e45;padding:11px 12px 13px;animation:canopy-reveal .3s ease; }
      .sheet-grab { width:31px;height:3px;border-radius:4px;background:#c7c9b3;margin:0 auto 10px; }
      .expanded-sheet-top { display:flex;align-items:center;justify-content:space-between;margin-bottom:8px; }
      .expanded-sheet-top strong { font:500 17px 'Fraunces',Georgia,serif;color:#303a29; }
      .expanded-sheet-top span { color:#81856d;font:600 7px 'DM Mono',monospace; }
      .expanded-place { width:100%;border:0;border-top:1px solid #e7e6d8;padding:8px 1px;background:none;display:flex;align-items:center;gap:9px;text-align:left;cursor:pointer;color:#33402b; }
      .expanded-place img { width:39px;height:38px;border-radius:10px;object-fit:cover; }
      .expanded-place span { flex:1; }.expanded-place b { display:block;font-size:9px; }.expanded-place small { display:block;font-size:7px;color:#777e68;margin-top:2px; }
      .expanded-place em { font:700 8px 'DM Mono',monospace;color:#637344;font-style:normal; }
      .expanded-sheet .map-trust-note { color:#7b806c;font-size:6.5px;margin-top:3px;display:flex;align-items:center;gap:4px; }
      .venue-top { height:43px;display:flex;align-items:center;justify-content:space-between;padding:0 15px; }
      .venue-top-label { color:#7d826f;font:700 7px 'DM Mono',monospace;letter-spacing:.13em; }
      .venue-hero { height:190px;margin:0 10px;border-radius:19px;overflow:hidden;position:relative;background:#56613e; }
      .venue-hero img { width:100%;height:100%;object-fit:cover;object-position:center 48%;filter:saturate(.75) sepia(.1); }
      .venue-hero:after { content:"";position:absolute;inset:20% 0 0;background:linear-gradient(180deg,transparent,rgba(30,40,24,.83)); }
      .venue-cover-top { position:absolute;z-index:2;top:10px;left:10px;right:10px;display:flex;justify-content:space-between; }
      .venue-sample { border-radius:20px;background:#f5f3e2e8;color:#465139;padding:6px 8px;font:700 6px 'DM Mono',monospace;letter-spacing:.08em;display:flex;align-items:center;gap:4px; }
      .cover-actions { display:flex;gap:6px; }
      .cover-actions button { width:30px;height:30px;border:0;border-radius:50%;background:#f9f8ee;color:#46533a;display:grid;place-items:center;cursor:pointer; }
      .venue-title-over { position:absolute;z-index:2;left:15px;right:14px;bottom:13px;color:#fffdf2; }
      .venue-title-over small { font:600 7px 'DM Mono',monospace;letter-spacing:.08em;color:#e2e4c6; }
      .venue-title-over h2 { margin:5px 0 0;font:500 25px/.97 'Fraunces',Georgia,serif;letter-spacing:-.03em; }
      .venue-body { padding:10px 15px 22px; }
      .venue-meta { display:flex;align-items:center;justify-content:space-between;padding-bottom:9px;border-bottom:1px solid #e7e7d8; }
      .venue-meta > span:first-child { color:#747c67;font-size:8px; }.venue-rating { display:flex;align-items:center;gap:4px;font-size:8px;font-weight:800;color:#4b563b; }.venue-rating small { color:#8a8c77;font-weight:500; }
      .venue-status-row { display:flex;justify-content:space-between;align-items:center;padding:9px 0;color:#59634b;font-size:7.5px; }
      .venue-status-row span { display:flex;align-items:center;gap:4px; }
      .venue-actions { display:flex;gap:8px;margin-bottom:10px; }
      .venue-actions .checkin-button { flex:1;height:42px; }
      .directions-button { width:43px;height:42px;border:1px solid #dfe1cf;background:#fffef6;color:#596743;border-radius:13px;display:grid;place-items:center;cursor:pointer; }
      .venue-pulse { display:flex;align-items:center;justify-content:space-between;margin:0 0 10px;padding:10px 11px;border-radius:14px;background:var(--olive-900);color:#f7f5e5; }
      .pulse-title { display:flex;align-items:center;gap:8px; }
      .pulse-icon { width:29px;height:29px;border-radius:10px;background:#65774a;color:#e4e7c6;display:grid;place-items:center; }
      .pulse-title strong { display:block;font-size:9px; }.pulse-title small { display:block;color:#d0d5b7;font-size:7px;margin-top:2px; }
      .pulse-num { font:500 22px 'Fraunces',Georgia,serif;color:#e4d49a; }
      .venue-tabs { display:flex;border-bottom:1px solid #e1e3d2;margin:0 0 10px;gap:19px; }
      .venue-tab { height:30px;position:relative;border:0;background:none;padding:0 1px;color:#818671;font-size:8px;font-weight:700;cursor:pointer; }
      .venue-tab.active { color:#4a5c36; }.venue-tab.active:after { content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:#687b48;border-radius:2px; }
      .reward-card { padding:10px 11px;border-radius:14px;background:#e9ebd8;border:1px solid #dce0c8;margin-bottom:9px; }
      .reward-card-top { display:flex;align-items:center;justify-content:space-between;color:#6d7c4c;font:700 6px 'DM Mono',monospace;letter-spacing:.1em; }
      .reward-card h3 { margin:6px 0 0;color:#36432c;font:500 17px/1 'Fraunces',Georgia,serif; }
      .reward-card p { margin:4px 0 0;color:#71785f;font-size:7.5px;line-height:1.4; }
      .announcement-card { padding:10px 11px;border-radius:14px;background:#fffef7;border:1px solid #e4e4d5;margin-bottom:9px;display:flex;gap:8px; }
      .announcement-mark { color:#697a4a;width:25px;height:25px;border-radius:9px;background:#eff0df;display:grid;place-items:center;flex:none; }
      .announcement-card small { color:#858970;font:700 6px 'DM Mono',monospace;letter-spacing:.09em; }
      .announcement-card p { margin:4px 0 0;color:#4f5943;font:italic 13px/1.18 'Fraunces',Georgia,serif; }
      .venue-section-title { display:flex;align-items:baseline;justify-content:space-between;margin:11px 1px 6px; }
      .venue-section-title strong { font:500 16px 'Fraunces',Georgia,serif;color:#37432c; }
      .venue-section-title span { color:#838872;font:600 6px 'DM Mono',monospace;letter-spacing:.08em; }
      .leaderboard { display:flex;gap:4px;padding:8px 7px;border:1px solid #e3e4d5;border-radius:12px;background:#fffef8; }
      .leader { flex:1;display:flex;align-items:center;gap:4px;min-width:0; }
      .leader-rank { color:#87906d;font:700 7px 'DM Mono',monospace; }
      .leader-avatar { width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#d8dfc1;color:#465438;font-size:6px;font-weight:800;flex:none; }
      .leader-copy { min-width:0; }.leader-copy b { display:block;font-size:6.5px;white-space:nowrap; }.leader-copy small { display:block;margin-top:2px;color:#838873;font-size:6px; }
      .event-card { padding:9px;border-radius:13px;background:#fffef7;border:1px solid #e3e3d3;display:flex;gap:8px;align-items:center; }
      .event-date { width:35px;height:38px;border-radius:10px;background:#e9ebd7;color:#56683e;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none; }
      .event-date b { font:700 6px 'DM Mono',monospace; }.event-date strong { font:500 17px/1 'Fraunces',Georgia,serif; }
      .event-copy { flex:1;min-width:0; }.event-copy strong { display:block;font-size:8.5px;color:#36422d; }.event-copy small { display:block;color:#7c826d;font-size:6.5px;margin-top:3px; }
      .rsvp-button { height:28px;border:1px solid #dce0c9;border-radius:9px;background:#f0f1e3;color:#596e3f;padding:0 8px;font-size:7px;font-weight:800;cursor:pointer; }
      .guest-quote { padding:11px;border-radius:14px;background:#efeee0;border:1px solid #e1dfca; }
      .guest-quote blockquote { margin:0;color:#4d5740;font:500 17px/1.12 'Fraunces',Georgia,serif; }
      .guest-quote cite { display:block;margin-top:8px;color:#858873;font:600 6.5px 'DM Mono',monospace;font-style:normal; }
      .guestbook-notes { display:grid;gap:7px; }
      .guestbook-note { padding:8px 9px;background:#fffef7;border:1px solid #e5e5d7;border-radius:11px;color:#535e46;font:italic 12px/1.2 'Fraunces',Georgia,serif; }
      .guestbook-note small { display:block;color:#868a76;font:600 6px 'DM Mono',monospace;margin-top:6px; }
      .hours-contact { margin-top:10px;padding:9px 2px 2px;border-top:1px solid #e4e5d7;display:flex;justify-content:space-between;color:#747c67;font-size:7px;line-height:1.55; }
      .hours-contact strong { color:#4c5a3b; }
      .venue-bottom { min-height:55px;flex:none;padding:6px 14px 8px;background:#fcfbf4;border-top:1px solid #e8e8dc;display:flex;align-items:center;gap:9px; }
      .venue-bottom small { flex:1;color:#7d826f;font-size:7px;line-height:1.4; }.venue-bottom small b { color:#556344;display:block; }
      .venue-bottom .checkin-button { padding:0 14px;height:39px;font-size:9px; }
      .canopy-sheet-shade { position:absolute;z-index:8;inset:31px 0 0;background:#28321f6e;display:flex;align-items:flex-end;animation:canopy-fade .18s ease; }
      .canopy-action-sheet { width:100%;background:#faf9ef;border-radius:23px 23px 0 0;padding:13px 18px 30px;box-shadow:0 -10px 32px #17201224;animation:canopy-reveal .24s ease; }
      .sheet-close-row { display:flex;justify-content:space-between;align-items:center;color:#7d826d;font:700 7px 'DM Mono',monospace;letter-spacing:.12em; }
      .sheet-close-row button { border:0;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#eeefdf;color:#586343;cursor:pointer; }
      .canopy-action-sheet h3 { margin:7px 0 4px;color:#303c28;font:500 24px 'Fraunces',Georgia,serif; }
      .canopy-action-sheet p { color:#707761;font-size:9px;line-height:1.5;margin:0 0 12px; }
      .preview-warning { display:flex;align-items:flex-start;gap:8px;padding:10px;border-radius:12px;background:#ecefda;color:#566442;font-size:8px;line-height:1.4;margin-bottom:12px; }
      .preview-warning svg { flex:none; }.sheet-primary { width:100%;height:43px;border:0;border-radius:13px;background:var(--olive-800);color:white;font-size:10px;font-weight:800;cursor:pointer; }
      .canopy-toast { position:absolute;z-index:10;bottom:67px;left:50%;transform:translateX(-50%);padding:9px 12px;border-radius:18px;background:#f8f6e8;color:#3d4b2f;box-shadow:0 5px 20px #1d261f44;white-space:nowrap;font-size:8px;font-weight:700;animation:canopy-fade .2s ease; }
      @keyframes canopy-reveal { from {opacity:0;transform:translateY(8px)} to {opacity:1;transform:translateY(0)} }
      @keyframes canopy-fade { from {opacity:0} to {opacity:1} }
      @keyframes map-arrive { from {opacity:.65;transform:scale(.98)} to {opacity:1;transform:scale(1)} }
      @media (prefers-reduced-motion:reduce) { .canopy-board *, .canopy-board *:before, .canopy-board *:after { animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important; } }
      @media (max-width:760px) {
        .canopy-board { width:100%;height:auto;min-height:100dvh;padding:16px 12px 28px;overflow:visible; }
        .canopy-heading { margin:0 5px 14px;align-items:flex-start;flex-direction:column;gap:7px; }.canopy-head-note { text-align:left; }
        .canopy-pair { flex-direction:column;align-items:center;gap:23px; }.canopy-device { width:min(390px,100%);flex-basis:auto; }
        .canopy-frame { height:min(900px,calc(100dvh - 75px));min-height:770px; }
      }
    `}</style>

    <header className="canopy-heading">
      <div><div className="canopy-eyebrow"><i className="canopy-mark"/> MET / CANOPY STUDY</div><h1>Let the neighborhood open up.</h1></div>
      <div className="canopy-head-note">A softer kind of being out there<br/>OLIVE MATERIAL · PLACE-FIRST CONNECTION</div>
    </header>

    <div className="canopy-pair">
      <Phone label="01 / Home · the neighborhood canopy">
        <div className="canopy-scroll">
          <div className="home-nav">
            <div className="brand-lockup"><span className="brand-leaf"><i/></span>met</div>
            <span className="sample-chip">sample day · 9:41</span>
            <RoundButton label="Open connection request" onClick={() => setRequestOpen(!requestOpen)}><Users size={15}/></RoundButton>
          </div>
          {savedTab ? <div className="saved-view">
            <small>KEEP A PLACE CLOSE</small><h2>Saved for<br/>another day.</h2>
            <p>A few familiar places, ready when you feel like stepping out.</p>
            {venueSaved ? <div className="next-place" style={{margin:"0 0 12px"}}>
              <img className="place-photo" src="/__mockup/images/coffee-shop.png" alt="Mira House Coffee sample venue"/>
              <span className="place-copy"><small>RIVER DISTRICT · SAVED</small><strong>Mira House Coffee</strong><span>Coffee · bakery · community table</span></span>
              <button className="nearby-cta" aria-label="Remove Mira House from saved places" onClick={() => setVenueSaved(false)}><Bookmark size={14} fill="#607344"/></button>
            </div> : <div className="saved-empty"><i><Bookmark size={18}/></i><strong>Nothing tucked away yet.</strong><span>Save Mira House Coffee to keep this neighborhood favorite close.</span></div>}
            <button className="saved-action" onClick={() => venueSaved ? setSavedTab(false) : setVenueSaved(true)}>{venueSaved ? "Back to the neighborhood" : "Save Mira House Coffee"}</button>
          </div> : <>
          <div className="home-welcome">
            <div><small>RIVER DISTRICT · TODAY</small><h2>Make room<br/>for a hello.</h2></div>
            <div className="nearby-count"><b>{visible ? "08" : "—"}</b><span>{visible ? "nearby, by place" : "visibility paused"}</span></div>
          </div>
          <div className="visibility-control">
            <span className="visibility-symbol"><Radio size={15}/></span>
            <span className="visibility-copy"><strong>{visible ? "You’re open to being found" : "You’re taking a quiet moment"}</strong><small>{visible ? "Only opted-in guests at shared places" : "Switch on whenever it feels right"}</small></span>
            <button className={`visibility-toggle ${visible ? "on" : ""}`} aria-label="Toggle visibility" aria-pressed={visible} onClick={() => setVisible(!visible)}><i/></button>
          </div>
          <div className="map-shell">
            <StreetMap expanded={false} visible={visible} selected={selected} onSelect={setSelected}/>
            <button className="map-expand" onClick={() => setExpandedMap(true)}><Compass size={12}/> Explore map <ArrowDownRight size={11}/></button>
          </div>
          <div className="next-place">
            <img className="place-photo" src="/__mockup/images/coffee-shop.png" alt="Mira House Coffee, sample neighborhood café"/>
            <span className="place-copy"><small>ONE GOOD NEXT STEP · {selectedMeta.distance}</small><strong>{selected}</strong><span>{selectedMeta.type} · {selectedMeta.visits} this week</span></span>
            <ArrowRight className="place-arrow" size={16}/>
          </div>
          <div className="home-primary-row">
            <button className="checkin-button" onClick={() => setHomeSheet("checkin")}><ScanLine size={15}/> Check in at {selected === "Mira House Coffee" ? "Mira House" : selected.split(" ")[0]}</button>
            <button className="nearby-cta" aria-label="Open selected place profile" onClick={() => setSelected("Mira House Coffee")}><ArrowRight size={16}/></button>
          </div>
          <button className="request-line" onClick={() => setRequestOpen(!requestOpen)} aria-expanded={requestOpen}>
            <span className="request-icon"><Users size={15}/></span><span><strong>1 connection request</strong><small>Review privately, on your terms</small></span>
            {requestOpen ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
          </button>
          {requestOpen && <div className="request-expanded"><strong>A familiar place brought you together.</strong><p>Jordan sent a sample hello after a shared visit. Nothing is shared until you choose.</p><button onClick={() => setRequestOpen(false)}>Keep for later</button></div>}
          <div className="week-strip">
            <span className="week-intro">A little more connected<small>Your week around shared places</small></span>
            <div className="week-numbers"><span className="week-number"><b>3</b><span>NEW</span></span><span className="week-number"><b>2</b><span>AGAIN</span></span></div>
          </div>
          </>}
        </div>
        <nav className="home-tabs" aria-label="Home navigation">
          <button className={`home-tab ${!savedTab ? "active" : ""}`} onClick={() => setSavedTab(false)}><MapPin size={15}/><span>Nearby</span></button>
          <button className={`home-tab ${savedTab ? "active" : ""}`} onClick={() => setSavedTab(true)}><Bookmark size={15}/><span>Saved</span></button>
          <button className="home-tab" onClick={() => setRequestOpen(!requestOpen)}><Users size={15}/><span>People</span></button>
          <button className="home-tab" onClick={() => setHomeSheet("directions")}><MoreHorizontal size={15}/><span>More</span></button>
        </nav>
        {expandedMap && <div className="map-mode">
          <StreetMap expanded visible={visible} selected={selected} onSelect={setSelected}/>
          <button className="expanded-close" aria-label="Collapse map" onClick={() => setExpandedMap(false)}><X size={16}/></button>
          <div className="expanded-count"><strong>{visible ? "08" : "—"}</strong> nearby around places</div>
          <div className="expanded-sheet">
            <div className="sheet-grab"/>
            <div className="expanded-sheet-top"><strong>Places with a pulse</strong><span>RIVER DISTRICT</span></div>
            {[
              ["Mira House Coffee","Coffee · bakery · 0.8 mi","86"],
              ["Juniper Market","Market · pantry · 0.4 mi","64"],
              ["Cypress Books","Books · community · 0.6 mi","42"],
            ].map(([name, detail, count]) => <button className="expanded-place" key={name} onClick={() => { setSelected(name); setExpandedMap(false); }}>
              <img src="/__mockup/images/coffee-shop.png" alt="Sample neighborhood place"/>
              <span><b>{name}</b><small>{detail}</small></span><em>{count}</em>
            </button>)}
            <div className="map-trust-note"><ShieldCheck size={10}/> Activity is pooled by venue. No individual guest positions.</div>
          </div>
        </div>}
        {homeSheet !== "none" && <div className="canopy-sheet-shade" onClick={() => setHomeSheet("none")}>
          <div className="canopy-action-sheet" onClick={event => event.stopPropagation()}>
            <div className="sheet-close-row"><span>{homeSheet === "checkin" ? "A MOMENT AT A PLACE" : "GETTING THERE"}</span><button aria-label="Close sheet" onClick={() => setHomeSheet("none")}><X size={14}/></button></div>
            <h3>{homeSheet === "checkin" ? "Check in at Mira House?" : "A short neighborhood walk."}</h3>
            <p>{homeSheet === "checkin" ? "A check-in can help turn a familiar place into a familiar face." : "Mira House is about a 12-minute walk through River District."}</p>
            <div className="preview-warning"><ShieldCheck size={14}/><span>Preview only — no visit saved, no location accessed. This prototype keeps everything on this screen.</span></div>
            <button className="sheet-primary" onClick={() => setHomeSheet("none")}>{homeSheet === "checkin" ? "Got it" : "Close directions preview"}</button>
          </div>
        </div>}
      </Phone>

      <Phone label="02 / Public venue · Mira House Coffee">
        <div className="canopy-scroll">
          <div className="venue-top">
            <RoundButton label="Back to neighborhood" onClick={() => setVenueTab("today")}><ArrowLeft size={16}/></RoundButton>
            <span className="venue-top-label">A PLACE IN RIVER DISTRICT</span>
            <RoundButton label={venueSaved ? "Remove saved venue" : "Save venue"} onClick={() => setVenueSaved(!venueSaved)}><Bookmark size={15} fill={venueSaved ? "#607344" : "none"}/></RoundButton>
          </div>
          <div className="venue-hero">
            <img src="/__mockup/images/coffee-shop.png" alt="Warm, sunlit neighborhood café interior"/>
            <div className="venue-cover-top"><span className="venue-sample"><ShieldCheck size={10}/> SAMPLE PLACE</span><span className="cover-actions"><button aria-label={venueSaved ? "Remove saved venue" : "Save venue"} onClick={() => setVenueSaved(!venueSaved)}><Heart size={14} fill={venueSaved ? "#607344" : "none"}/></button></span></div>
            <div className="venue-title-over"><small>COFFEE · BAKERY · NEIGHBORHOOD TABLE</small><h2>Mira House Coffee</h2></div>
          </div>
          <div className="venue-body">
            <div className="venue-meta"><span>A neighborhood room for slow mornings.</span><span className="venue-rating"><Star size={11} fill="#bd9650" color="#bd9650"/> 4.9 <small>· 128</small></span></div>
            <div className="venue-status-row"><span><Clock3 size={12}/> Open today · 7 am–6 pm</span><span><MapPin size={12}/> River District</span></div>
            <div className="venue-actions"><button className="checkin-button" onClick={() => setVenueSheet("checkin")}><ScanLine size={15}/> Check in here</button><button className="directions-button" aria-label="Directions preview" onClick={() => setVenueSheet("directions")}><Navigation size={15}/></button></div>
            <div className="venue-pulse"><span className="pulse-title"><i className="pulse-icon"><Users size={14}/></i><span><strong>A place that brings people back</strong><small>Weekly venue interactions · sample</small></span></span><span className="pulse-num">86</span></div>
            <div className="venue-tabs" role="tablist" aria-label="Venue details">
              <button className={`venue-tab ${venueTab === "today" ? "active" : ""}`} onClick={() => setVenueTab("today")}>Today</button>
              <button className={`venue-tab ${venueTab === "gather" ? "active" : ""}`} onClick={() => setVenueTab("gather")}>Gather</button>
              <button className={`venue-tab ${venueTab === "guestbook" ? "active" : ""}`} onClick={() => setVenueTab("guestbook")}>Guestbook</button>
            </div>
            {venueTab === "today" && <>
              <div className="reward-card"><div className="reward-card-top"><span>A THANK-YOU FOR SHOWING UP</span><Award size={12}/></div><h3>Coffee & pastry for two</h3><p>A little treat for regulars. Sample venue reward; no purchase or membership required.</p></div>
              <div className="announcement-card"><span className="announcement-mark"><Check size={13}/></span><span><small>FROM THE MIRA HOUSE TEAM</small><p>“The community table is open all weekend. Come say hello.”</p></span></div>
              <div className="venue-section-title"><strong>Regulars, lately</strong><span>LOCAL LEADERBOARD</span></div>
              <div className="leaderboard">
                {[["01","TM","Taylor","12 visits"],["02","JE","Jordan","9 visits"],["03","AH","Alex","7 visits"]].map(([rank, initials, name, visits]) => <div className="leader" key={rank}><span className="leader-rank">{rank}</span><i className="leader-avatar">{initials}</i><span className="leader-copy"><b>{name}</b><small>{visits}</small></span></div>)}
              </div>
              <div className="venue-section-title"><strong>Next at the table</strong><span>SATURDAY · 10 AM</span></div>
              <div className="event-card"><span className="event-date"><b>SAT</b><strong>18</strong></span><span className="event-copy"><strong>Vinyl & Slow Pour</strong><small>31 interested · sample event</small></span><button className="rsvp-button" onClick={() => setRsvp(!rsvp)}>{rsvp ? "Saved" : "Save event"}</button></div>
              <div className="venue-section-title"><strong>From the guestbook</strong><span>128 NOTES</span></div>
              <div className="guest-quote"><blockquote>“A lovely place to slow down and meet the neighborhood.”</blockquote><cite>TAYLOR M. · 2 DAYS AGO · SAMPLE NOTE</cite></div>
            </>}
            {venueTab === "gather" && <>
              <div className="venue-section-title"><strong>Make a little time</strong><span>UPCOMING</span></div>
              <div className="event-card"><span className="event-date"><b>SAT</b><strong>18</strong></span><span className="event-copy"><strong>Vinyl & Slow Pour</strong><small>Saturday · 10 am · community table</small></span><CalendarDays size={15} color="#687a49"/></div>
              <p style={{fontSize:8,lineHeight:1.5,color:"#737a64",margin:"8px 2px"}}>Bring a record you love, stay for a careful pour, and meet a few neighbors. Sample event details.</p>
              <button className="checkin-button" style={{width:"100%",height:38,marginBottom:9}} onClick={() => setRsvp(!rsvp)}>{rsvp ? "Event saved to your list" : "Save this event"}</button>
              <div className="reward-card"><div className="reward-card-top"><span>REGULARS REWARD · SAMPLE</span><Award size={12}/></div><h3>Coffee & pastry for two</h3><p>A small thank-you for returning to Mira House.</p></div>
            </>}
            {venueTab === "guestbook" && <>
              <div className="venue-section-title"><strong>Notes left here</strong><span>128 SAMPLE NOTES</span></div>
              <div className="guestbook-notes"><div className="guestbook-note">“A lovely place to slow down and meet the neighborhood.”<small>TAYLOR M. · TWO DAYS AGO</small></div><div className="guestbook-note">“The window seat and a flat white made a rainy afternoon.”<small>JORDAN E. · LAST WEEK</small></div><div className="guestbook-note">“The community table made it easy to stay a little longer.”<small>CASEY R. · LAST WEEK</small></div></div>
            </>}
            <div className="hours-contact"><span><strong>HOURS</strong><br/>Today 7 am–6 pm<br/>Mon–Sun · 7 am–6 pm</span><span><strong>CONTACT</strong><br/>(415) 555-0142<br/>hello@mirahouse.example</span></div>
            <div style={{marginTop:7,color:"#858a74",fontSize:6.5,display:"flex",alignItems:"center",gap:4}}><ShieldCheck size={10}/> Sample venue profile · illustrative details</div>
          </div>
        </div>
        <div className="venue-bottom"><small><b>{venueSaved ? "Saved for another day" : "A familiar place, a new hello"}</b>Check-in stays your choice.</small><button className="checkin-button" onClick={() => setVenueSheet("checkin")}><ScanLine size={14}/> Check in</button></div>
        {venueSheet !== "none" && <div className="canopy-sheet-shade" onClick={() => setVenueSheet("none")}>
          <div className="canopy-action-sheet" onClick={event => event.stopPropagation()}>
            <div className="sheet-close-row"><span>{venueSheet === "checkin" ? "A MOMENT AT A PLACE" : "GETTING THERE"}</span><button aria-label="Close sheet" onClick={() => setVenueSheet("none")}><X size={14}/></button></div>
            <h3>{venueSheet === "checkin" ? "Check in at Mira House?" : "A short neighborhood walk."}</h3>
            <p>{venueSheet === "checkin" ? "A check-in can help turn a familiar place into a familiar face." : "Mira House is about a 12-minute walk through River District."}</p>
            <div className="preview-warning"><ShieldCheck size={14}/><span>Preview only — no visit saved, no location accessed. This prototype keeps everything on this screen.</span></div>
            <button className="sheet-primary" onClick={() => setVenueSheet("none")}>{venueSheet === "checkin" ? "Got it" : "Close directions preview"}</button>
          </div>
        </div>}
      </Phone>
    </div>
    <footer style={{position:"absolute",bottom:7,left:0,right:0,textAlign:"center",color:"#81876d",font:"600 7px 'DM Mono',monospace",letterSpacing:".1em"}}>SAFE SAMPLE CONTENT · POOLED VENUE ACTIVITY ONLY · ALL PREVIEW ACTIONS STAY LOCAL</footer>
  </main>;
}
