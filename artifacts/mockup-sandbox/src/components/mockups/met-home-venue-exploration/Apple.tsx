import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  Bell,
  ChevronRight,
  Clock3,
  Coffee,
  Heart,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Navigation,
  Plus,
  Radio,
  ScanLine,
  ShieldCheck,
  Star,
  Users,
  Wifi,
  X,
} from "lucide-react";

const ink = "#202823";
const muted = "#7b837c";
const moss = "#456d59";

function IconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="icon-button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

function SectionTitle({
  title,
  trailing,
}: {
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h3>{title}</h3>
      {trailing}
    </div>
  );
}

function Device({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="device-column">
      <div className="device-label">
        <span>{title}</span>
        <span className="label-sub">GUEST APP · SAMPLE</span>
      </div>
      <div className="device-shell">
        <div className="phone-screen">
          <div className="status-bar">
            <span>9:41</span>
            <div className="dynamic-island" />
            <div className="status-icons">
              <Wifi size={13} strokeWidth={2.4} />
              <span className="battery"><i /></span>
            </div>
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}

export function Apple() {
  const [visible, setVisible] = useState(true);
  const [notice, setNotice] = useState("");
  const [rsvp, setRsvp] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  const inform = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  return (
    <main className="exploration">
      <style>{`
        * { box-sizing: border-box; }
        .exploration {
          width: 1120px; height: 900px; overflow: hidden; padding: 26px 54px 25px;
          color: ${ink}; background: #e9ebe5; font-family: "Avenir Next", "SF Pro Display", system-ui, sans-serif;
          position: relative; isolation: isolate;
        }
        .exploration:before {
          content:""; position:absolute; inset:0; z-index:-1; opacity:.25; pointer-events:none;
          background-image: radial-gradient(#748176 0.45px, transparent 0.45px); background-size: 8px 8px;
        }
        .board-head { width: 810px; margin: 0 auto 20px; }
        .eyebrow { display:flex; align-items:center; gap:8px; text-transform:uppercase; letter-spacing:.16em; color:#627267; font-size:9px; font-weight:700; }
        .eyebrow-mark { width:7px; height:7px; border-radius:50%; background:#6f8c75; }
        .head-line { display:flex; justify-content:space-between; align-items:flex-end; margin-top:6px; }
        .board-head h1 { font-size:25px; letter-spacing:-.055em; line-height:1; margin:0; font-weight:650; }
        .head-note { font-size:10px; color:#79827b; letter-spacing:.015em; }
        .screens { display:flex; justify-content:center; gap:31px; height:790px; }
        .device-column { display:flex; flex-direction:column; width:342px; min-width:0; }
        .device-label { display:flex; align-items:baseline; justify-content:space-between; height:23px; padding:0 5px; color:#34453a; font-size:12px; font-weight:650; }
        .label-sub { color:#899189; font-size:8px; letter-spacing:.12em; font-weight:650; }
        .device-shell { height:755px; padding:6px; border-radius:35px; background:#1d211f; border:1px solid rgba(255,255,255,.8); box-shadow:0 22px 46px rgba(45,55,45,.15), 0 3px 8px rgba(30,38,32,.08); }
        .phone-screen { height:100%; background:#fbfbf8; border-radius:29px; overflow:hidden; position:relative; display:flex; flex-direction:column; }
        .status-bar { height:32px; flex:none; display:flex; align-items:center; justify-content:space-between; padding:0 18px 0 20px; font-size:9px; font-weight:700; letter-spacing:.01em; position:relative; z-index:2; background:#fbfbf8; }
        .dynamic-island { width:84px; height:19px; background:#181c19; border-radius:20px; position:absolute; left:50%; top:5px; transform:translateX(-50%); }
        .status-icons { display:flex; align-items:center; gap:5px; }
        .battery { width:17px; height:9px; border:1px solid #3e4840; border-radius:2.5px; position:relative; padding:1px; }
        .battery:after { content:""; width:2px; height:4px; position:absolute; right:-3px; top:1.5px; border-radius:0 2px 2px 0; background:#3e4840; }
        .battery i { display:block; width:72%; height:100%; background:#3e4840; border-radius:1px; }
        .phone-scroll { flex:1; min-height:0; overflow:auto; scrollbar-width:none; }
        .phone-scroll::-webkit-scrollbar { display:none; }
        .home-top, .venue-top { display:flex; justify-content:space-between; align-items:center; padding:3px 17px 12px; }
        .brand-lockup { display:flex; align-items:center; gap:8px; }
        .brand-mark { width:26px; height:26px; border-radius:9px; color:white; background:#466955; display:grid; place-items:center; font-size:13px; font-weight:700; letter-spacing:-.08em; }
        .brand-word { font-size:17px; letter-spacing:-.06em; font-weight:700; }
        .icon-button { height:28px; width:28px; display:grid; place-items:center; border-radius:50%; border:1px solid #e7eae4; background:#fff; color:#526056; cursor:pointer; padding:0; }
        .avatar-demo { width:28px; height:28px; border-radius:50%; background:#e6e8df; color:#526552; display:grid; place-items:center; font-size:10px; font-weight:700; border:1px solid #dce1d8; }
        .privacy-card { margin:0 13px 11px; padding:10px 11px; border:1px solid #e5e9e2; border-radius:14px; background:#fff; }
        .privacy-row { display:flex; align-items:center; gap:8px; }
        .radio-icon { width:28px; height:28px; border-radius:10px; display:grid; place-items:center; color:${moss}; background:#edf3ed; }
        .privacy-copy { flex:1; min-width:0; }
        .privacy-copy strong { display:block; font-size:10px; line-height:1.2; letter-spacing:-.01em; }
        .privacy-copy span { display:block; color:${muted}; font-size:8px; margin-top:2px; }
        .toggle { height:20px; width:35px; border:0; border-radius:12px; padding:2px; background:#c7ccc5; cursor:pointer; transition:background .2s; }
        .toggle.on { background:${moss}; }
        .toggle i { display:block; width:16px; height:16px; border-radius:50%; background:white; box-shadow:0 1px 3px #33433330; transition:transform .2s; }
        .toggle.on i { transform:translateX(15px); }
        .perm-line { display:flex; gap:5px; align-items:center; color:#66816b; font-size:7.5px; padding:7px 0 0 36px; }
        .request-cue { margin:0 13px 10px; display:flex; gap:8px; align-items:center; padding:8px 10px; border-radius:12px; background:#f1f3ec; cursor:pointer; text-align:left; border:0; width:calc(100% - 26px); color:${ink}; }
        .request-dot { width:25px; height:25px; display:grid; place-items:center; background:#e2e9df; color:${moss}; border-radius:9px; }
        .request-cue strong { font-size:9px; display:block; }
        .request-cue small { color:${muted}; font-size:7.5px; display:block; margin-top:1px; }
        .request-cue > svg:last-child { margin-left:auto; color:#879287; }
        .home-intro { padding:4px 17px 9px; display:flex; align-items:flex-end; justify-content:space-between; }
        .home-intro h2 { margin:0; font-size:25px; font-weight:650; letter-spacing:-.065em; line-height:.95; }
        .home-intro p { color:${muted}; margin:5px 0 0; font-size:8.5px; }
        .count-block { text-align:right; }
        .count-number { font-size:30px; font-weight:600; line-height:.9; letter-spacing:-.075em; }
        .count-caption { color:${muted}; font-size:7.5px; padding-top:4px; }
        .map-card { height:156px; margin:0 13px 10px; overflow:hidden; position:relative; border-radius:15px; background:#e7ebe2; border:1px solid #e0e6dd; }
        .map-visual { position:absolute; inset:0; overflow:hidden; background:linear-gradient(135deg,#e8ece5,#e5e9e0); }
        .map-road { position:absolute; background:#fbfbf7; border:1px solid #dce2d7; border-radius:999px; }
        .road-a { width:430px; height:19px; left:-66px; top:67px; transform:rotate(-18deg); }
        .road-b { width:255px; height:16px; left:67px; top:4px; transform:rotate(53deg); }
        .road-c { width:260px; height:14px; left:117px; top:113px; transform:rotate(-46deg); }
        .road-d { width:225px; height:13px; left:-31px; top:120px; transform:rotate(48deg); }
        .map-river { position:absolute; height:17px; width:145px; border-radius:50%; background:#d4e1dc; transform:rotate(-36deg); left:186px; top:35px; }
        .map-block { position:absolute; background:#dbe5d9; border-radius:6px; opacity:.9; }
        .block-a { width:47px; height:24px; top:21px; left:26px; }
        .block-b { width:53px; height:26px; top:103px; left:223px; }
        .block-c { width:43px; height:21px; top:29px; right:23px; }
        .map-label { position:absolute; color:#7a897b; font-size:6.5px; letter-spacing:.1em; font-weight:700; }
        .label-river { top:27px; left:100px; }
        .label-old { bottom:24px; left:29px; }
        .label-market { top:99px; right:26px; }
        .place-pin { position:absolute; width:25px; height:25px; border-radius:9px 9px 9px 2px; transform:rotate(-45deg); display:grid; place-items:center; background:#fff; color:${moss}; border:1px solid #dce5d9; box-shadow:0 3px 10px #45574622; }
        .place-pin svg { transform:rotate(45deg); }
        .pin-one { left:40%; top:44%; }
        .pin-two { left:72%; top:23%; color:#8d7860; }
        .pin-three { left:19%; top:67%; color:#7c8775; }
        .map-count { position:absolute; top:10px; right:10px; z-index:1; padding:5px 8px; background:#fff; border:1px solid #e6e9e1; border-radius:999px; font-size:7.5px; color:#4f6354; display:flex; gap:4px; align-items:center; }
        .map-disclaimer { position:absolute; bottom:8px; left:10px; padding:4px 6px; border-radius:6px; background:#fbfbf8e8; color:#6c756d; font-size:6px; }
        .mini-venue { position:absolute; left:10px; top:10px; z-index:1; font-size:8px; font-weight:650; color:#38463b; background:#fbfbf8e8; border-radius:8px; padding:5px 7px; }
        .action-row { display:flex; gap:8px; margin:0 13px 13px; }
        .primary-action { flex:1; display:flex; align-items:center; justify-content:center; gap:7px; color:white; border:0; border-radius:12px; height:38px; background:#456d59; font-size:9px; font-weight:650; cursor:pointer; box-shadow:0 3px 8px #456d5925; }
        .secondary-action { flex:1; display:flex; align-items:center; justify-content:center; gap:7px; color:#435247; border:1px solid #e1e6df; border-radius:12px; height:38px; background:#fff; font-size:9px; font-weight:650; cursor:pointer; }
        .compact-section { margin:0 13px 11px; }
        .section-title { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; }
        .section-title h3 { margin:0; font-size:11px; letter-spacing:-.035em; font-weight:650; }
        .section-link { border:0; background:none; color:#718274; font-size:8px; cursor:pointer; padding:0; }
        .week-card { display:flex; background:#fff; border:1px solid #e8ebe5; border-radius:12px; padding:9px 10px; }
        .week-stat { flex:1; display:flex; align-items:center; gap:7px; }
        .week-stat + .week-stat { border-left:1px solid #e8ebe5; padding-left:10px; margin-left:9px; }
        .week-value { font-size:19px; font-weight:600; letter-spacing:-.07em; line-height:1; }
        .week-label { font-size:7px; line-height:1.25; color:${muted}; }
        .community-note { background:#f0f3ec; border-radius:11px; padding:8px 10px; display:flex; align-items:center; gap:8px; }
        .note-avatar { height:24px; width:24px; border-radius:8px; display:grid; place-items:center; background:#dfe7dc; color:#596d5c; font-size:8px; font-weight:700; }
        .community-note p { margin:0; font-size:8px; line-height:1.4; color:#505a51; }
        .community-note strong { color:#334339; font-weight:650; }
        .home-tabbar { height:47px; display:flex; justify-content:space-around; align-items:center; border-top:1px solid #eeefe9; background:#fbfbf8; flex:none; }
        .tab { display:flex; flex-direction:column; align-items:center; gap:3px; color:#899189; font-size:6.5px; }
        .tab.active { color:${moss}; font-weight:650; }
        .tab svg { width:14px; height:14px; }
        .cover-wrap { position:relative; height:157px; margin:0 10px; overflow:hidden; border-radius:16px; background:#c4b29b; }
        .cover-wrap img { width:100%; height:100%; display:block; object-fit:cover; object-position:center 43%; }
        .cover-shade { position:absolute; inset:40% 0 0; background:linear-gradient(transparent,rgba(24,27,24,.58)); }
        .cover-controls { position:absolute; top:9px; left:9px; right:9px; display:flex; justify-content:space-between; }
        .cover-pill { display:flex; align-items:center; gap:4px; color:#fff; background:#202822a8; backdrop-filter:blur(8px); padding:5px 7px; border-radius:99px; font-size:7px; font-weight:600; }
        .cover-buttons { display:flex; gap:6px; }
        .cover-buttons button { color:#273129; background:#ffffffed; width:26px; height:26px; border:0; border-radius:50%; display:grid; place-items:center; cursor:pointer; }
        .cover-title { position:absolute; bottom:12px; left:13px; color:white; }
        .cover-title small { font-size:7px; text-transform:uppercase; letter-spacing:.12em; opacity:.85; }
        .cover-title h2 { font-size:22px; letter-spacing:-.06em; margin:3px 0 0; line-height:1; font-weight:650; }
        .venue-body { padding:10px 13px 12px; }
        .venue-meta-row { display:flex; align-items:center; justify-content:space-between; padding-bottom:9px; border-bottom:1px solid #edeee9; }
        .category { color:#758076; font-size:8px; }
        .rating { display:flex; align-items:center; gap:4px; font-size:8px; font-weight:650; }
        .rating small { color:${muted}; font-weight:400; }
        .visit-row { display:flex; align-items:center; gap:8px; padding:8px 0 10px; }
        .visit-item { display:flex; align-items:center; gap:4px; color:#556258; font-size:7.3px; }
        .visit-item svg { color:#718a74; }
        .dot-sep { color:#b5bcb4; }
        .venue-cta { display:flex; gap:7px; margin-bottom:11px; }
        .venue-cta .primary-action, .venue-cta .secondary-action { height:34px; font-size:8.5px; }
        .reward-card { padding:10px 11px; border:1px solid #e6e9e1; border-radius:13px; background:#f5f6f1; margin-bottom:10px; }
        .reward-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; }
        .reward-kicker { color:#6b806c; text-transform:uppercase; letter-spacing:.12em; font-size:6.5px; font-weight:700; }
        .reward-tag { display:flex; align-items:center; gap:3px; font-size:6.5px; color:#607b63; border:1px solid #d6e1d4; background:#edf3eb; padding:3px 6px; border-radius:999px; }
        .reward-card h3 { margin:0; font-size:11px; letter-spacing:-.03em; }
        .reward-card p { margin:3px 0 0; color:#657067; font-size:7.5px; }
        .announcement { padding:9px 10px; border-radius:12px; border:1px solid #eaece6; background:white; margin-bottom:10px; }
        .announce-kicker { display:flex; gap:4px; align-items:center; color:#7b816d; text-transform:uppercase; letter-spacing:.1em; font-size:6px; font-weight:700; }
        .announcement p { margin:5px 0 0; font-size:8px; line-height:1.4; color:#535d53; }
        .lower-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
        .mini-panel { border:1px solid #e9ece6; border-radius:12px; background:#fff; padding:8px; min-width:0; }
        .mini-panel h3 { font-size:9px; margin:0 0 6px; letter-spacing:-.02em; }
        .rank-row { display:flex; align-items:center; gap:5px; margin-top:5px; color:#556058; font-size:7px; }
        .rank-n { color:#89928a; width:8px; }
        .rank-name { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .rank-score { color:#536c58; font-weight:650; }
        .event-kicker { font-size:6px; letter-spacing:.08em; text-transform:uppercase; color:#758176; margin-bottom:3px; }
        .event-name { font-size:8px; font-weight:650; line-height:1.2; }
        .event-detail { font-size:6.5px; color:${muted}; margin:4px 0 6px; }
        .rsvp-button { border:0; background:#edf2eb; color:#4f6954; font-size:6.5px; border-radius:7px; padding:5px 7px; cursor:pointer; font-weight:650; }
        .guestbook { border:1px solid #e9ece6; border-radius:12px; padding:8px 9px; background:#fff; margin-bottom:8px; }
        .guest-review { font-size:7.3px; color:#59625a; line-height:1.4; margin:0; }
        .review-foot { display:flex; align-items:center; justify-content:space-between; margin-top:5px; color:#899188; font-size:6.5px; }
        .contact-line { display:flex; align-items:center; gap:5px; color:#707a71; font-size:6.7px; margin-top:5px; }
        .venue-bottom { height:43px; padding:0 13px; border-top:1px solid #eeefe9; background:#fbfbf8; display:flex; justify-content:space-between; align-items:center; flex:none; }
        .bottom-label { color:#7f887f; font-size:7px; }
        .bottom-checkin { display:flex; align-items:center; gap:6px; border:0; border-radius:9px; background:${moss}; color:white; padding:8px 11px; font-size:8px; font-weight:650; cursor:pointer; }
        .toast { position:absolute; z-index:5; left:50%; bottom:56px; transform:translateX(-50%); background:#26342b; color:#fff; border-radius:99px; padding:9px 13px; white-space:nowrap; font-size:8px; box-shadow:0 8px 24px #26342b35; animation:toast-in .22s ease-out; }
        @keyframes toast-in { from { opacity:0; transform:translate(-50%,6px); } to { opacity:1; transform:translate(-50%,0); } }
        .modal-shade { position:absolute; inset:32px 0 0; z-index:4; background:#1c271f66; display:flex; align-items:center; justify-content:center; padding:24px; }
        .request-modal { background:#fbfbf8; width:100%; border-radius:18px; padding:18px; box-shadow:0 18px 50px #1f2b2340; }
        .modal-close { float:right; border:0; background:#eff1eb; color:#546255; width:24px; height:24px; border-radius:50%; display:grid; place-items:center; cursor:pointer; }
        .modal-avatar { width:42px; height:42px; display:grid; place-items:center; border-radius:14px; background:#e5eadf; color:#586d59; font-size:13px; font-weight:650; margin-bottom:10px; }
        .request-modal h3 { font-size:15px; letter-spacing:-.04em; margin:0 0 4px; }
        .request-modal p { color:#788178; font-size:9px; line-height:1.5; margin:0 0 12px; }
        .modal-actions { display:flex; gap:7px; }
        .modal-actions button { flex:1; height:32px; border-radius:9px; border:1px solid #e4e8e1; background:white; color:#4d5a50; font-size:8px; font-weight:650; cursor:pointer; }
        .modal-actions button:last-child { background:${moss}; color:white; border-color:${moss}; }
        @media (max-width: 760px) {
          .exploration { width:100%; height:auto; min-height:100dvh; padding:20px 15px; overflow:visible; }
          .board-head { width:100%; margin-bottom:22px; }
          .screens { height:auto; flex-direction:column; align-items:center; gap:22px; }
          .device-column { width:min(342px,100%); }
          .device-shell { height:min(755px, calc(100dvh - 95px)); }
        }
      `}</style>

      <header className="board-head">
        <div className="eyebrow"><i className="eyebrow-mark" /> MET / GUEST EXPERIENCE STUDY</div>
        <div className="head-line">
          <h1>Find your people, by place.</h1>
          <span className="head-note">A quieter way into the neighborhood</span>
        </div>
      </header>

      <div className="screens">
        <Device title="01 / Home" >
          <div className="phone-scroll">
            <div className="home-top">
              <div className="brand-lockup">
                <div className="brand-mark">m</div><span className="brand-word">met</span>
              </div>
              <IconButton label="Notifications" onClick={() => inform("You’re all caught up.")}><Bell size={16} /></IconButton>
            </div>
            <div className="privacy-card">
              <div className="privacy-row">
                <div className="radio-icon"><Radio size={15} /></div>
                <div className="privacy-copy">
                  <strong>{visible ? "Visible to nearby guests" : "Your beacon is off"}</strong>
                  <span>{visible ? "Only opted-in guests can discover you" : "Turn on when you’re ready to be found"}</span>
                </div>
                <button className={`toggle ${visible ? "on" : ""}`} aria-label="Toggle local beacon visibility" aria-pressed={visible} onClick={() => setVisible(!visible)}><i /></button>
              </div>
              <div className="perm-line"><ShieldCheck size={11} /> Location &amp; Bluetooth ready <span>·</span> sample permission state</div>
            </div>
            <button className="request-cue" onClick={() => setShowRequest(true)}>
              <span className="request-dot"><Users size={13} /></span>
              <span><strong>1 connection request</strong><small>Review before you connect</small></span>
              <ChevronRight size={14} />
            </button>
            <div className="home-intro">
              <div><h2>Good morning,<br />Alex.</h2><p>River District · a sample neighborhood</p></div>
              <div className="count-block"><div className="count-number">{visible ? "04" : "—"}</div><div className="count-caption">nearby guests<br />within 2.4 km</div></div>
            </div>
            <div className="map-card">
              <div className="map-visual">
                <div className="map-road road-a" /><div className="map-road road-b" /><div className="map-road road-c" /><div className="map-road road-d" />
                <div className="map-river" /><div className="map-block block-a" /><div className="map-block block-b" /><div className="map-block block-c" />
                <span className="map-label label-river">RIVER WALK</span><span className="map-label label-old">OLD TOWN</span><span className="map-label label-market">MARKET QUARTER</span>
                <div className="place-pin pin-one"><Coffee size={12} /></div><div className="place-pin pin-two"><MapPin size={11} /></div><div className="place-pin pin-three"><MapPin size={11} /></div>
                <span className="mini-venue">Mira House · 6.8 km</span>
              </div>
              <span className="map-count"><Users size={10} /> {visible ? "4" : "0"} nearby</span>
              <span className="map-disclaimer">Aggregated venue activity · no live guest positions</span>
            </div>
            <div className="action-row">
              <button className="primary-action" onClick={() => inform("Demo check-in ready · no venue visit recorded.")}><ScanLine size={14} /> Check in</button>
              <button className="secondary-action" onClick={() => inform("Leaderboard preview · visit a venue to join.")}><Award size={14} /> Leaderboard</button>
            </div>
            <section className="compact-section">
              <SectionTitle title="This week" trailing={<button className="section-link" onClick={() => inform("Your weekly encounters are a sample.")}>See activity</button>} />
              <div className="week-card">
                <div className="week-stat"><div className="week-value">3</div><div className="week-label">new<br />encounters</div></div>
                <div className="week-stat"><div className="week-value">2</div><div className="week-label">familiar<br />faces again</div></div>
              </div>
            </section>
            <section className="compact-section">
              <SectionTitle title="Around the neighborhood" trailing={<button className="section-link" onClick={() => inform("Showing sample community notes.")}>Recent</button>} />
              <div className="community-note"><span className="note-avatar">MH</span><p><strong>Mira House Coffee</strong> · Community table is open this weekend. <span style={{color:"#8b938b"}}>Sample note</span></p><ArrowUpRight size={12} color="#738477" /></div>
            </section>
          </div>
          <div className="home-tabbar">
            <div className="tab active"><MapPin /><span>Home</span></div><div className="tab"><Users /><span>People</span></div><div className="tab"><MessageCircle /><span>Messages</span></div><div className="tab"><div className="avatar-demo" style={{width:17,height:17,fontSize:6}}>A</div><span>You</span></div>
          </div>
          {showRequest && <div className="modal-shade">
            <div className="request-modal">
              <button className="modal-close" aria-label="Close request" onClick={() => setShowRequest(false)}><X size={13} /></button>
              <div className="modal-avatar">JM</div>
              <h3>Jordan would like to connect</h3>
              <p>Met at a participating venue nearby. Sample request only; no profile or location is being shared.</p>
              <div className="modal-actions"><button onClick={() => { setShowRequest(false); inform("Request dismissed in this demo."); }}>Not now</button><button onClick={() => { setShowRequest(false); inform("Connection accepted in this demo."); }}>Review request</button></div>
            </div>
          </div>}
        </Device>

        <Device title="02 / Public venue">
          <div className="phone-scroll">
            <div className="venue-top">
              <IconButton label="Back to Home" onClick={() => inform("Back to Home preview.")}><ArrowLeft size={16} /></IconButton>
              <span style={{fontSize:9,fontWeight:650,color:"#738076"}}>PLACE PROFILE</span>
              <IconButton label="More venue options" onClick={() => inform("Venue options are preview-only.")}><MoreHorizontal size={17} /></IconButton>
            </div>
            <div className="cover-wrap">
              <img src="/__mockup/images/coffee-shop.png" alt="Warm interior at a neighborhood coffee shop" />
              <div className="cover-shade" />
              <div className="cover-controls">
                <span className="cover-pill"><ShieldCheck size={10} /> SAMPLE VENUE</span>
                <div className="cover-buttons">
                  <button aria-label={saved ? "Remove saved venue" : "Save venue"} onClick={() => { setSaved(!saved); inform(saved ? "Removed from saved places." : "Mira House saved for later."); }}><Heart size={13} fill={saved ? "#456d59" : "none"} color={saved ? "#456d59" : "#334038"} /></button>
                  <button aria-label="Share venue" onClick={() => inform("Share preview · no link sent.")}><ArrowUpRight size={13} /></button>
                </div>
              </div>
              <div className="cover-title"><small>River District · Coffee &amp; bakery</small><h2>Mira House Coffee</h2></div>
            </div>
            <div className="venue-body">
              <div className="venue-meta-row">
                <span className="category">A neighborhood café for slow mornings.</span>
                <span className="rating"><Star size={11} fill="#a77b3e" color="#a77b3e" /> 4.9 <small>(128)</small></span>
              </div>
              <div className="visit-row">
                <span className="visit-item"><Clock3 size={11} /> Open today · 7 am–6 pm</span><span className="dot-sep">·</span>
                <span className="visit-item"><MapPin size={11} /> River District</span>
              </div>
              <div className="venue-cta">
                <button className="primary-action" onClick={() => inform("Demo check-in · no visit recorded.")}><ScanLine size={13} /> Check in here</button>
                <button className="secondary-action" onClick={() => inform("Directions preview · sample neighborhood only.")}><Navigation size={12} /> Directions</button>
              </div>
              <div className="reward-card">
                <div className="reward-top"><span className="reward-kicker">A reason to come back</span><span className="reward-tag"><Award size={9} /> Active · sample</span></div>
                <h3>Mira House regular</h3>
                <p>A coffee and pastry for two · a little thank-you for showing up.</p>
              </div>
              <div className="announcement">
                <div className="announce-kicker"><Plus size={9} /> Pinned from the team</div>
                <p>“The community table is open all weekend. Come say hello.”</p>
              </div>
              <div className="lower-grid">
                <div className="mini-panel">
                  <h3>Local leaderboard</h3>
                  <div className="rank-row"><span className="rank-n">1</span><span className="rank-name">Taylor M.</span><span className="rank-score">12 visits</span></div>
                  <div className="rank-row"><span className="rank-n">2</span><span className="rank-name">Jordan E.</span><span className="rank-score">9 visits</span></div>
                </div>
                <div className="mini-panel">
                  <h3>Coming up</h3>
                  <div className="event-kicker">SAT · 10:00 AM</div>
                  <div className="event-name">Vinyl &amp; Slow Pour</div>
                  <div className="event-detail">31 going · sample event</div>
                  <button className="rsvp-button" onClick={() => { setRsvp(!rsvp); inform(rsvp ? "RSVP removed in demo." : "You’re on the sample RSVP list."); }}>{rsvp ? "Going ✓" : "RSVP"}</button>
                </div>
              </div>
              <div className="guestbook">
                <SectionTitle title="Guestbook" trailing={<button className="section-link" onClick={() => inform("Guestbook preview · sample reviews only.")}>See all 128</button>} />
                <p className="guest-review">“A lovely place to slow down and meet the neighborhood.”</p>
                <div className="review-foot"><span>Taylor M. · 2 days ago · sample review</span><span style={{color:"#a77b3e"}}>★★★★★</span></div>
              </div>
              <div style={{padding:"0 1px 6px"}}>
                <div className="contact-line"><MapPin size={10} /> 24 River Walk, River District <span style={{color:"#aeb5ac"}}>· sample address</span></div>
                <div className="contact-line"><MessageCircle size={10} /> hello@mirahouse.example <span style={{marginLeft:"auto"}}>(555) 010-2146</span></div>
                <div className="contact-line"><Clock3 size={10} /> Hours vary · Thu–Sat until 8 pm</div>
                <p style={{fontSize:7.2,lineHeight:1.45,color:"#737d74",margin:"6px 0 2px"}}>A welcoming neighborhood café with thoughtful coffee, fresh bakes, and a long table made for good conversation.</p>
              </div>
            </div>
          </div>
          <div className="venue-bottom"><span className="bottom-label">Mira House Coffee · River District</span><button className="bottom-checkin" onClick={() => inform("Demo check-in · no visit recorded.")}><ScanLine size={12} /> Check in</button></div>
        </Device>
      </div>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
