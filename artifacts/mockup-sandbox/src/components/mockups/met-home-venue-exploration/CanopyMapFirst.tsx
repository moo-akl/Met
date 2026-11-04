import { useState } from "react";
import {
  ArrowLeft, ArrowUpRight, Bookmark, ChevronDown, ChevronUp, CircleHelp,
  Clock3, Coffee, Compass, Heart, MapPin, Navigation, Radio, Search, ShieldCheck,
  Star, Users, Wifi, X,
} from "lucide-react";

type Place = { name: string; type: string; distance: string; activity: string; icon: "coffee" | "market" | "books" };

const places: Place[] = [
  { name: "Mira House Coffee", type: "Coffee · bakery", distance: "0.8 mi", activity: "86 visits this week", icon: "coffee" },
  { name: "Juniper Market", type: "Market · pantry", distance: "0.4 mi", activity: "64 visits this week", icon: "market" },
  { name: "Cypress Books", type: "Books · neighborhood", distance: "0.6 mi", activity: "42 visits this week", icon: "books" },
];

function CanopyStreetMap({ selected, onSelect, expanded }: {
  selected: string; onSelect: (name: string) => void; expanded: boolean;
}) {
  return <div className={`cm-map ${expanded ? "cm-map-full" : ""}`} role="group" aria-label="River District map">
    <svg viewBox="0 0 800 620" preserveAspectRatio="xMidYMid slice" className="cm-map-svg" aria-hidden="true">
      <rect width="800" height="620" fill="#e1edd8"/>
      <path d="M0 390Q120 342 220 360T420 310T620 260T800 170" fill="none" stroke="#b4d7af" strokeWidth="84"/>
      <path d="M0 390Q120 342 220 360T420 310T620 260T800 170" fill="none" stroke="#d5ead0" strokeWidth="3"/>
      <path d="M-40 72L845 278M-25 225L825 480M46-30L270 660M243-40L425 670M475-30L560 670M685-30L740 650M-25 550L832 80M-30 440L820 112" fill="none" stroke="#fafbf4" strokeWidth="25"/>
      <path d="M-40 72L845 278M-25 225L825 480M46-30L270 660M243-40L425 670M475-30L560 670M685-30L740 650M-25 550L832 80M-30 440L820 112" fill="none" stroke="#c2d2bd" strokeWidth="1.4"/>
      <path d="M-40 72L845 278M-25 225L825 480M46-30L270 660M243-40L425 670M475-30L560 670M685-30L740 650" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="3 8" opacity=".8"/>
      <path d="M520 0Q547 70 568 113T613 203T664 287T718 393T790 510" fill="none" stroke="#a6cba0" strokeWidth="42"/>
      <path d="M520 0Q547 70 568 113T613 203T664 287T718 393T790 510" fill="none" stroke="#d0e8c8" strokeWidth="2"/>
      <path d="M28 42h90v54H28zM158 120h72v43h-72zM304 28h89v61h-89zM591 96h93v57h-93zM29 486h94v58H29zM349 475h76v49h-76zM475 493h89v57h-89zM690 466h67v48h-67zM112 286h76v50h-76zM300 192h74v47h-74z" fill="#c6ddbe" stroke="#f4f8ef" strokeWidth="2"/>
      <path d="M384 336h115v91H384z" fill="#b2d4a8" stroke="#f5f8ef" strokeWidth="3"/>
      <path d="M411 360q24-28 48 0q-22 34-48 0z" fill="none" stroke="#e9f4e4" strokeWidth="3"/>
    </svg>
    <span className="cm-area cm-area-a">RIVER DISTRICT</span>
    <span className="cm-area cm-area-b">WILLOW WALK</span>
    <span className="cm-area cm-area-c">OLD MARKET</span>
    <span className="cm-park-label">Civic Green</span>
    <span className="cm-river-label">MILL CREEK</span>
    <div className="cm-user-dot" aria-label="Approximate neighborhood area"><i/><span>you</span></div>
    {places.map((place) => <button key={place.name} className={`cm-pin cm-pin-${place.icon} ${selected === place.name ? "is-selected" : ""}`} onClick={() => onSelect(place.name)} aria-label={`Select ${place.name}`}>
      {place.icon === "coffee" ? <Coffee size={16}/> : <MapPin size={16}/>}
      {selected === place.name && <span>{place.name === "Mira House Coffee" ? "Mira House" : place.name}</span>}
    </button>)}
    <span className="cm-pooled cm-pooled-a"/><span className="cm-pooled cm-pooled-b"/><span className="cm-pooled cm-pooled-c"/>
    <div className="cm-map-scale"><i/>400 m</div>
    <div className="cm-map-trust"><ShieldCheck size={13}/> Pooled place activity · no live guest pins</div>
  </div>;
}

