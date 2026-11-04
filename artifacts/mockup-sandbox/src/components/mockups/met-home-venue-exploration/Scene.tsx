import { useState, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Compass,
  MapPin,
  MessageCircle,
  Navigation,
  Radio,
  ScanLine,
  ShieldCheck,
  Star,
  Users,
  Wifi,
  X,
} from "lucide-react";

const cafeImage = "/__mockup/images/met-scene-cafe.png";

function StatusBar() {
  return (
    <div className="scene-status">
      <b>9:41</b>
      <span className="scene-island" />
      <span className="scene-status-right">
        <Wifi size={14} strokeWidth={2.4} />
        <i className="scene-battery"><i /></i>
      </span>
    </div>
  );
}

function ScreenFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="scene-device">
      <div className="scene-device-label">
        <span>{label}</span><span>MET / SAMPLE</span>
      </div>
      <div className="scene-phone">
        <div className="scene-screen">
          <StatusBar />
          {children}
        </div>
      </div>
    </section>
  );
}

export function Scene() {
  const [visible, setVisible] = useState(true);
  const [homeTab, setHomeTab] = useState("For you");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestHandled, setRequestHandled] = useState(false);
  const [checkedHome, setCheckedHome] = useState(false);
  const [saved, setSaved] = useState(false);
  const [venueTab, setVenueTab] = useState("Visit");
  const [checkedVenue, setCheckedVenue] = useState(false);
  const [rsvp, setRsvp] = useState(false);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);

  return (
    <main className="scene-board">
      <style>{`
        .scene-board {
          --paper:#f7f4ec; --ink:#252b2a; --muted:#6c7470; --line:#dedbd2;
          --tomato:#ef573d; --blue:#244dd8; --sun:#f5c848; --mint:#d8e8d8;
          box-sizing:border-box; width:1120px; height:1020px; overflow:hidden;
          padding:20px 34px 16px; color:var(--ink); background:#e9e4d7;
          font-family:"DM Sans","Avenir Next",system-ui,sans-serif; position:relative; isolation:isolate;
        }
        .scene-board * { box-sizing:border-box; }
        .scene-board:before { content:""; position:absolute; inset:0; z-index:-1; pointer-events:none; opacity:.17; background-image:radial-gradient(#5c6056 .55px,transparent .55px); background-size:7px 7px; }
        .scene-heading { height:53px; display:flex; align-items:flex-end; justify-content:space-between; max-width:900px; margin:0 auto 10px; }
        .scene-kicker { display:flex; align-items:center; gap:8px; color:#52605a; font-size:10px; font-weight:800; letter-spacing:.17em; text-transform:uppercase; }
        .scene-kicker i { display:block; width:8px; height:8px; border-radius:50%; background:var(--tomato); box-shadow:0 0 0 4px #ef573d20; }
        .scene-heading h1 { margin:5px 0 0; font-size:23px; line-height:1; letter-spacing:-.06em; font-weight:750; }
        .scene-heading aside { font-size:10px; line-height:1.5; color:#65716a; text-align:right; letter-spacing:.03em; }
        .scene-screens { display:flex; justify-content:center; align-items:flex-start; gap:27px; }
        .scene-device { width:438px; min-width:0; }
        .scene-device-label { height:21px; display:flex; justify-content:space-between; padding:0 8px 5px; color:#36443d; font-weight:800; font-size:10px; letter-spacing:.1em; text-transform:uppercase; }
        .scene-device-label span:last-child { color:#798178; font-size:8px; letter-spacing:.15em; }
        .scene-phone { height:894px; padding:7px; border-radius:38px; background:#202522; box-shadow:0 21px 50px #4a483d30,0 0 0 1px #fff8; }
        .scene-screen { height:100%; position:relative; border-radius:31px; overflow:hidden; background:var(--paper); display:flex; flex-direction:column; }
        .scene-status { height:30px; flex:0 0 30px; position:relative; z-index:5; display:flex; align-items:center; justify-content:space-between; padding:0 19px; background:var(--paper); font-size:10px; }
        .scene-island { position:absolute; left:50%; top:5px; transform:translateX(-50%); width:87px; height:19px; background:#171b19; border-radius:20px; }
        .scene-status-right { display:flex; align-items:center; gap:5px; }
        .scene-battery { width:17px; height:9px; border:1px solid #27312d; border-radius:3px; padding:1px; position:relative; }
        .scene-battery:after { content:""; position:absolute; right:-3px; top:2px; width:2px; height:4px; background:#27312d; border-radius:0 2px 2px 0; }
        .scene-battery i { display:block; width:70%; height:100%; background:#27312d; border-radius:1px; }
        .scene-scroll { min-height:0; flex:1; overflow:auto; scrollbar-width:none; }
        .scene-scroll::-webkit-scrollbar { display:none; }
        .scene-home-top { height:53px; padding:0 18px; display:flex; align-items:center; justify-content:space-between; }
        .scene-brand { display:flex; align-items:center; gap:8px; font-size:21px; letter-spacing:-.08em; font-weight:850; }
        .scene-mark { width:27px; height:27px; background:var(--tomato); color:white; border-radius:9px 9px 9px 2px; display:grid; place-items:center; font-weight:900; font-size:16px; transform:rotate(-5deg); }
        .scene-top-note { display:flex; align-items:center; gap:7px; color:#58645e; font-size:11px; font-weight:650; }
        .scene-icon { width:35px; height:35px; border:1px solid var(--line); border-radius:50%; background:#fffdfa; display:grid; place-items:center; color:#34413a; cursor:pointer; position:relative; }
        .scene-icon .scene-unread { position:absolute; width:8px; height:8px; border-radius:50%; background:var(--tomato); border:1px solid var(--paper); top:5px; right:5px; }
        .scene-beacon { margin:0 16px 13px; min-height:46px; display:flex; align-items:center; gap:10px; padding:8px 11px; border-radius:13px; background:#e6ecdf; }
        .scene-beacon-icon { width:28px; height:28px; background:#f7f4ec; border-radius:9px; display:grid; place-items:center; color:#445c4e; }
        .scene-beacon-copy { flex:1; font-size:11px; line-height:1.2; }
        .scene-beacon-copy b { font-size:12px; }
        .scene-beacon-copy small { display:block; margin-top:3px; color:#667169; font-size:10px; }
        .scene-toggle { width:41px; height:24px; padding:3px; border:0; border-radius:99px; background:#9aa39b; cursor:pointer; transition:background .2s; }
        .scene-toggle.on { background:#365a45; }
        .scene-toggle i { display:block; width:18px; height:18px; border-radius:50%; background:#fff; transition:transform .2s; box-shadow:0 1px 3px #20282030; }
        .scene-toggle.on i { transform:translateX(17px); }
        .scene-feature { height:390px; position:relative; margin:0 12px; overflow:hidden; border-radius:19px; background:#d4ae83; isolation:isolate; }
        .scene-feature img { width:100%; height:100%; object-fit:cover; object-position:center 49%; display:block; transform:scale(1.015); }
        .scene-feature:after { content:""; position:absolute; inset:36% 0 0; background:linear-gradient(180deg,transparent 0%,rgba(18,28,25,.84) 100%); }
        .scene-feature-top { position:absolute; z-index:1; top:13px; left:13px; right:13px; display:flex; align-items:center; justify-content:space-between; }
        .scene-live-tag { background:#f7f4eced; color:#394740; padding:7px 10px; border-radius:99px; display:flex; align-items:center; gap:6px; font-weight:800; font-size:10px; letter-spacing:.08em; text-transform:uppercase; }
        .scene-live-tag i { width:7px; height:7px; background:#5e9c69; border-radius:50%; }
        .scene-feature-action { border:0; width:35px; height:35px; background:#f7f4ec; border-radius:50%; display:grid; place-items:center; cursor:pointer; }
        .scene-feature-copy { z-index:1; position:absolute; bottom:16px; left:17px; right:17px; color:#fff; }
        .scene-feature-kicker { color:#f6d36b; font-size:10px; font-weight:850; letter-spacing:.16em; text-transform:uppercase; }
        .scene-feature-copy h2 { max-width:330px; margin:6px 0 8px; font-size:36px; line-height:.98; letter-spacing:-.065em; font-weight:780; }
        .scene-feature-copy p { margin:0; font-size:13px; line-height:1.4; color:#f4f2e9; max-width:310px; }
        .scene-recommend { position:relative; margin:-1px 12px 0; padding:14px 5px 11px; display:flex; gap:11px; align-items:center; border-bottom:1px solid var(--line); }
        .scene-recommend-photo { width:58px; height:57px; flex:none; border-radius:12px; overflow:hidden; }
        .scene-recommend-photo img { width:100%; height:100%; object-fit:cover; }
        .scene-recommend-copy { flex:1; min-width:0; }
        .scene-recommend-copy small { display:block; color:#68746d; font-size:10px; letter-spacing:.08em; text-transform:uppercase; font-weight:800; }
        .scene-recommend-copy b { display:block; margin-top:3px; font-size:16px; letter-spacing:-.035em; }
        .scene-recommend-copy span { display:block; margin-top:3px; color:#67726c; font-size:11px; }
        .scene-arrow { color:var(--blue); }
        .scene-neighborhood { display:flex; align-items:center; justify-content:space-between; padding:13px 19px 7px; }
        .scene-neighborhood strong { display:block; font-size:15px; letter-spacing:-.03em; }
        .scene-neighborhood span { display:block; color:#66726a; font-size:11px; margin-top:3px; }
        .scene-aggregate { display:flex; align-items:center; gap:8px; color:#45564b; font-size:11px; font-weight:650; text-align:right; }
        .scene-aggregate b { font-size:23px; color:var(--tomato); letter-spacing:-.06em; }
        .scene-privacy { padding:0 19px 15px; font-size:10px; color:#788078; display:flex; align-items:center; gap:5px; }
        .scene-home-actions { display:flex; gap:9px; padding:0 16px 12px; }
        .scene-button { min-height:46px; display:flex; align-items:center; justify-content:center; gap:8px; border:0; border-radius:13px; padding:0 16px; font-size:13px; font-weight:800; cursor:pointer; transition:transform .18s,background .18s; }
        .scene-button:active { transform:scale(.97); }
        .scene-button.primary { background:var(--tomato); color:white; flex:1; }
        .scene-button.outline { background:transparent; border:1px solid #cbc9c0; color:#38443d; }
        .scene-home-actions .outline { width:54px; padding:0; }
        .scene-thisweek { margin:0 16px 13px; padding:12px 13px; border-radius:14px; background:#e6ecdf; display:flex; align-items:center; gap:12px; }
        .scene-week-label { min-width:86px; font-size:10px; line-height:1.35; color:#66736a; font-weight:750; text-transform:uppercase; letter-spacing:.08em; }
        .scene-week-numbers { flex:1; display:flex; justify-content:space-around; border-left:1px solid #cbd4c9; }
        .scene-week-numbers b { display:block; font-size:20px; line-height:1; letter-spacing:-.06em; }
        .scene-week-numbers span { display:block; margin-top:4px; color:#627069; font-size:10px; }
        .scene-tabbar { height:62px; flex:none; display:flex; align-items:center; justify-content:space-around; background:#f7f4ec; border-top:1px solid #e4e0d7; padding-bottom:5px; }
        .scene-tab { border:0; background:transparent; color:#7a827a; display:flex; flex-direction:column; align-items:center; gap:4px; min-width:62px; font:inherit; font-size:10px; cursor:pointer; }
        .scene-tab.active { color:var(--tomato); font-weight:800; }
        .scene-tab svg { width:19px; height:19px; }
        .scene-tab-content { padding:4px 17px 18px; }
        .scene-section-heading { display:flex; align-items:center; justify-content:space-between; margin:8px 0 10px; }
        .scene-section-heading h3 { margin:0; font-size:19px; letter-spacing:-.05em; }
        .scene-section-heading button { border:0; background:transparent; color:var(--blue); font-size:11px; font-weight:750; cursor:pointer; }
        .scene-request-card { width:100%; padding:12px; display:flex; align-items:center; gap:11px; border:1px solid var(--line); background:#fffdfa; text-align:left; border-radius:15px; cursor:pointer; color:var(--ink); }
        .scene-request-avatar { width:42px; height:42px; display:grid; place-items:center; border-radius:50%; background:#f5c848; font-size:12px; font-weight:850; }
        .scene-request-card span:nth-child(2) { flex:1; }
        .scene-request-card b { font-size:13px; }
        .scene-request-card small { display:block; color:#737c75; font-size:11px; margin-top:3px; }
        .scene-sample-line { color:#899087; font-size:10px; margin:8px 2px 0; }
        .scene-bottom-sheet { position:absolute; inset:30px 0 0; z-index:10; display:flex; align-items:flex-end; background:#20262272; }
        .scene-sheet { width:100%; background:var(--paper); border-radius:23px 23px 0 0; padding:20px 19px 24px; animation:scene-rise .25s ease-out; box-shadow:0 -9px 35px #1f261c25; }
        .scene-sheet-top { display:flex; justify-content:space-between; align-items:center; }
        .scene-sheet h3 { margin:14px 0 5px; font-size:23px; letter-spacing:-.05em; }
        .scene-sheet p { margin:0 0 15px; color:#69736c; font-size:13px; line-height:1.45; }
        .scene-sheet-actions { display:flex; gap:8px; }
        .scene-sheet-actions button { flex:1; min-height:43px; border:1px solid var(--line); border-radius:12px; background:#fffdfa; color:#38443d; font-size:12px; font-weight:750; cursor:pointer; }
        .scene-sheet-actions button:last-child { background:var(--tomato); color:#fff; border-color:var(--tomato); }
        .scene-venue-scroll { flex:1; min-height:0; overflow:auto; scrollbar-width:none; }
        .scene-venue-scroll::-webkit-scrollbar { display:none; }
        .scene-venue-cover { height:350px; position:relative; overflow:hidden; }
        .scene-venue-cover img { width:100%; height:100%; object-fit:cover; object-position:center 40%; display:block; }
        .scene-venue-cover:after { content:""; position:absolute; inset:35% 0 0; background:linear-gradient(180deg,transparent,#20231fe8); }
        .scene-venue-nav { position:absolute; z-index:2; top:8px; left:13px; right:13px; display:flex; justify-content:space-between; }
        .scene-venue-nav button { width:38px; height:38px; border:0; display:grid; place-items:center; border-radius:50%; background:#f7f4ecef; color:#26312b; cursor:pointer; }
        .scene-venue-title { position:absolute; z-index:2; left:19px; right:17px; bottom:17px; color:#fff; }
        .scene-venue-title small { font-size:10px; font-weight:850; letter-spacing:.16em; color:#f5cb4e; text-transform:uppercase; }
        .scene-venue-title h2 { margin:5px 0 7px; max-width:330px; font-size:34px; line-height:.97; letter-spacing:-.06em; }
        .scene-venue-meta { display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:12px; color:#f5f1e7; }
        .scene-rating { display:flex; align-items:center; gap:4px; white-space:nowrap; }
        .scene-rating svg { color:#f5c848; fill:#f5c848; }
        .scene-venue-copy { padding:13px 18px 8px; }
        .scene-venue-intro { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
        .scene-venue-intro p { margin:0; color:#525e56; font-size:13px; line-height:1.45; max-width:235px; }
        .scene-weekly-pill { background:#e6ecdf; padding:7px 9px; border-radius:10px; color:#42574a; font-size:10px; font-weight:800; text-align:center; white-space:nowrap; }
        .scene-weekly-pill b { display:block; font-size:17px; letter-spacing:-.05em; }
        .scene-venue-cta { display:flex; gap:8px; margin-top:13px; }
        .scene-venue-cta .scene-button { min-height:48px; }
        .scene-venue-cta .scene-button.primary { flex:1; }
        .scene-venue-cta .scene-button.outline { flex:1; }
        .scene-reward { margin:14px 17px 12px; padding:14px; border-radius:16px; background:#f1d164; color:#2d342e; display:flex; gap:12px; align-items:center; }
        .scene-reward-icon { width:42px; height:42px; flex:none; display:grid; place-items:center; background:#fff5d0; border-radius:13px; }
        .scene-reward small { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.12em; font-weight:850; }
        .scene-reward b { display:block; margin-top:4px; font-size:16px; letter-spacing:-.03em; }
        .scene-reward span { display:block; margin-top:3px; font-size:11px; color:#5f593f; }
        .scene-venue-tabs { display:flex; gap:5px; padding:0 17px; border-bottom:1px solid var(--line); }
        .scene-venue-tab { position:relative; border:0; background:transparent; padding:12px 13px 11px; color:#727c74; font:inherit; font-size:12px; font-weight:750; cursor:pointer; }
        .scene-venue-tab.active { color:var(--blue); }
        .scene-venue-tab.active:after { content:""; position:absolute; bottom:-1px; height:3px; left:13px; right:13px; border-radius:3px; background:var(--blue); }
        .scene-venue-content { padding:15px 18px 25px; }
        .scene-note { border-left:3px solid var(--tomato); padding:3px 0 3px 12px; color:#424c45; font-size:13px; line-height:1.5; }
        .scene-note small { display:block; color:#7b827a; margin-bottom:4px; font-size:10px; text-transform:uppercase; font-weight:850; letter-spacing:.13em; }
        .scene-board-row { display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--line); }
        .scene-board-row:last-child { border-bottom:0; }
        .scene-rank { color:var(--tomato); font-size:14px; font-weight:850; width:24px; }
        .scene-rank-name { flex:1; font-size:13px; font-weight:700; }
        .scene-rank-name small { display:block; margin-top:2px; color:#788078; font-size:11px; font-weight:500; }
        .scene-event { margin:3px 0 10px; padding:14px; border-radius:15px; background:#dfe8f1; }
        .scene-event-kicker { display:flex; align-items:center; gap:6px; color:#425684; font-size:10px; font-weight:850; text-transform:uppercase; letter-spacing:.12em; }
        .scene-event h4 { margin:7px 0 4px; font-size:17px; letter-spacing:-.04em; }
        .scene-event p { margin:0; color:#596775; font-size:12px; line-height:1.45; }
        .scene-event button { margin-top:11px; min-height:39px; border:0; border-radius:11px; padding:0 14px; background:var(--blue); color:white; font-weight:800; font-size:12px; cursor:pointer; }
        .scene-guest-note { margin:10px 0; padding:13px; background:#fffdfa; border:1px solid var(--line); border-radius:14px; }
        .scene-guest-note blockquote { margin:0; color:#4a544d; font-size:13px; line-height:1.5; }
        .scene-guest-note footer { display:flex; justify-content:space-between; margin-top:8px; color:#7a817a; font-size:10px; }
        .scene-hours { padding:12px 0; border-top:1px solid var(--line); color:#59645c; font-size:12px; line-height:1.65; }
        .scene-hours b { color:#333c36; }
        .scene-sticky { min-height:68px; flex:none; padding:9px 15px 12px; background:var(--paper); border-top:1px solid #e1ddd3; display:flex; align-items:center; gap:10px; }
        .scene-sticky small { flex:1; color:#707a72; font-size:10px; line-height:1.35; }
        .scene-sticky .scene-button { min-width:178px; }
        .scene-check-done { background:#406349 !important; }
        .scene-board-foot { margin:8px auto 0; max-width:900px; display:flex; justify-content:space-between; color:#737b72; font-size:9px; letter-spacing:.08em; text-transform:uppercase; }
        @keyframes scene-rise { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .scene-board *, .scene-board *:before, .scene-board *:after { scroll-behavior:auto !important; animation-duration:.01ms !important; transition-duration:.01ms !important; } }
        @media (max-width:760px) {
          .scene-board { width:100%; height:auto; min-height:100dvh; padding:18px 12px 20px; overflow:visible; }
          .scene-heading { height:auto; min-height:50px; margin-bottom:18px; }
          .scene-heading aside { display:none; }
          .scene-heading h1 { font-size:21px; }
          .scene-screens { flex-direction:column; align-items:center; gap:25px; }
          .scene-device { width:min(438px,100%); }
          .scene-phone { height:min(850px,calc(100dvh - 84px)); min-height:690px; }
          .scene-feature { height:355px; }
          .scene-venue-cover { height:315px; }
          .scene-board-foot { display:none; }
        }
      `}</style>

      <header className="scene-heading">
        <div>
          <div className="scene-kicker"><i /> Met / Place-first discovery</div>
          <h1>Find the feeling. Then find the place.</h1>
        </div>
        <aside>SCENE HYPOTHESIS<br />A recommendation from someone local.</aside>
      </header>

      <div className="scene-screens">
        <ScreenFrame label="01 / Home · Saturday, nearby">
          <div className="scene-home-top">
            <div className="scene-brand"><span className="scene-mark">m</span> met</div>
            <div className="scene-top-note"><MapPin size={14} /> River District</div>
            <button className="scene-icon" aria-label="Open connection request" onClick={() => setRequestOpen(true)}>
              <Bell size={17} />{!requestHandled && <i className="scene-unread" />}
            </button>
          </div>
          <div className="scene-beacon">
            <span className="scene-beacon-icon"><Radio size={16} /></span>
            <div className="scene-beacon-copy"><b>{visible ? "Open to a hello" : "Keeping to yourself"}</b><small>{visible ? "Nearby guests can discover you" : "Your choice, whenever you want"}</small></div>
            <button className={`scene-toggle ${visible ? "on" : ""}`} aria-label="Toggle visibility" aria-pressed={visible} onClick={() => setVisible(!visible)}><i /></button>
          </div>
          <div className="scene-scroll">
            <section className="scene-feature">
              <img src={cafeImage} alt="Neighbors sharing a sunny morning at Mira House Coffee" />
              <div className="scene-feature-top">
                <span className="scene-live-tag"><i /> TODAY IN RIVER DISTRICT</span>
                <button className="scene-feature-action" aria-label="More recommendations" onClick={() => setHomeTab(homeTab === "For you" ? "Around" : "For you")}><Compass size={17} /></button>
              </div>
              <div className="scene-feature-copy">
                <div className="scene-feature-kicker">The good kind of busy</div>
                <h2>Your kind of Saturday.</h2>
                <p>Long coffee, something on vinyl, and a table that makes room for one more.</p>
              </div>
            </section>
            <button className="scene-recommend" onClick={() => setHomeTab("Around")} aria-label="Explore Mira House Coffee">
              <span className="scene-recommend-photo"><img src={cafeImage} alt="" /></span>
              <span className="scene-recommend-copy"><small>Local favorite · open until 6</small><b>Mira House Coffee</b><span>Coffee & pastry · 4.9 sample rating</span></span>
              <ArrowUpRight size={20} className="scene-arrow" />
            </button>
            <div className="scene-neighborhood">
              <div><strong>Out in the neighborhood</strong><span>A little more happening nearby.</span></div>
              <div className="scene-aggregate"><b>{visible ? "8" : "—"}</b><span>nearby<br />guests</span></div>
            </div>
            <div className="scene-privacy"><ShieldCheck size={13} /> Pooled venue activity only · no live guest positions</div>
            <div className="scene-home-actions">
              <button className={`scene-button primary ${checkedHome ? "scene-check-done" : ""}`} onClick={() => setCheckedHome(!checkedHome)}>
                {checkedHome ? <Check size={17} /> : <ScanLine size={17} />}{checkedHome ? "Sample check-in" : "Check in"}
              </button>
              <button className="scene-button outline" aria-label="Open leaderboard" onClick={() => setHomeTab("Around")}><Award size={18} /></button>
            </div>
            <div className="scene-thisweek">
              <div className="scene-week-label">Your week<br />so far</div>
              <div className="scene-week-numbers">
                <div><b>3</b><span>new connections</span></div>
                <div><b>2</b><span>familiar faces</span></div>
              </div>
            </div>
            {homeTab === "For you" ? (
              <div className="scene-tab-content">
                <div className="scene-section-heading"><h3>A note from Mira House</h3><ArrowDownRight size={18} color="#244dd8" /></div>
                <div className="scene-note"><small>From the team · sample</small>The community table is open all weekend. Come say hello.</div>
                <div className="scene-sample-line">Sample neighborhood activity · your check-in stays on this screen.</div>
              </div>
            ) : homeTab === "Around" ? (
              <div className="scene-tab-content">
                <div className="scene-section-heading"><h3>Good things nearby</h3><span className="scene-sample-line">SAMPLE</span></div>
                <div className="scene-note"><small>River District · 86 weekly visits</small>Mira House is hosting Saturday Vinyl &amp; Slow Pour.</div>
                <div className="scene-section-heading"><h3>This week</h3><button onClick={() => setHomeTab("For you")}>Back to for you</button></div>
                <p style={{margin:"0 0 12px",color:"#657169",fontSize:13}}>3 new connections · 2 familiar faces again.</p>
                <div className="scene-request-card" role="button" tabIndex={0} onClick={() => setRequestOpen(true)}>
                  <span className="scene-request-avatar">JM</span><span><b>1 private request</b><small>Review before choosing to connect</small></span><ChevronRight size={18} />
                </div>
              </div>
            ) : (
              <div className="scene-tab-content">
                <div className="scene-section-heading"><h3>Your privacy, your pace</h3><ShieldCheck size={18} color="#365a45" /></div>
                <p style={{margin:"0 0 12px",color:"#657169",fontSize:13,lineHeight:1.5}}>Your beacon is {visible ? "on" : "off"}. Only opted-in guests can discover you, and you can switch it off any time.</p>
                <button className="scene-request-card" onClick={() => setRequestOpen(true)}>
                  <span className="scene-request-avatar"><Users size={18} /></span><span><b>{requestHandled ? "Request reviewed" : "1 private request"}</b><small>Open your connection request</small></span><ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
          <nav className="scene-tabbar" aria-label="Home tabs">
            <button className={`scene-tab ${homeTab === "For you" ? "active" : ""}`} onClick={() => setHomeTab("For you")}><Compass /><span>For you</span></button>
            <button className={`scene-tab ${homeTab === "Around" ? "active" : ""}`} onClick={() => setHomeTab("Around")}><MapPin /><span>Around</span></button>
            <button className={`scene-tab ${homeTab === "You" ? "active" : ""}`} onClick={() => setHomeTab("You")}><Users /><span>You</span></button>
            <button className="scene-tab" onClick={() => setRequestOpen(true)}><MessageCircle /><span>Requests</span></button>
          </nav>
          {requestOpen && <div className="scene-bottom-sheet" onClick={() => setRequestOpen(false)}>
            <div className="scene-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="scene-sheet-top"><span className="scene-live-tag"><i /> PRIVATE REQUEST</span><button className="scene-icon" aria-label="Close request" onClick={() => setRequestOpen(false)}><X size={17} /></button></div>
              <div className="scene-request-avatar" style={{marginTop:16}}>JM</div>
              <h3>Someone you met wants to connect.</h3>
              <p>Jordan sent a request from a participating venue. Review it privately; no profile or live location is shared here. Sample request only.</p>
              <div className="scene-sheet-actions">
                <button onClick={() => { setRequestHandled(true); setRequestOpen(false); }}>Not now</button>
                <button onClick={() => { setRequestHandled(true); setRequestOpen(false); }}>Review request</button>
              </div>
            </div>
          </div>}
        </ScreenFrame>

        <ScreenFrame label="02 / Place · Mira House Coffee">
          <div className="scene-venue-scroll">
            <div className="scene-venue-cover">
              <img src={cafeImage} alt="Bright communal table at Mira House Coffee" />
              <div className="scene-venue-nav">
                <button aria-label="Back to neighborhood" onClick={() => setVenueTab("Visit")}><ArrowLeft size={18} /></button>
                <button aria-label={saved ? "Unsave Mira House" : "Save Mira House"} onClick={() => setSaved(!saved)}><Bookmark size={17} fill={saved ? "#ef573d" : "none"} color={saved ? "#ef573d" : "#252b2a"} /></button>
              </div>
              <div className="scene-venue-title">
                <small>RIVER DISTRICT · SAMPLE PLACE</small>
                <h2>Mira House Coffee</h2>
                <div className="scene-venue-meta"><span>Coffee &amp; pastry</span><span className="scene-rating"><Star size={14} /> 4.9 <span>(sample)</span></span></div>
              </div>
            </div>
            <div className="scene-venue-copy">
              <div className="scene-venue-intro">
                <p>A neighborhood living room. Good coffee, shared tables, and room to meet the people around you.</p>
                <div className="scene-weekly-pill"><b>86</b>this week</div>
              </div>
              <div className="scene-venue-cta">
                <button className={`scene-button primary ${checkedVenue ? "scene-check-done" : ""}`} onClick={() => setCheckedVenue(!checkedVenue)}>
                  {checkedVenue ? <Check size={17} /> : <ScanLine size={17} />}{checkedVenue ? "Sample check-in" : "Check in here"}
                </button>
                <button className="scene-button outline" onClick={() => setDirectionsOpen(!directionsOpen)}><Navigation size={16} /> Directions</button>
              </div>
              {directionsOpen && <div className="scene-note" style={{marginTop:10}}><small>River District · preview</small>Directions would open in your map app. No location was accessed in this sample.</div>}
            </div>
            <div className="scene-reward">
              <div className="scene-reward-icon"><Award size={21} /></div>
              <div><small>A little thank-you for showing up</small><b>Coffee &amp; pastry for two</b><span>Mira House regular · sample reward</span></div>
            </div>
            <div className="scene-venue-tabs" role="tablist" aria-label="Place details">
              {["Visit", "Community", "Details"].map((tab) => <button key={tab} role="tab" aria-selected={venueTab === tab} className={`scene-venue-tab ${venueTab === tab ? "active" : ""}`} onClick={() => setVenueTab(tab)}>{tab}</button>)}
            </div>
            <div className="scene-venue-content">
              {venueTab === "Visit" ? <>
                <div className="scene-section-heading"><h3>There’s a reason to stay.</h3><span className="scene-sample-line">86 THIS WEEK</span></div>
                <div className="scene-note"><small>From the team · sample announcement</small>“The community table is open all weekend. Come say hello.”</div>
                <div className="scene-event">
                  <div className="scene-event-kicker"><CalendarDays size={14} /> Saturday · 10:00 am</div>
                  <h4>Vinyl &amp; Slow Pour</h4>
                  <p>Bring a record, meet a neighbor, stay for a cup. Sample event.</p>
                  {eventOpen && <p style={{marginTop:8}}>A relaxed morning with local records and careful coffee. Everyone is welcome to drop by.</p>}
                  <button onClick={() => { setRsvp(!rsvp); setEventOpen(true); }}>{rsvp ? "Interested · sample" : "I’m interested"}</button>
                </div>
                <button className="scene-request-card" onClick={() => setVenueTab("Community")}>
                  <span className="scene-request-avatar" style={{background:"#dfe8f1"}}><ArrowRight size={17} /></span>
                  <span><b>Meet the Makers Morning</b><small>Next week · local makers &amp; neighbors</small></span><ChevronRight size={18} />
                </button>
              </> : venueTab === "Community" ? <>
                <div className="scene-section-heading"><h3>The regulars</h3><span className="scene-sample-line">SAMPLE LEADERBOARD</span></div>
                {[["01","Taylor M.","12 visits"],["02","Jordan E.","9 visits"],["03","Alex H.","7 visits"]].map(([rank,name,visits]) => <div className="scene-board-row" key={rank}><span className="scene-rank">{rank}</span><span className="scene-rank-name">{name}<small>Regular at Mira House</small></span><span style={{fontSize:11,color:"#647068"}}>{visits}</span></div>)}
                <div className="scene-section-heading" style={{marginTop:20}}><h3>Guestbook</h3><span className="scene-rating"><Star size={13} /> 4.9 sample</span></div>
                <div className="scene-guest-note"><blockquote>“A lovely place to slow down and meet the neighborhood.”</blockquote><footer><span>Taylor M. · 2 days ago</span><span>★★★★★</span></footer></div>
                <div className="scene-sample-line">Illustrative guestbook notes · sample only</div>
              </> : <>
                <div className="scene-section-heading"><h3>Good to know</h3><span className="scene-sample-line">PLACE DETAILS</span></div>
                <div className="scene-hours"><b><Clock3 size={14} style={{verticalAlign:"-2px",marginRight:6}} /> Today</b><br />Open · 7:00 am–6:00 pm<br /><br /><b><MapPin size={14} style={{verticalAlign:"-2px",marginRight:6}} /> River District</b><br />A sample neighborhood location<br /><br /><b>Contact</b><br />hello@mirahouse.example</div>
                <div className="scene-note"><small>Keep it local</small>Check in when you arrive. Met doesn’t reserve tables or take payment.</div>
              </>}
            </div>
          </div>
          <div className="scene-sticky">
            <small>{saved ? "Saved for another day" : "A good place to land"}<br />{checkedVenue ? "Check-in is a local sample state" : "Sample preview · no visit recorded"}</small>
            <button className={`scene-button primary ${checkedVenue ? "scene-check-done" : ""}`} onClick={() => setCheckedVenue(!checkedVenue)}>
              {checkedVenue ? <Check size={16} /> : <ScanLine size={16} />}{checkedVenue ? "Checked in" : "Check in"}
            </button>
          </div>
        </ScreenFrame>
      </div>
      <footer className="scene-board-foot"><span>Sample content · local prototype interactions</span><span>Private by choice · sociable by place</span></footer>
    </main>
  );
}
