import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Coffee,
  Compass,
  Heart,
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

type PhoneProps = { title: string; children: ReactNode };

function Phone({ title, children }: PhoneProps) {
  return (
    <section className="club-phone-wrap">
      <div className="club-phone-label">
        <span>{title}</span>
        <span className="club-sample">MET / SAMPLE VIEW</span>
      </div>
      <div className="club-device">
        <div className="club-screen">
          <div className="club-status">
            <span>9:41</span>
            <i className="club-island" />
            <span className="club-status-right"><Wifi size={13} /><i className="club-battery" /></span>
          </div>
          {children}
          <div className="club-home-indicator" />
        </div>
      </div>
    </section>
  );
}

export function Club() {
  const [visible, setVisible] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [homeCheckInOpen, setHomeCheckInOpen] = useState(false);
  const [venueCheckInOpen, setVenueCheckInOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rsvp, setRsvp] = useState(false);
  const [venueTab, setVenueTab] = useState<"story" | "regulars" | "notes">("story");
  const [homeTab, setHomeTab] = useState<"nearby" | "week">("nearby");
  const [notice, setNotice] = useState("");

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  return (
    <main className="club-board">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        .club-board, .club-board * { box-sizing:border-box; }
        .club-board {
          --paper:#f6f0e4; --paper2:#fffaf0; --ink:#182b51; --muted:#69748a;
          --blue:#244fce; --blue2:#173994; --red:#f15d3d; --lime:#d8ed67;
          --line:#d9d5ca; --warm:#e9e2d5;
          width:1120px; height:1020px; overflow:hidden; position:relative; isolation:isolate;
          padding:26px 55px 28px; color:var(--ink); background:#e9e5dc;
          font-family:'Manrope',sans-serif;
        }
        .club-board:before { content:""; position:absolute; inset:0; z-index:-1; opacity:.25; pointer-events:none;
          background-image:radial-gradient(#57627a 0.55px,transparent .55px); background-size:7px 7px; }
        .club-board button { font:inherit; }
        .club-intro { width:870px; margin:0 auto 18px; display:flex; justify-content:space-between; align-items:flex-end; }
        .club-eyebrow { display:flex; gap:8px; align-items:center; color:var(--blue); font:500 10px 'DM Mono',monospace; letter-spacing:.14em; text-transform:uppercase; }
        .club-eyebrow i { width:9px;height:9px;border-radius:2px;background:var(--red);transform:rotate(45deg); }
        .club-intro h1 { margin:7px 0 0; font:600 28px/1 'Space Grotesk',sans-serif; letter-spacing:-.055em; }
        .club-intro p { margin:0 0 2px; max-width:220px; color:#6f7581; font-size:11px; line-height:1.5; text-align:right; }
        .club-pair { display:flex; justify-content:center; gap:28px; }
        .club-phone-wrap { width:418px; min-width:0; }
        .club-phone-label { height:27px; padding:0 5px 7px; display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:800; letter-spacing:-.02em; }
        .club-sample { color:#83899a; font:500 8px 'DM Mono',monospace; letter-spacing:.12em; }
        .club-device { height:852px; padding:7px; border-radius:39px; background:#19223a; box-shadow:0 24px 48px #27304a2b,0 3px 8px #121b3020; }
        .club-screen { height:100%; position:relative; display:flex; flex-direction:column; overflow:hidden; border-radius:32px; background:var(--paper); }
        .club-status { height:35px; flex:none; position:relative; z-index:3; padding:0 20px; display:flex; align-items:center; justify-content:space-between; background:var(--paper); color:var(--ink); font-size:10px; font-weight:800; }
        .club-island { position:absolute; width:88px;height:20px;left:50%;top:6px;transform:translateX(-50%);border-radius:20px;background:#18223a; }
        .club-status-right { display:flex; align-items:center; gap:6px; }
        .club-battery { width:17px;height:9px;border:1px solid var(--ink);border-radius:2px;position:relative; }
        .club-battery:before { content:"";position:absolute;inset:1px 4px 1px 1px;background:var(--ink); }
        .club-scroll { flex:1; min-height:0; overflow-y:auto; scrollbar-width:none; }
        .club-scroll::-webkit-scrollbar { display:none; }
        .club-topbar { height:47px; display:flex; align-items:center; justify-content:space-between; padding:0 19px; }
        .club-wordmark { display:flex; align-items:center; gap:9px; font:700 21px 'Space Grotesk',sans-serif; letter-spacing:-.07em; }
        .club-stamp { width:29px;height:29px;display:grid;place-items:center;background:var(--red);color:#fff;border-radius:9px 9px 3px 9px;transform:rotate(-4deg); }
        .club-circle-btn { width:39px;height:39px;display:grid;place-items:center;border:1px solid var(--line);border-radius:50%;background:var(--paper2);color:var(--ink);cursor:pointer; }
        .club-privacy { margin:4px 16px 0; display:flex; align-items:center; gap:10px; padding:11px 12px; border-radius:16px; background:#e3e9f4; }
        .club-signal { width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:var(--blue);color:white;flex:none; }
        .club-privacy-copy { min-width:0; flex:1; }
        .club-privacy-copy strong { display:block;font-size:13px;line-height:1.2; }
        .club-privacy-copy span { display:block;margin-top:3px;color:#5b6985;font-size:10px;line-height:1.35; }
        .club-switch { width:46px;height:27px;padding:3px;border:0;border-radius:20px;background:#a9b1c0;cursor:pointer;flex:none;transition:background .2s; }
        .club-switch.on { background:var(--blue); }
        .club-switch i { width:21px;height:21px;display:block;border-radius:50%;background:white;box-shadow:0 1px 3px #19223a30;transition:transform .2s; }
        .club-switch.on i { transform:translateX(19px); }
        .club-private-line { display:flex;align-items:center;gap:5px;margin:7px 2px 0;color:#586b91;font-size:9px;font-weight:600; }
        .club-hero-home { position:relative; margin:17px 16px 0; min-height:285px; overflow:hidden; border-radius:22px; background:var(--blue); color:white; }
        .club-hero-home:before { content:"";position:absolute;right:-70px;top:-82px;width:255px;height:255px;border:1px solid #ffffff40;border-radius:50%;box-shadow:0 0 0 21px #ffffff0c,0 0 0 44px #ffffff0a; }
        .club-hero-home:after { content:"";position:absolute;right:38px;top:75px;width:92px;height:92px;border:1px dashed #ffffff6e;border-radius:50%; }
        .club-hero-inner { position:relative;z-index:1;padding:20px 20px 18px; }
        .club-kicker { color:#dce5ff;font:500 9px 'DM Mono',monospace;letter-spacing:.15em;text-transform:uppercase; }
        .club-bigcount { display:flex;align-items:flex-end;gap:11px;margin-top:8px;font:600 112px/.84 'Space Grotesk',sans-serif;letter-spacing:-.095em; }
        .club-bigcount span { margin:0 0 7px;font-size:16px;line-height:1;letter-spacing:.02em;font-weight:700;color:#dce5ff; }
        .club-count-caption { width:215px;margin-top:8px;font-size:14px;line-height:1.4;font-weight:600; }
        .club-aggregate { display:flex;align-items:center;gap:7px;margin-top:10px;color:#dbe4ff;font-size:10px; }
        .club-aggregate i { width:7px;height:7px;border-radius:50%;background:var(--lime);box-shadow:0 0 0 4px #d8ed6726; }
        .club-orbit-mark { position:absolute;right:48px;top:95px;width:72px;height:72px;z-index:2;display:grid;place-items:center;color:var(--lime); }
        .club-orbit-mark:before,.club-orbit-mark:after { content:"";position:absolute;border:1px solid #d8ed676d;border-radius:50%;inset:0; }
        .club-orbit-mark:after { inset:11px; }
        .club-orbit-mark svg { position:relative;z-index:1; }
        .club-request { width:calc(100% - 32px);margin:11px 16px 0;padding:13px 14px;border:0;border-radius:15px;background:var(--lime);color:var(--ink);display:flex;align-items:center;gap:11px;text-align:left;cursor:pointer; }
        .club-request-symbol { width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#f7f2de; }
        .club-request-copy { flex:1; }
        .club-request-copy strong { display:block;font-size:13px; }
        .club-request-copy span { display:block;margin-top:2px;font-size:10px;color:#555f3e; }
        .club-feature { margin:18px 16px 0; }
        .club-section-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:9px; }
        .club-section-head h2 { margin:0;font:600 18px 'Space Grotesk',sans-serif;letter-spacing:-.04em; }
        .club-small-label { color:#707991;font:500 8px 'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase; }
        .club-place-card { display:flex;min-height:106px;overflow:hidden;border:1px solid #d9d5ca;border-radius:17px;background:var(--paper2); }
        .club-place-card img { width:116px;object-fit:cover; }
        .club-place-text { padding:12px 12px 10px;flex:1;min-width:0; }
        .club-place-meta { color:#69748a;font:500 8px 'DM Mono',monospace;letter-spacing:.08em;text-transform:uppercase; }
        .club-place-text h3 { margin:5px 0 3px;font:700 17px/1.08 'Space Grotesk',sans-serif;letter-spacing:-.045em; }
        .club-place-text p { margin:0;color:#667087;font-size:10px; }
        .club-place-foot { display:flex;align-items:center;justify-content:space-between;margin-top:7px;color:var(--blue);font-size:10px;font-weight:800; }
        .club-main-actions { display:flex;gap:9px;margin:12px 16px 0; }
        .club-action { min-height:49px;flex:1;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--line);border-radius:14px;background:var(--paper2);color:var(--ink);font-size:12px;font-weight:800;cursor:pointer; }
        .club-action.primary { background:var(--red);border-color:var(--red);color:white; }
        .club-week { margin:20px 16px 17px;padding:15px 15px 14px;border-radius:17px;background:#fffaf0;border:1px solid var(--line); }
        .club-week-title { display:flex;justify-content:space-between;align-items:center;margin-bottom:12px; }
        .club-week-title strong { font:600 16px 'Space Grotesk',sans-serif; }
        .club-week-title span { color:#717a8e;font:500 8px 'DM Mono',monospace;letter-spacing:.08em; }
        .club-week-grid { display:flex;align-items:stretch; }
        .club-week-stat { flex:1;display:flex;align-items:baseline;gap:8px; }
        .club-week-stat + .club-week-stat { border-left:1px solid var(--line);padding-left:15px;margin-left:14px; }
        .club-week-stat b { font:600 33px/.95 'Space Grotesk',sans-serif;letter-spacing:-.08em;color:var(--blue); }
        .club-week-stat span { font-size:11px;line-height:1.35;color:#626d82; }
        .club-tabbar { height:59px;flex:none;display:flex;justify-content:space-around;align-items:center;border-top:1px solid var(--line);background:var(--paper2); }
        .club-tab { min-width:65px;padding:5px 7px;border:0;background:transparent;color:#7c8290;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:9px;font-weight:700;cursor:pointer; }
        .club-tab.active { color:var(--blue); }
        .club-tab.active svg { stroke-width:2.7; }
        .club-week-panel { margin:14px 16px;padding:20px 16px;border-radius:18px;background:#fffaf0;border:1px solid var(--line); }
        .club-week-panel h3 { margin:0 0 9px;font:600 22px 'Space Grotesk',sans-serif; }
        .club-week-panel p { margin:0;color:#59657c;font-size:13px;line-height:1.55; }
        .club-week-panel .club-week-grid { margin-top:19px; }
        .club-bottom-note { margin:0 18px 19px;color:#748096;font-size:10px;line-height:1.5; }

        .club-venue-top { display:flex;align-items:center;justify-content:space-between;padding:5px 16px 10px; }
        .club-back { width:39px;height:39px;border:1px solid var(--line);border-radius:50%;background:var(--paper2);display:grid;place-items:center;color:var(--ink);cursor:pointer; }
        .club-place-id { color:#738099;font:500 9px 'DM Mono',monospace;letter-spacing:.1em; }
        .club-cover { height:245px;margin:0 10px;position:relative;overflow:hidden;border-radius:23px;background:#c57e4e; }
        .club-cover img { width:100%;height:100%;display:block;object-fit:cover;object-position:center 47%;filter:saturate(.85) contrast(1.04); }
        .club-cover:after { content:"";position:absolute;inset:35% 0 0;background:linear-gradient(transparent,#122244d9); }
        .club-cover-controls { position:absolute;z-index:2;top:11px;left:12px;right:12px;display:flex;justify-content:space-between; }
        .club-venue-tag { display:flex;align-items:center;gap:6px;padding:7px 9px;background:#18315bd9;color:white;border-radius:20px;font:500 8px 'DM Mono',monospace;letter-spacing:.08em; }
        .club-cover-actions { display:flex;gap:7px; }
        .club-cover-actions button { width:35px;height:35px;border:0;border-radius:50%;display:grid;place-items:center;background:#fff9ed;color:var(--ink);cursor:pointer; }
        .club-cover-title { position:absolute;z-index:2;left:16px;right:15px;bottom:15px;color:white; }
        .club-cover-title .club-kicker { color:#d9ed6d; }
        .club-cover-title h2 { margin:5px 0 4px;font:600 31px/.98 'Space Grotesk',sans-serif;letter-spacing:-.06em; }
        .club-cover-sub { display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#f2eee4; }
        .club-rating { display:flex;align-items:center;gap:4px;font-weight:800; }
        .club-rating small { opacity:.75;font-weight:500; }
        .club-venue-content { padding:13px 16px 25px; }
        .club-visitline { display:flex;align-items:center;justify-content:space-between;color:#69748a;font-size:11px; }
        .club-visitline span { display:flex;align-items:center;gap:6px; }
        .club-venue-actions { display:flex;gap:9px;margin:12px 0 13px; }
        .club-venue-actions .club-action { min-height:49px; }
        .club-reward { position:relative;overflow:hidden;margin:0 0 14px;padding:15px 15px 14px;border-radius:17px;background:var(--lime); }
        .club-reward:after { content:"";position:absolute;right:-18px;top:-23px;width:94px;height:94px;border:1px dashed #45532287;border-radius:50%;box-shadow:0 0 0 12px #fff2; }
        .club-reward-kicker { display:flex;align-items:center;gap:6px;color:#47552c;font:500 8px 'DM Mono',monospace;letter-spacing:.12em;text-transform:uppercase; }
        .club-reward h3 { position:relative;z-index:1;margin:7px 0 3px;font:700 20px 'Space Grotesk',sans-serif;letter-spacing:-.05em; }
        .club-reward p { position:relative;z-index:1;margin:0;color:#53623a;font-size:11px;line-height:1.45; }
        .club-count-banner { margin:15px 0;padding:14px 14px 13px;border-radius:17px;background:var(--blue);color:white;display:flex;align-items:flex-end;justify-content:space-between; }
        .club-count-banner strong { display:block;font:600 48px/.85 'Space Grotesk',sans-serif;letter-spacing:-.085em; }
        .club-count-banner span { display:block;margin-top:6px;color:#dbe4ff;font-size:11px; }
        .club-count-mark { width:46px;height:46px;border:1px solid #ffffff78;border-radius:50%;display:grid;place-items:center;color:var(--lime); }
        .club-venue-tabs { display:flex;gap:6px;padding:4px;margin:14px 0 13px;background:#e5e1d7;border-radius:14px; }
        .club-venue-tabs button { flex:1;min-height:38px;border:0;border-radius:10px;background:transparent;color:#6c7483;font-size:11px;font-weight:800;cursor:pointer; }
        .club-venue-tabs button.active { background:var(--paper2);color:var(--blue);box-shadow:0 2px 7px #20305512; }
        .club-panel { padding:15px;border-radius:17px;background:var(--paper2);border:1px solid var(--line); }
        .club-panel h3 { margin:0 0 8px;font:600 18px 'Space Grotesk',sans-serif;letter-spacing:-.04em; }
        .club-panel p { margin:0;color:#606c82;font-size:12px;line-height:1.55; }
        .club-announcement { margin-top:10px;padding:12px;border-left:3px solid var(--red);background:#f3e8d9;color:#4e5a72;font-size:12px;line-height:1.5; }
        .club-event { display:flex;gap:12px;align-items:center;padding:13px 0;border-top:1px solid var(--line); }
        .club-event-date { width:48px;height:52px;display:grid;place-content:center;text-align:center;border-radius:11px;background:var(--blue);color:white;font:500 9px 'DM Mono',monospace;line-height:1.5; }
        .club-event-date b { font:700 20px 'Space Grotesk',sans-serif; }
        .club-event-info { flex:1; }
        .club-event-info strong { display:block;font-size:13px; }
        .club-event-info span { display:block;margin-top:3px;color:#707b90;font-size:10px; }
        .club-event .club-circle-btn { width:35px;height:35px; }
        .club-rank { display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid var(--line); }
        .club-rank:last-child { border-bottom:0; }
        .club-rank-no { width:28px;color:var(--red);font:500 12px 'DM Mono',monospace; }
        .club-rank-avatar { width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#dbe2ef;color:var(--blue);font-size:11px;font-weight:800; }
        .club-rank-name { flex:1;font-size:12px;font-weight:800; }
        .club-rank-visits { color:#69748a;font:500 10px 'DM Mono',monospace; }
        .club-quote { margin-top:9px;padding:14px;background:#f1e9da;border-radius:14px;font:500 14px/1.5 'Space Grotesk',sans-serif;color:#26375b; }
        .club-quote small { display:block;margin-top:9px;color:#737b8b;font:500 9px 'DM Mono',monospace;letter-spacing:.04em; }
        .club-contact { margin-top:13px;padding:12px 1px 0;border-top:1px solid var(--line);color:#6b7588;font-size:10px;line-height:1.6; }
        .club-sticky { flex:none;padding:9px 16px 15px;background:linear-gradient(#f6f0e4e8,var(--paper) 22%); }
        .club-sticky .club-action { min-height:47px; }
        .club-overlay { position:absolute;inset:35px 0 0;z-index:8;display:flex;align-items:flex-end;padding:14px;background:#16244855; }
        .club-sheet { width:100%;padding:20px;border-radius:24px 24px 18px 18px;background:var(--paper2);box-shadow:0 -12px 40px #16244825;animation:club-rise .24s ease-out; }
        .club-sheet-head { display:flex;justify-content:space-between;align-items:center; }
        .club-sheet h3 { margin:12px 0 6px;font:600 23px 'Space Grotesk',sans-serif;letter-spacing:-.05em; }
        .club-sheet p { margin:0 0 16px;color:#69748a;font-size:13px;line-height:1.55; }
        .club-sheet .club-action { width:100%; }
        .club-request-mark { width:45px;height:45px;display:grid;place-items:center;border-radius:15px;background:#e3e9f4;color:var(--blue); }
        .club-toast { position:absolute;z-index:10;left:50%;bottom:73px;transform:translateX(-50%);max-width:90%;padding:10px 14px;border-radius:20px;background:#192b50;color:#fffaf0;white-space:nowrap;font-size:10px;font-weight:700;box-shadow:0 8px 20px #192b5030;animation:club-toast-in .2s ease-out; }
        @keyframes club-rise { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes club-toast-in { from { opacity:0; transform:translate(-50%,6px) } to { opacity:1; transform:translate(-50%,0) } }
        @media (prefers-reduced-motion:reduce) { .club-board *, .club-board *:before, .club-board *:after { animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important; } }
        @media (max-width:760px) {
          .club-board { width:100%;height:auto;min-height:100dvh;overflow:visible;padding:20px 14px 30px; }
          .club-intro { width:100%;margin-bottom:18px;display:block; }
          .club-intro h1 { font-size:25px; }
          .club-intro p { margin-top:7px;text-align:left;max-width:none; }
          .club-pair { flex-direction:column;align-items:center;gap:24px; }
          .club-phone-wrap { width:min(418px,100%); }
          .club-device { height:min(852px,calc(100dvh - 90px));min-height:700px; }
        }
      `}</style>

      <header className="club-intro">
        <div>
          <div className="club-eyebrow"><i /> MET / LOCAL CLUB STUDY</div>
          <h1>Belonging has a neighborhood.</h1>
        </div>
        <p>A little recognition, shared in public.<br />Your presence stays yours to choose.</p>
      </header>

      <div className="club-pair">
        <Phone title="01 / Home — Neighborhood roll call">
          <div className="club-scroll">
            <div className="club-topbar">
              <div className="club-wordmark"><span className="club-stamp"><Radio size={17} /></span>met</div>
              <button className="club-circle-btn" aria-label="Open connection request" onClick={() => setRequestOpen(true)}><Bell size={17} /></button>
            </div>
            <div className="club-privacy">
              <div className="club-signal"><Radio size={19} /></div>
              <div className="club-privacy-copy">
                <strong>{visible ? "Your signal is on" : "You’re off the roll call"}</strong>
                <span>{visible ? "Discoverable to opted-in guests nearby" : "Switch on only when it feels right"}</span>
              </div>
              <button className={`club-switch ${visible ? "on" : ""}`} aria-label="Toggle private visibility" aria-pressed={visible} onClick={() => setVisible(!visible)}><i /></button>
            </div>
            <div className="club-private-line"><ShieldCheck size={12} /> Private by choice <span>·</span> location &amp; Bluetooth ready · sample</div>

            {homeTab === "nearby" ? <>
              <section className="club-hero-home">
                <div className="club-orbit-mark"><Users size={26} /></div>
                <div className="club-hero-inner">
                  <div className="club-kicker">RIVER DISTRICT / RIGHT NOW</div>
                  <div className="club-bigcount">{visible ? "08" : "—"}<span>{visible ? "in range" : ""}</span></div>
                  <div className="club-count-caption">A few familiar rhythms<br />are happening nearby.</div>
                  <div className="club-aggregate"><i /> Pooled venue activity · no live guest pins</div>
                </div>
              </section>
              <button className="club-request" onClick={() => setRequestOpen(true)}>
                <span className="club-request-symbol"><MessageCircle size={18} /></span>
                <span className="club-request-copy"><strong>One quiet hello, waiting</strong><span>1 private connection request · review first</span></span>
                <ChevronRight size={18} />
              </button>
              <section className="club-feature">
                <div className="club-section-head"><h2>A place you return to</h2><span className="club-small-label">FEATURED / SAMPLE</span></div>
                <div className="club-place-card">
                  <img src="/__mockup/images/coffee-shop.png" alt="Interior of Mira House Coffee" />
                  <div className="club-place-text">
                    <div className="club-place-meta">RIVER DISTRICT · CAFÉ</div>
                    <h3>Mira House Coffee</h3>
                    <p>86 weekly venue interactions</p>
                    <div className="club-place-foot"><span>Come be a regular <ArrowRight size={14} /></span><Star size={14} fill="#f15d3d" color="#f15d3d" /></div>
                  </div>
                </div>
              </section>
              <div className="club-main-actions">
                <button className="club-action primary" onClick={() => setHomeCheckInOpen(true)}><ScanLine size={17} /> Check in</button>
                <button className="club-action" onClick={() => showNotice("Local regulars preview · sample data")}><Award size={17} /> Regulars</button>
              </div>
              <section className="club-week">
                <div className="club-week-title"><strong>This week, in passing</strong><span>YOUR CONNECTIONS</span></div>
                <div className="club-week-grid">
                  <div className="club-week-stat"><b>3</b><span>new<br />encounters</span></div>
                  <div className="club-week-stat"><b>2</b><span>familiar<br />faces again</span></div>
                </div>
              </section>
              <p className="club-bottom-note">People are never shown as live map points. Met shares a little local activity, not anyone’s whereabouts.</p>
            </> : <section className="club-week-panel">
              <div className="club-small-label">YOUR WEEK / RIVER DISTRICT</div>
              <h3>Five moments of overlap.</h3>
              <p>Three new encounters, and two familiar faces crossed paths with you again. The story is yours; nobody else can browse your exact route.</p>
              <div className="club-week-grid">
                <div className="club-week-stat"><b>3</b><span>new<br />encounters</span></div>
                <div className="club-week-stat"><b>2</b><span>repeat<br />connections</span></div>
              </div>
              <button className="club-action" style={{width:"100%",marginTop:20}} onClick={() => setHomeTab("nearby")}><Compass size={16} /> Back to nearby places</button>
            </section>}
          </div>
          <nav className="club-tabbar" aria-label="Home sections">
            <button className={`club-tab ${homeTab === "nearby" ? "active" : ""}`} onClick={() => setHomeTab("nearby")}><MapPin size={17} />Nearby</button>
            <button className={`club-tab ${homeTab === "week" ? "active" : ""}`} onClick={() => setHomeTab("week")}><Award size={17} />My week</button>
            <button className="club-tab" onClick={() => setRequestOpen(true)}><MessageCircle size={17} />Requests</button>
            <button className="club-tab" onClick={() => showNotice("Profile stays private in this sample.")}><span className="club-avatar-mini">A</span>You</button>
          </nav>
          {requestOpen && <div className="club-overlay">
            <div className="club-sheet">
              <div className="club-sheet-head"><span className="club-request-mark"><MessageCircle size={22} /></span><button className="club-circle-btn" aria-label="Close request" onClick={() => setRequestOpen(false)}><X size={17} /></button></div>
              <div className="club-small-label" style={{marginTop:14}}>PRIVATE REQUEST / SAMPLE</div>
              <h3>A hello from Jordan</h3>
              <p>You crossed paths at a participating place. Review this sample request before choosing whether to connect. No profile or position is being shared.</p>
              <button className="club-action primary" onClick={() => { setRequestOpen(false); showNotice("Request reviewed locally · no connection saved."); }}><Check size={17} /> Review request</button>
            </div>
          </div>}
          {homeCheckInOpen && <div className="club-overlay">
            <div className="club-sheet">
              <div className="club-sheet-head"><span className="club-request-mark"><ScanLine size={22} /></span><button className="club-circle-btn" aria-label="Close check-in" onClick={() => setHomeCheckInOpen(false)}><X size={17} /></button></div>
              <div className="club-small-label" style={{marginTop:14}}>A SMALL MOMENT, MARKED</div>
              <h3>Check in at Mira House?</h3>
              <p>Preview only. This prototype does not use location or save a visit. The real check-in stays your choice.</p>
              <button className="club-action primary" onClick={() => { setHomeCheckInOpen(false); showNotice("Sample check-in complete · nothing was recorded."); }}><Coffee size={17} /> Try sample check-in</button>
            </div>
          </div>}
        </Phone>

        <Phone title="02 / Venue — The regular’s table">
          <div className="club-scroll">
            <div className="club-venue-top">
              <button className="club-back" aria-label="Back to neighborhood" onClick={() => showNotice("Back to the River District · sample")}><ArrowLeft size={17} /></button>
              <span className="club-place-id">PUBLIC PLACE PROFILE</span>
              <button className="club-back" aria-label={saved ? "Unsave venue" : "Save venue"} onClick={() => { setSaved(!saved); showNotice(saved ? "Removed from your local saved list." : "Mira House saved for later · local preview."); }}><Heart size={17} fill={saved ? "#f15d3d" : "none"} color={saved ? "#f15d3d" : "#182b51"} /></button>
            </div>
            <div className="club-cover">
              <img src="/__mockup/images/coffee-shop.png" alt="Mira House Coffee, a neighborhood cafe" />
              <div className="club-cover-controls">
                <span className="club-venue-tag"><ShieldCheck size={12} /> PUBLIC / SAMPLE</span>
                <div className="club-cover-actions">
                  <button aria-label="Share Mira House" onClick={() => showNotice("Share preview · no link sent.")}><ArrowUpRight size={16} /></button>
                </div>
              </div>
              <div className="club-cover-title">
                <div className="club-kicker">RIVER DISTRICT / COFFEE &amp; PASTRY</div>
                <h2>Mira House Coffee</h2>
                <div className="club-cover-sub"><span>A neighborhood place to linger.</span><span className="club-rating"><Star size={13} fill="#d8ed67" color="#d8ed67" />4.9 <small>sample</small></span></div>
              </div>
            </div>
            <div className="club-venue-content">
              <div className="club-visitline"><span><Clock3 size={14} /> Today · 7 am–6 pm</span><span>River District <MapPin size={13} /></span></div>
              <div className="club-venue-actions">
                <button className="club-action primary" onClick={() => setVenueCheckInOpen(true)}><ScanLine size={17} /> Check in here</button>
                <button className="club-action" onClick={() => showNotice("Directions preview · no location opened.")}><Navigation size={16} /> Directions</button>
              </div>
              <div className="club-reward">
                <div className="club-reward-kicker"><Award size={14} /> THANKS FOR SHOWING UP / SAMPLE</div>
                <h3>Coffee &amp; pastry for two</h3>
                <p>A little thank-you for becoming part of the neighborhood.</p>
              </div>
              <div className="club-count-banner">
                <div><strong>86</strong><span>weekly venue interactions · pooled</span></div>
                <div className="club-count-mark"><Users size={21} /></div>
              </div>
              <div className="club-venue-tabs" role="tablist" aria-label="Venue details">
                <button className={venueTab === "story" ? "active" : ""} onClick={() => setVenueTab("story")}>The place</button>
                <button className={venueTab === "regulars" ? "active" : ""} onClick={() => setVenueTab("regulars")}>Regulars</button>
                <button className={venueTab === "notes" ? "active" : ""} onClick={() => setVenueTab("notes")}>Guestbook</button>
              </div>
              {venueTab === "story" && <div className="club-panel">
                <h3>A shared table, not a scene.</h3>
                <p>Careful coffee, warm pastry, and room for the neighborhood to become familiar. Come for a cup; stay as long as you like.</p>
                <div className="club-announcement"><span className="club-small-label">A NOTE FROM THE TEAM</span><br />“The community table is open all weekend. Pull up a chair.”</div>
                <div className="club-event">
                  <div className="club-event-date">SAT<br /><b>10</b></div>
                  <div className="club-event-info"><strong>Vinyl &amp; Slow Pour</strong><span>Saturday · 10 am · local gathering</span></div>
                  <button className="club-circle-btn" aria-label={rsvp ? "Cancel sample event interest" : "Show interest in sample event"} onClick={() => setRsvp(!rsvp)}>{rsvp ? <Check size={17} /> : <ArrowRight size={17} />}</button>
                </div>
                <div className="club-event" style={{paddingBottom:0}}>
                  <div className="club-event-date" style={{background:"#f15d3d"}}>NEXT<br /><b>WK</b></div>
                  <div className="club-event-info"><strong>Local Makers Morning</strong><span>Meet neighborhood artists &amp; makers</span></div>
                  <CalendarDays size={17} color="#244fce" />
                </div>
                {rsvp && <div className="club-announcement" style={{borderColor:"#244fce"}}>You’re marked interested in this sample event. Nothing has been sent or saved.</div>}
              </div>}
              {venueTab === "regulars" && <div className="club-panel">
                <div className="club-small-label" style={{marginBottom:10}}>A LITTLE LOCAL RECOGNITION</div>
                <h3>The familiar faces</h3>
                <p>Sample regulars, ranked by visits this month. Recognition here is about showing up at this place—not anyone’s live presence.</p>
                {[["01","Taylor M.","12 visits","TM"],["02","Jordan E.","9 visits","JE"],["03","Alex H.","7 visits","AH"]].map(([rank,name,visits,initials]) => <div className="club-rank" key={rank}><span className="club-rank-no">{rank}</span><span className="club-rank-avatar">{initials}</span><span className="club-rank-name">{name}</span><span className="club-rank-visits">{visits}</span></div>)}
              </div>}
              {venueTab === "notes" && <div className="club-panel">
                <div className="club-small-label" style={{marginBottom:10}}>HANDWRITTEN IN SPIRIT / SAMPLE</div>
                <h3>Guestbook</h3>
                <div className="club-quote">“A lovely place to slow down and meet the neighborhood.”<small>TAYLOR M. · 2 DAYS AGO · SAMPLE NOTE</small></div>
                <div className="club-quote">“The first place I learned my barista’s name. Then half the block’s.”<small>JORDAN E. · SAMPLE NOTE</small></div>
                <div className="club-contact">86 guestbook notes · sample collection<br />14 River Walk · River District<br />Open today until 6 pm · Contact details are sample-only</div>
              </div>}
              <div className="club-contact">Mira House Coffee · River District<br />Hours and contact shown for sample design only.</div>
            </div>
          </div>
          <div className="club-sticky">
            <button className="club-action primary" style={{width:"100%"}} onClick={() => setVenueCheckInOpen(true)}><ScanLine size={17} /> Check in at Mira House</button>
          </div>
          {venueCheckInOpen && <div className="club-overlay">
            <div className="club-sheet">
              <div className="club-sheet-head"><span className="club-request-mark"><Coffee size={22} /></span><button className="club-circle-btn" aria-label="Close check-in" onClick={() => setVenueCheckInOpen(false)}><X size={17} /></button></div>
              <div className="club-small-label" style={{marginTop:14}}>YOUR VISIT, YOUR CHOICE</div>
              <h3>Check in at Mira House?</h3>
              <p>This local prototype won’t use your location or record a visit. Check-in controls are shown for the design only.</p>
              <button className="club-action primary" onClick={() => { setVenueCheckInOpen(false); showNotice("Sample check-in · no visit was recorded."); }}><Check size={17} /> Try sample check-in</button>
            </div>
          </div>}
        </Phone>
      </div>
      {notice && <div className="club-toast" role="status">{notice}</div>}
      <div className="club-board-footer">POOLED ACTIVITY ONLY · PRIVATE BY CHOICE · ALL INTERACTIONS IN THIS PROTOTYPE STAY LOCAL</div>
      <style>{`
        .club-board-footer { position:absolute;bottom:8px;left:0;right:0;text-align:center;color:#7c8290;font:500 8px 'DM Mono',monospace;letter-spacing:.08em; }
        .club-avatar-mini { width:18px;height:18px;display:grid;place-items:center;border-radius:50%;background:#dbe2ef;color:#244fce;font-size:9px;font-weight:800; }
        @media (max-width:760px) { .club-board-footer { position:static;margin-top:16px;line-height:1.5; } }
      `}</style>
    </main>
  );
}