export function CanopyMapFirst() {
  const [selectedName, setSelectedName] = useState(places[0].name);
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [screen, setScreen] = useState<"home" | "venue">("home");
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const selected = places.find((place) => place.name === selectedName) ?? places[0];

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };
  const backHome = () => { setScreen("home"); setExpanded(false); };

  return <main className="canopy-map-board">
    <style>{`
      .canopy-map-board,.canopy-map-board *{box-sizing:border-box}
      .canopy-map-board{--brand:#3DCC44;--ink:#193b22;--deep:#174c27;--leaf:#367a3c;--pale:#eaf5e6;--paper:#fcfcf7;--muted:#6b7d6e;--line:#e1e9df;width:1120px;height:1020px;padding:22px 34px 26px;background:#edf2e9;color:var(--ink);font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;flex-direction:column;align-items:center;position:relative;overflow:hidden}
      .canopy-map-board:before{content:"";pointer-events:none;position:absolute;inset:0;opacity:.17;background-image:radial-gradient(#82977f .55px,transparent .55px);background-size:9px 9px}
      .cm-heading{width:min(100%,1000px);height:64px;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;margin:0 auto 13px}
      .cm-heading h1{margin:5px 0 0;font-size:24px;line-height:1;letter-spacing:-.055em;font-weight:680}
      .cm-eyebrow{display:flex;gap:8px;align-items:center;color:#416c47;font-size:9px;font-weight:750;letter-spacing:.14em}
      .cm-brand-mark{width:18px;height:18px;display:grid;place-items:center;border-radius:6px 6px 6px 2px;background:var(--brand);color:#17341d;font-weight:800}
      .cm-heading-note{text-align:right;font-size:9px;line-height:1.55;color:#617363;font-weight:650}
      .cm-stage{position:relative;z-index:1;width:100%;flex:1;min-height:0;display:flex;justify-content:center}
      .cm-device{width:430px}
      .cm-device-label{height:24px;padding:0 8px 6px;display:flex;justify-content:space-between;align-items:center;color:#36513b}
      .cm-device-label strong{font-size:11px}.cm-device-label span{font-size:7px;letter-spacing:.12em;color:#879689;font-weight:700}
      .cm-phone{height:min(850px,calc(100dvh - 136px));min-height:690px;padding:7px;border-radius:39px;background:#252b26;border:1px solid #fff;box-shadow:0 24px 55px #26412b27,0 3px 10px #263d2a17}
      .cm-screen{height:100%;position:relative;overflow:hidden;display:flex;flex-direction:column;border-radius:32px;background:var(--paper)}
      .cm-status{height:32px;flex:none;position:relative;z-index:8;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:var(--paper);font-size:10px;font-weight:750}
      .cm-island{position:absolute;left:50%;top:5px;transform:translateX(-50%);width:84px;height:18px;border-radius:20px;background:#191f1b}
      .cm-status-right{display:flex;align-items:center;gap:5px}.cm-battery{width:15px;height:9px;border:1px solid currentColor;border-radius:2px;position:relative}.cm-battery:before{content:"";position:absolute;inset:1px 4px 1px 1px;background:currentColor;border-radius:1px}
      .cm-home-indicator{position:absolute;z-index:10;bottom:5px;left:50%;transform:translateX(-50%);width:92px;height:4px;border-radius:5px;background:#26332a;opacity:.75;pointer-events:none}
      .cm-home-head{height:56px;flex:none;position:relative;z-index:4;display:flex;align-items:center;justify-content:space-between;padding:0 17px;background:#fcfcf7f5;border-bottom:1px solid #e9eee7}
      .cm-wordmark{display:flex;align-items:center;gap:8px;font-size:20px;letter-spacing:-.07em;font-weight:800}
      .cm-wordmark i{width:27px;height:27px;border-radius:9px 9px 9px 3px;background:var(--brand);display:grid;place-items:center;color:#17341d;font-style:normal}
      .cm-location{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1;margin-left:13px}
      .cm-location small{font-size:8px;color:#748374;letter-spacing:.09em;font-weight:750}.cm-location strong{font-size:11px;color:#25482d}
      .cm-head-button{width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:#fff;color:#45664b;display:grid;place-items:center;cursor:pointer}
      .cm-map-wrap{position:relative;flex:1;min-height:0;background:#dfecd7}
      .cm-map{position:absolute;inset:0;overflow:hidden;background:#e1edd8}
      .cm-map-svg{position:absolute;inset:0;width:100%;height:100%}
      .cm-area{position:absolute;color:#607963;font-size:8px;font-weight:800;letter-spacing:.12em;opacity:.87}
      .cm-area-a{top:18%;left:8%}.cm-area-b{bottom:32%;left:36%}.cm-area-c{right:7%;bottom:18%}
      .cm-park-label{position:absolute;top:32%;left:50%;transform:rotate(-16deg);font-size:9px;color:#47714c;font-weight:650}
      .cm-river-label{position:absolute;top:28%;right:1%;transform:rotate(61deg);font-size:7px;color:#56805a;font-weight:700;letter-spacing:.12em}
      .cm-user-dot{position:absolute;left:29%;top:35%;width:29px;height:29px;border:1px solid #4c8051;background:#f7f9eeec;border-radius:50%;display:grid;place-items:center;z-index:2}
      .cm-user-dot i{width:9px;height:9px;background:#52a85a;border-radius:50%;box-shadow:0 0 0 5px #d7efce}
      .cm-user-dot span{position:absolute;top:29px;color:#355b39;font-size:8px;font-weight:750}
      .cm-pin{position:absolute;z-index:3;display:flex;align-items:center;justify-content:center;gap:6px;border:0;background:#fcfcf7;color:#377042;box-shadow:0 4px 13px #273f2945;cursor:pointer;transition:transform .18s,background .18s}
      .cm-pin.is-selected{background:var(--brand);color:#183a20;transform:translateY(-3px)}
      .cm-pin span{font-size:10px;font-weight:780;white-space:nowrap}
      .cm-pin-coffee{left:42%;top:46%;padding:10px 12px;border-radius:13px 13px 13px 4px}
      .cm-pin-market{left:18%;top:69%;width:38px;height:38px;border-radius:12px 12px 12px 3px}
      .cm-pin-books{right:14%;top:34%;width:36px;height:36px;border-radius:12px 12px 12px 3px}
      .cm-pooled{position:absolute;width:9px;height:9px;border-radius:50%;background:#6c9e58;border:1px solid #fff;box-shadow:0 0 0 5px #d8edce99}
      .cm-pooled-a{left:68%;top:72%}.cm-pooled-b{left:33%;top:79%;background:#83aa68}.cm-pooled-c{right:9%;top:57%;background:#88b36f}
      .cm-map-scale{position:absolute;top:14px;left:14px;display:flex;align-items:center;gap:5px;color:#456449;font-size:8px;font-weight:700;background:#fbfcf4dc;padding:6px 8px;border-radius:9px}
      .cm-map-scale i{width:20px;height:6px;border:1px solid #557458;border-top:0}
      .cm-map-trust{position:absolute;top:14px;right:14px;padding:7px 9px;border-radius:10px;background:#fbfcf2ed;color:#436347;display:flex;align-items:center;gap:5px;font-size:8px;font-weight:700}
      .cm-map-controls{position:absolute;right:14px;bottom:18px;z-index:4;display:grid;gap:8px}
      .cm-map-control{width:39px;height:39px;display:grid;place-items:center;border-radius:13px;background:#fbfcf8;border:1px solid #fff;color:#3a6840;box-shadow:0 3px 10px #29432924;cursor:pointer}
      .cm-sheet{position:relative;z-index:4;flex:none;background:var(--paper);border-radius:24px 24px 0 0;margin-top:-20px;padding:0 17px 16px;box-shadow:0 -10px 28px #29452b18;transition:height .22s ease;overflow:hidden}
      .cm-sheet.is-open{height:310px}.cm-sheet.is-closed{height:174px}
      .cm-grabber{width:38px;height:4px;border:0;border-radius:4px;background:#c7d3c5;display:block;margin:10px auto 8px;cursor:pointer}
      .cm-sheet-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
      .cm-sheet-head small{font-size:8px;color:#68806b;letter-spacing:.12em;font-weight:800}
      .cm-sheet-head button{border:0;background:none;color:#34733c;display:flex;align-items:center;gap:4px;font-size:9px;font-weight:750;cursor:pointer}
      .cm-selected-place{width:100%;padding:0;border:0;background:none;display:flex;align-items:center;gap:11px;text-align:left;cursor:pointer;color:var(--ink)}
      .cm-place-avatar{width:48px;height:48px;flex:none;border-radius:14px;background:#e8f3e3;display:grid;place-items:center;color:#367a3c}
      .cm-selected-copy{flex:1;min-width:0}.cm-selected-copy small{display:block;font-size:8px;color:#6d846f;letter-spacing:.09em;font-weight:800}
      .cm-selected-copy strong{display:block;margin-top:3px;font-size:15px;letter-spacing:-.035em}
      .cm-selected-copy span{display:block;margin-top:3px;font-size:10px;color:#738174}
      .cm-open-place{width:34px;height:34px;border-radius:50%;background:#eff6ec;color:#3e7744;display:grid;place-items:center}
      .cm-place-stats{margin:10px 0 11px;padding:9px 10px;border-radius:12px;background:#eff6eb;display:flex;align-items:center;justify-content:space-between;color:#3b6140}
      .cm-place-stats>span{display:flex;align-items:center;gap:6px;font-size:9px;font-weight:700}.cm-place-stats small{font-size:8px;color:#6e826f;font-weight:650}
      .cm-sheet-actions{display:flex;gap:8px}
      .cm-primary{height:43px;flex:1;border:0;border-radius:13px;background:var(--brand);color:#16391c;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;box-shadow:0 3px 9px #319b3930}
      .cm-secondary{width:45px;height:43px;border:1px solid var(--line);border-radius:13px;background:#fff;color:#416848;display:grid;place-items:center;cursor:pointer}
      .cm-safe-note{margin:9px 1px 0;color:#6e7e70;font-size:8px;display:flex;align-items:center;gap:5px}
      .cm-mini-list{display:flex;gap:7px;padding-top:12px;margin-top:9px;border-top:1px solid #e8eee6;overflow:auto;scrollbar-width:none}
      .cm-mini-list button{min-width:145px;flex:1;border:1px solid #e4ebe1;border-radius:12px;padding:8px;background:#fff;text-align:left;cursor:pointer;color:#315839}
      .cm-mini-list button.selected{border-color:#a8d6a7;background:#f1f8ee}
      .cm-mini-list strong{display:block;font-size:9px;white-space:nowrap}.cm-mini-list span{display:block;margin-top:4px;color:#788679;font-size:8px}
      .cm-bottom-nav{height:53px;flex:none;border-top:1px solid #e7eee5;background:#fbfcf8;display:flex;align-items:center;justify-content:space-around;z-index:3}
      .cm-bottom-nav button{border:0;background:none;color:#829084;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:8px;cursor:pointer}
      .cm-bottom-nav button.active{color:#267333;font-weight:800}
      .cm-venue-screen{position:absolute;inset:32px 0 0;z-index:6;background:var(--paper);display:flex;flex-direction:column;animation:cm-in .2s ease}
      .cm-venue-scroll{flex:1;min-height:0;overflow:auto;scrollbar-width:none;padding-bottom:14px}
      .cm-venue-scroll::-webkit-scrollbar{display:none}
      .cm-venue-nav{height:49px;display:flex;align-items:center;justify-content:space-between;padding:0 15px}
      .cm-venue-nav button{width:34px;height:34px;border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;background:#fff;color:#46664a;cursor:pointer}
      .cm-venue-nav span{font-size:8px;letter-spacing:.11em;color:#768477;font-weight:800}
      .cm-venue-cover{height:190px;margin:0 11px;border-radius:18px;background:linear-gradient(135deg,#a9c99f,#527356 75%,#35553b);position:relative;overflow:hidden;padding:16px;display:flex;align-items:flex-end}
      .cm-cover-grid{position:absolute;inset:0;opacity:.25;background:linear-gradient(24deg,transparent 45%,#eaf5df 45.5%,transparent 46%),linear-gradient(110deg,transparent 54%,#edf4df 54.5%,transparent 55%);background-size:70px 55px}
      .cm-cover-label{position:absolute;top:13px;left:13px;border-radius:20px;background:#fbfcf3ed;color:#385c3c;padding:7px 9px;display:flex;align-items:center;gap:5px;font-size:8px;font-weight:800}
      .cm-cover-title{position:relative;color:#fff;text-shadow:0 2px 12px #15281870}.cm-cover-title small{color:#e6f3de;font-size:8px;font-weight:750;letter-spacing:.1em}.cm-cover-title h2{margin:6px 0 0;font-size:26px;line-height:1;letter-spacing:-.06em}
      .cm-venue-content{padding:14px 16px 20px}
      .cm-venue-description{display:flex;justify-content:space-between;gap:8px;align-items:center;color:#6f7d70;font-size:10px;border-bottom:1px solid #e8eee6;padding-bottom:12px}
      .cm-rating{white-space:nowrap;color:#36573b;font-weight:800;display:flex;align-items:center;gap:4px}
      .cm-venue-line{display:flex;justify-content:space-between;padding:11px 0;color:#5f715f;font-size:9px}
      .cm-venue-line span{display:flex;align-items:center;gap:5px}
      .cm-venue-actions{display:flex;gap:8px;margin-bottom:12px}
      .cm-venue-actions .cm-primary{flex:1}
      .cm-venue-pulse{border-radius:14px;background:#174c27;color:#f4fbf3;padding:12px;display:flex;align-items:center;justify-content:space-between}
      .cm-venue-pulse span{display:flex;align-items:center;gap:9px}.cm-venue-pulse i{width:32px;height:32px;border-radius:10px;background:#ffffff18;display:grid;place-items:center;font-style:normal;color:#cff0cf}
      .cm-venue-pulse b{font-size:11px}.cm-venue-pulse small{display:block;color:#d2e7d2;font-size:8px;margin-top:3px}.cm-venue-pulse strong{font-size:22px;color:#baf0bd}
      .cm-venue-section{margin:16px 0 8px;display:flex;align-items:center;justify-content:space-between}
      .cm-venue-section strong{font-size:15px;letter-spacing:-.03em}.cm-venue-section small{font-size:8px;color:#778579;font-weight:750;letter-spacing:.08em}
      .cm-event{padding:11px;border:1px solid var(--line);background:#fff;border-radius:13px;display:flex;align-items:center;gap:9px}
      .cm-date{width:39px;height:42px;border-radius:10px;background:#eaf5e7;color:#3b7041;display:flex;flex-direction:column;align-items:center;justify-content:center}
      .cm-date small{font-size:8px;font-weight:800}.cm-date b{font-size:18px;line-height:1}
      .cm-event-copy{flex:1}.cm-event-copy strong{font-size:10px}.cm-event-copy small{display:block;color:#78857a;font-size:8px;margin-top:4px}
      .cm-event button{border:1px solid #d8e9d4;border-radius:10px;background:#edf6ea;color:#376b3e;padding:7px 8px;font-size:8px;font-weight:800;cursor:pointer}
      .cm-guest-note{padding:12px;border-radius:13px;background:#eff6ec;border:1px solid #e1ebde;color:#3b5540;font-size:12px;line-height:1.4}
      .cm-guest-note small{display:block;margin-top:7px;color:#77847a;font-size:8px;font-weight:800;letter-spacing:.07em}
      .cm-public-note{margin-top:12px;padding:10px 1px;border-top:1px solid #e6ede4;color:#718075;font-size:9px;display:flex;align-items:center;gap:5px}
      .cm-venue-footer{flex:none;padding:9px 14px 15px;background:#fbfcf8;border-top:1px solid #e7eee5;display:flex;align-items:center;gap:10px}
      .cm-venue-footer span{flex:1;color:#788579;font-size:8px}.cm-venue-footer b{display:block;color:#47634b;font-size:9px;margin-bottom:3px}
      .cm-venue-footer .cm-primary{flex:none;padding:0 15px;height:40px}
      .cm-toast{position:absolute;z-index:10;bottom:65px;left:50%;transform:translateX(-50%);padding:10px 14px;border-radius:18px;background:#1f3d27;color:#f4fbf3;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 5px 18px #1d392a44}
      @keyframes cm-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
      @media(max-width:700px){.canopy-map-board{width:100%;height:auto;min-height:100dvh;padding:10px 10px 16px}.cm-stage{flex:none}.cm-heading{height:54px;margin-bottom:7px}.cm-heading h1{font-size:18px}.cm-heading-note{font-size:8px}.cm-device{width:min(430px,100%)}.cm-phone{height:calc(100dvh - 100px);min-height:620px;max-height:850px}.cm-sheet.is-open{height:310px}.cm-map-trust{font-size:7px;right:8px;top:8px}.cm-map-scale{left:8px;top:8px}}
      @media(max-height:760px) and (min-width:701px){.cm-phone{min-height:600px}.cm-sheet.is-open{height:280px}}
      @media(prefers-reduced-motion:reduce){.canopy-map-board *{animation-duration:.01ms!important;transition-duration:.01ms!important}}
    `}</style>
    <header className="cm-heading">
      <div><div className="cm-eyebrow"><i className="cm-brand-mark">m</i> MET / NEIGHBORHOOD STUDY</div><h1>Places first. People, gently.</h1></div>
      <div className="cm-heading-note">A more useful neighborhood map<br/>PUBLIC PLACES · PRIVATE BY DEFAULT</div>
    </header>
    <div className="cm-stage">
      <section className="cm-device">
        <div className="cm-device-label"><strong>{screen === "home" ? "01 / Nearby · River District" : "02 / Public place · Mira House"}</strong><span>MET · LOCAL SAMPLE</span></div>
        <div className="cm-phone">
          <div className="cm-screen">
            <div className="cm-status"><span>9:41</span><i className="cm-island"/><span className="cm-status-right"><Wifi size={14}/><i className="cm-battery"/></span></div>
            <div className="cm-home-head">
              <div className="cm-wordmark"><i>m</i>met</div>
              <div className="cm-location"><small>YOUR NEIGHBORHOOD</small><strong>River District</strong></div>
              <button className="cm-head-button" aria-label="Help about privacy" onClick={() => showNotice("Only pooled venue activity is shown.")}><CircleHelp size={16}/></button>
            </div>
            <div className="cm-map-wrap">
              <CanopyStreetMap selected={selectedName} onSelect={(name) => { setSelectedName(name); setSheetOpen(true); }} expanded={expanded}/>
              <div className="cm-map-controls">
                <button className="cm-map-control" aria-label={expanded ? "Collapse map" : "Expand map"} onClick={() => setExpanded((value) => !value)}>{expanded ? <X size={17}/> : <Compass size={17}/>}</button>
                <button className="cm-map-control" aria-label="Search places" onClick={() => showNotice("Search preview · sample places only")}><Search size={17}/></button>
              </div>
            </div>
            <section className={`cm-sheet ${sheetOpen ? "is-open" : "is-closed"}`} aria-label="Selected place">
              <button className="cm-grabber" onClick={() => setSheetOpen((value) => !value)} aria-label={sheetOpen ? "Collapse selected place sheet" : "Expand selected place sheet"}/>
              <div className="cm-sheet-head"><small>SELECTED PLACE · {selected.distance.toUpperCase()}</small><button onClick={() => setSheetOpen((value) => !value)}>{sheetOpen ? "Less" : "Details"} {sheetOpen ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}</button></div>
              <button className="cm-selected-place" onClick={() => { setScreen("venue"); setExpanded(false); }}>
                <span className="cm-place-avatar">{selected.icon === "coffee" ? <Coffee size={21}/> : <MapPin size={21}/>}</span>
                <span className="cm-selected-copy"><small>{selected.type.toUpperCase()}</small><strong>{selected.name}</strong><span>Open today · sample place profile</span></span>
                <span className="cm-open-place"><ArrowUpRight size={17}/></span>
              </button>
              {sheetOpen && <>
                <div className="cm-place-stats"><span><Users size={14}/>{selected.activity}</span><small>Shared place activity</small></div>
                <div className="cm-sheet-actions">
                  <button className="cm-primary" onClick={() => showNotice("Preview only · no visit was saved.")}><MapPin size={15}/> Check in</button>
                  <button className="cm-secondary" aria-label="Preview directions" onClick={() => showNotice(`Directions preview · ${selected.distance} away`)}><Navigation size={16}/></button>
                  <button className="cm-secondary" aria-label={saved ? "Unsave place" : "Save place"} onClick={() => { setSaved((value) => !value); showNotice(saved ? "Removed from saved places." : "Place saved for later."); }}><Bookmark size={15} fill={saved ? "#3DCC44" : "none"}/></button>
                </div>
                <div className="cm-safe-note"><ShieldCheck size={12}/> Guest-safe · activity pooled by venue, never live people.</div>
                <div className="cm-mini-list">{places.filter((place) => place.name !== selected.name).map((place) => <button key={place.name} className={selectedName === place.name ? "selected" : ""} onClick={() => setSelectedName(place.name)}><strong>{place.name}</strong><span>{place.type} · {place.distance}</span></button>)}</div>
              </>}
            </section>
            <nav className="cm-bottom-nav" aria-label="Main navigation">
              <button className={screen === "home" ? "active" : ""} onClick={backHome}><MapPin size={16}/><span>Nearby</span></button>
              <button onClick={() => showNotice("Your saved places stay on this device.")}><Bookmark size={16}/><span>Saved</span></button>
              <button onClick={() => showNotice("People are never shown as map pins.")}><Users size={16}/><span>People</span></button>
              <button onClick={() => showNotice("Local-only preview · nothing is shared.")}><Radio size={16}/><span>Privacy</span></button>
            </nav>
            {screen === "venue" && <div className="cm-venue-screen">
              <div className="cm-venue-scroll">
                <div className="cm-venue-nav"><button aria-label="Back to map" onClick={backHome}><ArrowLeft size={16}/></button><span>PUBLIC PLACE PROFILE</span><button aria-label={saved ? "Unsave Mira House" : "Save Mira House"} onClick={() => setSaved((value) => !value)}><Heart size={15} fill={saved ? "#3DCC44" : "none"}/></button></div>
                <div className="cm-venue-cover"><div className="cm-cover-grid"/><span className="cm-cover-label"><ShieldCheck size={12}/> SAMPLE VENUE</span><div className="cm-cover-title"><small>COFFEE · BAKERY · NEIGHBORHOOD TABLE</small><h2>{selected.name}</h2></div></div>
                <div className="cm-venue-content">
                  <div className="cm-venue-description"><span>A neighborhood room for slow mornings.</span><span className="cm-rating"><Star size={12} fill="#3DCC44" color="#3DCC44"/> 4.9 · 128</span></div>
                  <div className="cm-venue-line"><span><Clock3 size={13}/> Open today · 7 am–6 pm</span><span><MapPin size={13}/> River District</span></div>
                  <div className="cm-venue-actions"><button className="cm-primary" onClick={() => showNotice("Preview only · check-in was not saved.")}><MapPin size={15}/> Check in here</button><button className="cm-secondary" aria-label="Directions preview" onClick={() => showNotice("Directions preview · about 12 minutes on foot.")}><Navigation size={16}/></button></div>
                  <div className="cm-venue-pulse"><span><i><Users size={16}/></i><span><b>A place that brings people back</b><small>Weekly venue interactions · pooled</small></span></span><strong>86</strong></div>
                  <div className="cm-venue-section"><strong>Next at the table</strong><small>SATURDAY · 10 AM</small></div>
                  <div className="cm-event"><span className="cm-date"><small>SAT</small><b>18</b></span><span className="cm-event-copy"><strong>Vinyl &amp; Slow Pour</strong><small>Community table · sample event</small></span><button onClick={() => showNotice("Event saved on this device.")}>Save event</button></div>
                  <div className="cm-venue-section"><strong>From the guestbook</strong><small>SHARED PLACE NOTE</small></div>
                  <div className="cm-guest-note">“A lovely place to slow down and meet the neighborhood.”<small>SHARED PLACE NOTE · SAMPLE</small></div>
                  <div className="cm-public-note"><ShieldCheck size={12}/> Public venue information · sample details</div>
                </div>
              </div>
              <div className="cm-venue-footer"><span><b>A familiar place, a new hello</b>Check-in stays your choice.</span><button className="cm-primary" onClick={() => showNotice("Preview only · no visit was saved.")}><MapPin size={14}/> Check in</button></div>
            </div>}
            {notice && <div className="cm-toast" role="status">{notice}</div>}
            <div className="cm-home-indicator"/>
          </div>
        </div>
      </section>
    </div>
    <footer style={{position:"relative",zIndex:1,marginTop:14,textAlign:"center",color:"#758779",fontSize:8,fontWeight:750,letterSpacing:".12em"}}>SAFE SAMPLE CONTENT · POOLED VENUE ACTIVITY ONLY · ALL PREVIEW ACTIONS STAY LOCAL</footer>
  </main>;
}
