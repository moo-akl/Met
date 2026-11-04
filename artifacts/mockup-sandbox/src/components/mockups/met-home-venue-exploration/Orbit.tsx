import { useState, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Award,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  MapPin,
  Navigation,
  Radio,
  ShieldCheck,
  Star,
  Users,
  Wifi,
} from "lucide-react";

type VenueTab = "story" | "gather" | "guestbook";
type HomeTab = "nearby" | "week" | "places";

function PhoneFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="orbit-device">
      <div className="orbit-device-label">
        <span>{title}</span>
        <span>MET · SAMPLE VIEW</span>
      </div>
      <div className="orbit-phone">
        <div className="orbit-screen">
          <div className="orbit-status">
            <span>9:41</span>
            <i className="orbit-island" />
            <span className="orbit-status-right"><Wifi size={14} /><i /></span>
          </div>
          {children}
          <div className="orbit-home-indicator" />
        </div>
      </div>
    </section>
  );
}

export function Orbit() {
  const [visible, setVisible] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [homeTab, setHomeTab] = useState<HomeTab>("nearby");
  const [venueTab, setVenueTab] = useState<VenueTab>("story");
  const [checkedIn, setCheckedIn] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rsvp, setRsvp] = useState(false);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);

  return (
    <main className="orbit-board">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap');
        .orbit-board, .orbit-board * { box-sizing: border-box; }
        .orbit-board {
          --paper:#f4f0e6; --paper-hi:#fffdf7; --ink:#222d3b; --muted:#69727b;
          --blue:#4059ce; --blue-dark:#293eaa; --blue-pale:#e4e9ff; --orange:#f27652;
          --yellow:#f1c85b; --line:#dcd8cb; --green:#637e63;
          width:1120px; height:1020px; padding:24px 48px 22px; overflow:hidden;
          color:var(--ink); background:
            radial-gradient(ellipse at 50% 0%,rgba(255,255,255,.88),transparent 55%),
            var(--paper);
          font-family:'Manrope',system-ui,sans-serif; position:relative; isolation:isolate;
        }
        .orbit-board:before { content:""; position:absolute; inset:0; z-index:-1; pointer-events:none; opacity:.16;
          background-image:radial-gradient(#7e806f .55px,transparent .55px); background-size:7px 7px; }
        .orbit-board button { font:inherit; }
        .orbit-head { display:flex; justify-content:space-between; align-items:end; max-width:890px; margin:0 auto 17px; }
        .orbit-markline { display:flex; align-items:center; gap:9px; color:#66717a; font:500 10px 'DM Mono',monospace; letter-spacing:.14em; }
        .orbit-mark { width:19px;height:19px;border-radius:50%;border:1.5px solid var(--blue);position:relative; }
        .orbit-mark:before { content:"";position:absolute;width:6px;height:6px;left:5px;top:5px;border-radius:50%;background:var(--orange); }
        .orbit-head h1 { margin:7px 0 0; font:500 32px/1 'Newsreader',serif; letter-spacing:-.035em; }
        .orbit-head-note { max-width:218px; color:#747b78; font-size:11px; line-height:1.5; text-align:right; }
        .orbit-screens { display:flex; justify-content:center; gap:35px; align-items:start; }
        .orbit-device { width:430px; flex:0 0 430px; }
        .orbit-device-label { height:25px; padding:0 8px; display:flex; align-items:center; justify-content:space-between; color:#4c5861; font-size:12px; font-weight:800; letter-spacing:.02em; }
        .orbit-device-label span:last-child { font:500 8px 'DM Mono',monospace; letter-spacing:.12em; color:#929187; }
        .orbit-phone { height:900px; border:1px solid #b9b6ac; border-radius:41px; padding:7px; background:#20232c; box-shadow:0 24px 54px rgba(37,40,53,.16),0 3px 7px #21232b33; }
        .orbit-screen { height:100%; border-radius:34px; overflow:hidden; background:var(--paper-hi); display:flex; flex-direction:column; position:relative; }
        .orbit-status { flex:0 0 34px; position:relative; z-index:4; display:flex; align-items:center; justify-content:space-between; padding:0 22px; font-size:10px; font-weight:800; }
        .orbit-island { width:86px;height:19px;border-radius:20px;background:#171a20;position:absolute;left:50%;top:5px;transform:translateX(-50%); }
        .orbit-status-right { display:flex;align-items:center;gap:6px; }
        .orbit-status-right i { display:block;width:16px;height:9px;border:1px solid currentColor;border-radius:2px;position:relative; }
        .orbit-status-right i:before { content:"";position:absolute;inset:1px 4px 1px 1px;border-radius:1px;background:currentColor; }
        .orbit-scroll { flex:1; min-height:0; overflow:auto; scrollbar-width:none; overscroll-behavior:contain; }
        .orbit-scroll::-webkit-scrollbar { display:none; }
        .orbit-home-top { display:flex;justify-content:space-between;align-items:center;padding:4px 22px 14px; }
        .orbit-brand { display:flex;align-items:center;gap:8px;font-size:17px;font-weight:800;letter-spacing:-.07em; }
        .orbit-brand-mark { width:22px;height:22px;border-radius:50%;border:1.5px solid var(--blue);display:grid;place-items:center; }
        .orbit-brand-mark i { width:7px;height:7px;border-radius:50%;background:var(--orange);display:block; }
        .orbit-sample { font:500 8px 'DM Mono',monospace;letter-spacing:.08em;color:#939186;text-transform:uppercase; }
        .orbit-home-title { padding:5px 23px 0; }
        .orbit-location { display:flex;align-items:center;gap:6px;font:500 10px 'DM Mono',monospace;color:#737a78;letter-spacing:.045em; }
        .orbit-home-title h2 { margin:9px 0 0;font:500 32px/.98 'Newsreader',serif;letter-spacing:-.035em;max-width:295px; }
        .orbit-home-title p { margin:8px 0 0;color:#707875;font-size:12px;line-height:1.45; }
        .orbit-orb-stage { height:340px; margin:2px 12px 0; position:relative; overflow:hidden; }
        .orbit-disc { position:absolute;width:294px;height:294px;left:50%;top:16px;transform:translateX(-50%);border-radius:50%;
          background:radial-gradient(circle at 38% 30%,#fff9d8 0,#f4d875 28%,#e9b64e 54%,#d98d55 75%,#d67664 100%);
          box-shadow:inset -18px -22px 34px rgba(156,82,65,.18),inset 12px 12px 24px rgba(255,255,255,.72),0 20px 28px rgba(78,70,52,.16);
          animation:orbit-float 7s ease-in-out infinite; }
        .orbit-disc:before,.orbit-disc:after { content:"";position:absolute;inset:22px;border:1px solid rgba(255,255,255,.65);border-radius:50%;transform:rotate(-24deg) scaleY(.42); }
        .orbit-disc:after { inset:43px;border-color:rgba(89,83,70,.23);transform:rotate(21deg) scaleY(.54); }
        .orbit-disc-core { position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;z-index:2;padding-top:2px; }
        .orbit-count { font:500 82px/.86 'Newsreader',serif;letter-spacing:-.09em;color:#263348; }
        .orbit-count-label { font:500 10px 'DM Mono',monospace;letter-spacing:.11em;text-transform:uppercase;color:#4e514a;margin-top:9px; }
        .orbit-inner-note { font-size:11px;color:#5b5e56;margin-top:5px; }
        .orbit-ring { position:absolute;left:50%;top:16px;width:322px;height:322px;transform:translateX(-50%);border-radius:50%;border:1px solid rgba(64,89,206,.24); }
        .orbit-ring:after { content:"";position:absolute;inset:13px;border-radius:50%;border:1px dashed rgba(64,89,206,.3); }
        .orbit-node { position:absolute;z-index:3;display:flex;align-items:center;gap:7px;padding:7px 10px;background:#fffdf8;border:1px solid rgba(47,61,98,.13);border-radius:30px;box-shadow:0 5px 12px rgba(45,49,58,.11);font-size:10px;font-weight:800;white-space:nowrap; }
        .orbit-node i { display:block;width:8px;height:8px;border-radius:50%;background:var(--blue);box-shadow:0 0 0 4px #e2e6ff; }
        .orbit-node.n1 { left:1%;top:54px; }.orbit-node.n2 { right:0;top:117px; }.orbit-node.n3 { left:6%;bottom:48px; }
        .orbit-node.n2 i { background:var(--orange);box-shadow:0 0 0 4px #ffe6db; }.orbit-node.n3 i { background:#6c9a79;box-shadow:0 0 0 4px #e0eee0; }
        .orbit-node small { color:#84867f;font:500 9px 'DM Mono',monospace; }
        .orbit-orbit-caption { position:absolute;left:50%;bottom:9px;transform:translateX(-50%);white-space:nowrap;color:#777b75;font:500 8px 'DM Mono',monospace;letter-spacing:.09em;text-transform:uppercase; }
        .orbit-beacon { width:calc(100% - 36px);margin:0 18px 11px;padding:12px 14px;border-radius:16px;background:#e8ebff;display:flex;align-items:center;gap:11px;text-align:left;border:0;color:#293a88;cursor:pointer;min-height:58px; }
        .orbit-beacon-icon { width:34px;height:34px;border-radius:50%;background:#fff;display:grid;place-items:center;flex:none; }
        .orbit-beacon-copy { flex:1; }.orbit-beacon strong { display:block;font-size:13px; }.orbit-beacon small { display:block;font-size:10px;color:#606c9c;margin-top:2px; }
        .orbit-switch { width:44px;height:26px;border-radius:18px;background:#aeb6d9;padding:3px;transition:background .2s;flex:none; }
        .orbit-switch i { display:block;width:20px;height:20px;border-radius:50%;background:white;box-shadow:0 1px 4px #2225;transition:transform .2s; }
        .orbit-switch.on { background:var(--blue); }.orbit-switch.on i { transform:translateX(18px); }
        .orbit-request { margin:0 18px 13px;width:calc(100% - 36px);border:0;background:transparent;padding:3px 2px 10px;display:flex;align-items:center;gap:10px;text-align:left;color:var(--ink);border-bottom:1px solid var(--line);cursor:pointer; }
        .orbit-request-mark { width:33px;height:33px;border-radius:50%;display:grid;place-items:center;background:#fbe6dc;color:#c75c3c; }
        .orbit-request strong { display:block;font-size:12px; }.orbit-request small { display:block;font-size:10px;color:#737875;margin-top:2px; }
        .orbit-request > svg:last-child { margin-left:auto;color:#878d8a; }
        .orbit-request-detail { margin:-4px 18px 12px;padding:13px 14px;border-radius:15px;background:#fff6ef;border:1px solid #f4d6c7;animation:orbit-in .22s ease-out; }
        .orbit-request-detail strong { font:500 18px 'Newsreader',serif; }.orbit-request-detail p { margin:5px 0 10px;color:#71746f;font-size:11px;line-height:1.45; }
        .orbit-request-detail button { border:0;background:var(--blue);color:white;border-radius:12px;padding:10px 13px;font-size:11px;font-weight:800;cursor:pointer; }
        .orbit-feature { margin:2px 18px 13px;display:flex;align-items:center;gap:12px;padding:9px;border-radius:18px;background:#f0eee5;border:1px solid #e5e0d3;cursor:pointer; }
        .orbit-feature img { width:76px;height:72px;object-fit:cover;border-radius:13px; }
        .orbit-feature-copy { flex:1;min-width:0; }.orbit-feature-copy small { display:block;color:#797a72;font:500 9px 'DM Mono',monospace;letter-spacing:.06em;text-transform:uppercase; }
        .orbit-feature-copy strong { display:block;font:500 18px/1.05 'Newsreader',serif;margin-top:4px; }.orbit-feature-copy span { display:block;color:#6a716d;font-size:10px;margin-top:5px; }
        .orbit-feature > svg { color:var(--blue);flex:none; }
        .orbit-week { margin:0 18px 15px;padding:15px 16px 13px;border-radius:17px;background:#293dba;color:white;position:relative;overflow:hidden; }
        .orbit-week:after { content:"";position:absolute;width:138px;height:138px;border:1px solid #ffffff26;border-radius:50%;right:-36px;top:-54px;box-shadow:0 0 0 17px #ffffff0c,0 0 0 35px #ffffff08; }
        .orbit-week-top { display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1; }
        .orbit-week-top strong { font-size:12px; }.orbit-week-top span { font:500 9px 'DM Mono',monospace;color:#d2d9ff; }
        .orbit-week-counts { display:flex;gap:23px;margin-top:9px;position:relative;z-index:1; }
        .orbit-week-counts b { font:500 29px/.9 'Newsreader',serif; }.orbit-week-counts span { font-size:10px;color:#d8ddff;margin-left:5px; }
        .orbit-week-note { margin:8px 0 0;font-size:10px;color:#d2d9ff;position:relative;z-index:1; }
        .orbit-request-note { margin:0 18px 16px;padding:11px 13px;border-left:2px solid var(--orange);background:#fff7ef;font:italic 16px/1.25 'Newsreader',serif;color:#53524c; }
        .orbit-tabbar { flex:none;height:60px;border-top:1px solid #e8e4da;background:#fffdf7;display:flex;justify-content:space-around;align-items:center; }
        .orbit-tab { border:0;background:none;color:#848781;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:9px;cursor:pointer;padding:7px 10px; }
        .orbit-tab.active { color:var(--blue);font-weight:800; }.orbit-tab svg { width:17px;height:17px; }
        .orbit-tab-content { padding:14px 19px 20px;animation:orbit-in .22s ease-out; }
        .orbit-tab-content h3 { margin:0;font:500 22px 'Newsreader',serif; }.orbit-tab-content p { font-size:12px;line-height:1.55;color:#707772;margin:8px 0; }
        .orbit-activity-line { display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--line);font-size:12px; }.orbit-activity-line b { color:var(--blue); }

        .orbit-venue-nav { display:flex;justify-content:space-between;align-items:center;padding:4px 18px 10px; }
        .orbit-icon-button { width:36px;height:36px;border-radius:50%;border:1px solid #dedbd1;background:#fffdf8;color:#3d4650;display:grid;place-items:center;cursor:pointer; }
        .orbit-venue-nav span { font:500 9px 'DM Mono',monospace;letter-spacing:.12em;color:#777d77; }
        .orbit-venue-hero { margin:0 14px;position:relative;min-height:390px;border-radius:25px;overflow:hidden;background:#e6c18a; }
        .orbit-venue-hero > img { position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 48%;filter:saturate(.83); }
        .orbit-venue-hero:after { content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(22,31,43,.12) 0%,transparent 32%,rgba(28,37,52,.8) 100%); }
        .orbit-venue-orbit { position:absolute;z-index:1;width:278px;height:278px;border:1px solid rgba(255,250,234,.78);border-radius:50%;left:50%;top:40px;transform:translateX(-50%);box-shadow:0 0 0 12px rgba(255,255,255,.09),0 0 0 26px rgba(255,255,255,.07); }
        .orbit-venue-orbit:before { content:"";position:absolute;inset:17px;border:1px dashed rgba(255,250,234,.72);border-radius:50%; }
        .orbit-venue-dot { position:absolute;z-index:2;top:83px;right:34px;width:48px;height:48px;border:5px solid #fff7e6;border-radius:50%;background:var(--orange);box-shadow:0 5px 13px #43322455; }
        .orbit-venue-sample { position:absolute;z-index:2;top:15px;left:15px;background:#fffaf0e8;padding:7px 10px;border-radius:30px;color:#43463e;font:500 9px 'DM Mono',monospace;letter-spacing:.05em; }
        .orbit-venue-save { position:absolute;z-index:3;top:13px;right:14px;width:36px;height:36px;border:0;border-radius:50%;background:#fffaf0e8;color:#35405b;display:grid;place-items:center;cursor:pointer; }
        .orbit-venue-heading { position:absolute;z-index:2;left:19px;right:18px;bottom:19px;color:#fffaf0; }
        .orbit-venue-heading small { font:500 9px 'DM Mono',monospace;letter-spacing:.09em;text-transform:uppercase;color:#f5dfb6; }
        .orbit-venue-heading h2 { font:500 37px/.94 'Newsreader',serif;letter-spacing:-.035em;margin:8px 0 10px;max-width:340px; }
        .orbit-venue-meta { display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#fff8ea; }
        .orbit-rating { display:flex;align-items:center;gap:5px;color:#ffdc84;font-weight:800; }
        .orbit-venue-pulse { margin:12px 19px 0;display:flex;align-items:center;justify-content:space-between;color:#505b60; }
        .orbit-pulse-copy { display:flex;align-items:center;gap:9px;font-size:11px; }.orbit-pulse-disc { width:37px;height:37px;border-radius:50%;border:1px solid #b9c0f2;background:#e5e8ff;color:var(--blue);display:grid;place-items:center;box-shadow:0 0 0 5px #eef0ff; }
        .orbit-pulse-copy strong { display:block;color:#2b3543;font-size:13px; }.orbit-pulse-copy small { display:block;margin-top:2px;color:#81847d;font-size:10px; }
        .orbit-venue-tabs { display:flex;gap:22px;margin:16px 18px 0;border-bottom:1px solid #dfdcd2; }
        .orbit-venue-tab { position:relative;padding:0 1px 11px;border:0;background:none;color:#7e837e;font-size:12px;font-weight:700;cursor:pointer; }
        .orbit-venue-tab.active { color:var(--blue); }.orbit-venue-tab.active:after { content:"";position:absolute;bottom:-1px;left:0;right:0;height:3px;border-radius:4px;background:var(--blue); }
        .orbit-venue-content { padding:14px 19px 30px;animation:orbit-in .22s ease-out; }
        .orbit-reward { padding:16px;border-radius:19px;background:#fff1cc;border:1px solid #efd88f;position:relative;overflow:hidden; }
        .orbit-reward:after { content:"";position:absolute;width:95px;height:95px;border:1px solid #d9b84d66;border-radius:50%;right:-16px;top:-24px;box-shadow:0 0 0 12px #d9b84d15,0 0 0 26px #d9b84d0b; }
        .orbit-kicker { font:500 9px 'DM Mono',monospace;letter-spacing:.11em;color:#8b6e24;text-transform:uppercase;display:flex;align-items:center;gap:6px; }
        .orbit-reward h3 { margin:8px 0 0;font:500 24px/.98 'Newsreader',serif;max-width:245px; }.orbit-reward p { margin:7px 0 0;font-size:11px;line-height:1.45;color:#706342;max-width:260px; }
        .orbit-announcement { margin-top:13px;padding:14px 15px;background:#e9edff;border-radius:18px;display:flex;gap:11px;align-items:flex-start; }
        .orbit-announcement-mark { width:31px;height:31px;border-radius:50%;background:#fff;display:grid;place-items:center;color:var(--blue);flex:none; }
        .orbit-announcement strong { display:block;font-size:12px; }.orbit-announcement p { margin:4px 0 0;font:italic 17px/1.25 'Newsreader',serif;color:#4e5670; }
        .orbit-event { margin-top:12px;border:1px solid #e2ded2;border-radius:18px;padding:14px;display:flex;align-items:center;gap:12px;background:#fffdf8; }
        .orbit-date { width:47px;height:53px;border-radius:13px;background:#f7e3d6;color:#b95739;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none; }
        .orbit-date b { font:500 9px 'DM Mono',monospace;letter-spacing:.09em; }.orbit-date strong { font:500 21px 'Newsreader',serif;line-height:1.1; }
        .orbit-event-copy { flex:1; }.orbit-event-copy strong { display:block;font-size:12px; }.orbit-event-copy small { display:block;color:#777e79;font-size:10px;margin-top:3px; }
        .orbit-event button { border:0;background:none;color:var(--blue);padding:6px;cursor:pointer; }
        .orbit-event-detail { margin-top:8px;padding:13px 14px;border-radius:16px;background:#f7f3e9;color:#68716d;font-size:11px;line-height:1.5;animation:orbit-in .2s ease-out; }
        .orbit-rsvp { width:100%;margin-top:12px;height:46px;border:0;border-radius:14px;background:var(--blue);color:white;display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;font-weight:800;cursor:pointer; }
        .orbit-leader { margin-top:14px; }.orbit-section-line { display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px; }.orbit-section-line strong { font:500 20px 'Newsreader',serif; }.orbit-section-line span { font:500 8px 'DM Mono',monospace;color:#84867f;letter-spacing:.07em; }
        .orbit-rank { display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #e8e4da;font-size:12px; }.orbit-rank > span:first-child { color:#8c8c82;font:500 10px 'DM Mono',monospace;width:20px; }
        .orbit-avatar { width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#e6e9f7;color:#3549a9;font-size:9px;font-weight:800; }
        .orbit-rank b { flex:1; }.orbit-rank small { color:#7e847d;font-size:10px; }
        .orbit-guest { padding:15px 16px;border-radius:18px;background:#f5eee0;border:1px solid #e6dcc8; }
        .orbit-guest blockquote { margin:0;font:500 21px/1.18 'Newsreader',serif;color:#4f514c; }.orbit-guest cite { display:block;margin-top:11px;color:#85867e;font:500 9px 'DM Mono',monospace;letter-spacing:.03em;font-style:normal; }
        .orbit-hours { margin-top:13px;padding:12px 2px 0;border-top:1px solid #e4e0d6;display:flex;justify-content:space-between;color:#69716d;font-size:11px; }.orbit-hours strong { color:#333e43; }
        .orbit-bottom { flex:none;padding:10px 16px 12px;border-top:1px solid #e6e1d6;background:#fffdf7;display:flex;gap:9px;align-items:center; }
        .orbit-checkin { height:48px;border:0;border-radius:15px;background:var(--blue);color:white;display:flex;align-items:center;justify-content:center;gap:8px;flex:1;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 10px #4059ce30;transition:transform .18s,background .2s; }
        .orbit-checkin:active { transform:scale(.98); }.orbit-checkin.done { background:#627f65; }
        .orbit-directions { width:48px;height:48px;border:1px solid #d9d8d0;background:#fff;border-radius:15px;color:#4352a0;display:grid;place-items:center;cursor:pointer; }
        .orbit-directions-panel { position:absolute;z-index:7;left:16px;right:16px;bottom:77px;padding:15px 16px;border-radius:18px;background:#293dba;color:white;box-shadow:0 9px 24px #24306b42;animation:orbit-in .2s ease-out; }
        .orbit-directions-panel strong { font:500 19px 'Newsreader',serif; }.orbit-directions-panel p { margin:5px 0 0;color:#e0e4ff;font-size:11px;line-height:1.4; }
        @keyframes orbit-float { 0%,100% { transform:translateX(-50%) translateY(0) rotate(-3deg); } 50% { transform:translateX(-50%) translateY(-5px) rotate(2deg); } }
        @keyframes orbit-in { from { opacity:0;transform:translateY(7px); } to { opacity:1;transform:translateY(0); } }
        .orbit-home-indicator { position:absolute;z-index:8;bottom:5px;left:50%;transform:translateX(-50%);width:104px;height:4px;border-radius:8px;background:#272a31;opacity:.6;pointer-events:none; }
        @media (max-width:760px) {
          .orbit-board { width:100%;height:auto;min-height:100dvh;padding:20px 12px 30px;overflow:visible; }
          .orbit-head { margin:0 7px 18px;align-items:flex-start;flex-direction:column;gap:9px; }.orbit-head h1 { font-size:28px; }.orbit-head-note { text-align:left;max-width:320px; }
          .orbit-screens { flex-direction:column;align-items:center;gap:24px; }.orbit-device { width:min(430px,100%);flex-basis:auto; }
          .orbit-phone { height:min(900px,calc(100dvh - 75px));min-height:730px; }.orbit-venue-hero { min-height:360px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .orbit-board *, .orbit-board *:before, .orbit-board *:after { animation-duration:.01ms !important;animation-iteration-count:1 !important;scroll-behavior:auto !important;transition-duration:.01ms !important; }
        }
      `}</style>

      <header className="orbit-head">
        <div>
          <div className="orbit-markline"><i className="orbit-mark" /> MET / ORBIT STUDY</div>
          <h1>A little city, held close.</h1>
        </div>
        <div className="orbit-head-note">Discovery by shared places, never by watching people.</div>
      </header>

      <div className="orbit-screens">
        <PhoneFrame title="01 / Nearby orbit">
          <div className="orbit-scroll">
            <div className="orbit-home-top">
              <div className="orbit-brand"><i className="orbit-brand-mark"><i /></i> met</div>
              <span className="orbit-sample">sample</span>
            </div>
            <div className="orbit-home-title">
              <div className="orbit-location"><MapPin size={13} /> RIVER DISTRICT <span>·</span> TODAY</div>
              <h2>The neighborhood<br />is in motion.</h2>
              <p>Eight opted-in guests, gathered into one gentle signal.</p>
            </div>
            {homeTab === "nearby" ? (
              <>
                <div className="orbit-orb-stage" aria-label="Eight nearby guests represented as an aggregate orbit">
                  <div className="orbit-ring" />
                  <div className="orbit-disc">
                    <div className="orbit-disc-core">
                      <span className="orbit-count">{visible ? "08" : "—"}</span>
                      <span className="orbit-count-label">nearby guests</span>
                      <span className="orbit-inner-note">{visible ? "within this district" : "visibility paused"}</span>
                    </div>
                  </div>
                  {visible && <>
                    <div className="orbit-node n1"><i />Mira House <small>86</small></div>
                    <div className="orbit-node n2"><i />Juniper Market <small>64</small></div>
                    <div className="orbit-node n3"><i />Cypress Books <small>42</small></div>
                  </>}
                  <div className="orbit-orbit-caption">Pooled venue activity · no live positions</div>
                </div>
                <button className="orbit-beacon" onClick={() => setVisible(!visible)} aria-pressed={visible}>
                  <span className="orbit-beacon-icon"><Radio size={18} /></span>
                  <span className="orbit-beacon-copy"><strong>{visible ? "Your beacon is on" : "You’re off the neighborhood map"}</strong><small>{visible ? "Only opted-in guests can discover you" : "Turn it on only when you feel like it"}</small></span>
                  <span className={`orbit-switch ${visible ? "on" : ""}`}><i /></span>
                </button>
                <button className="orbit-request" onClick={() => setRequestOpen(!requestOpen)} aria-expanded={requestOpen}>
                  <span className="orbit-request-mark"><Users size={17} /></span>
                  <span><strong>One connection request</strong><small>Always yours to review first</small></span>
                  {requestOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                </button>
                {requestOpen && <div className="orbit-request-detail">
                  <strong>A note from someone you met</strong>
                  <p>One sample request is waiting. Review privately; no profile or location is exposed here.</p>
                  <button onClick={() => setRequestOpen(false)}>Review request · sample</button>
                </div>}
                <div className="orbit-feature" onClick={() => setHomeTab("places")} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setHomeTab("places"); }}>
                  <img src="/__mockup/images/coffee-shop.png" alt="Mira House Coffee interior" />
                  <span className="orbit-feature-copy"><small>In your orbit · 1.2 km</small><strong>Mira House Coffee</strong><span>86 visits this week · sample</span></span>
                  <ArrowDownRight size={20} />
                </div>
              </>
            ) : homeTab === "week" ? (
              <div className="orbit-tab-content">
                <h3>Your week, in passing.</h3>
                <p>Small familiar moments add up. These are sample totals from places around River District.</p>
                <div className="orbit-activity-line"><span>New connections</span><b>3</b></div>
                <div className="orbit-activity-line"><span>Familiar faces again</span><b>2</b></div>
                <div className="orbit-activity-line"><span>Places crossed paths</span><b>4</b></div>
                <p><ShieldCheck size={14} style={{ verticalAlign: "middle", marginRight: 5 }} /> No individual movement history is shown.</p>
              </div>
            ) : (
              <div className="orbit-tab-content">
                <h3>Places with a pulse.</h3>
                <p>Activity is grouped around public venues, not plotted guest by guest.</p>
                {["Mira House Coffee · 86 this week", "Juniper Market · 64 this week", "Cypress Books · 42 this week"].map((place) => <div className="orbit-activity-line" key={place}><span>{place.split(" · ")[0]}</span><b>{place.split(" · ")[1]}</b></div>)}
                <p>Weekly counts are illustrative sample activity.</p>
              </div>
            )}
            <div className="orbit-week">
              <div className="orbit-week-top"><strong>A week of familiar places</strong><span>YOUR SAMPLE</span></div>
              <div className="orbit-week-counts"><div><b>3</b><span>new</span></div><div><b>2</b><span>repeat</span></div></div>
              <p className="orbit-week-note">New faces, and two familiar ones around again.</p>
            </div>
            <div className="orbit-request-note">“The community table is open all weekend.”</div>
          </div>
          <nav className="orbit-tabbar" aria-label="Home sections">
            <button className={`orbit-tab ${homeTab === "nearby" ? "active" : ""}`} onClick={() => setHomeTab("nearby")}><Compass /><span>Nearby</span></button>
            <button className={`orbit-tab ${homeTab === "week" ? "active" : ""}`} onClick={() => setHomeTab("week")}><Radio /><span>Your week</span></button>
            <button className={`orbit-tab ${homeTab === "places" ? "active" : ""}`} onClick={() => setHomeTab("places")}><MapPin /><span>Places</span></button>
          </nav>
        </PhoneFrame>

        <PhoneFrame title="02 / Mira House Coffee">
          <div className="orbit-scroll">
            <div className="orbit-venue-nav">
              <button className="orbit-icon-button" aria-label="Back to nearby" onClick={() => setVenueTab("story")}><ArrowLeft size={17} /></button>
              <span>RIVER DISTRICT · SAMPLE</span>
              <button className="orbit-icon-button" aria-label={saved ? "Remove saved place" : "Save place"} onClick={() => setSaved(!saved)}><Bookmark size={16} fill={saved ? "#4059ce" : "none"} color={saved ? "#4059ce" : "currentColor"} /></button>
            </div>
            <div className="orbit-venue-hero">
              <img src="/__mockup/images/coffee-shop.png" alt="Warm neighborhood coffee shop interior" />
              <div className="orbit-venue-orbit" />
              <span className="orbit-venue-dot" />
              <span className="orbit-venue-sample">A PLACE IN YOUR ORBIT</span>
              <button className="orbit-venue-save" aria-label="Share sample venue" onClick={() => setDirectionsOpen(!directionsOpen)}><ArrowUpRight size={17} /></button>
              <div className="orbit-venue-heading">
                <small>Coffee &amp; pastry · neighborhood café</small>
                <h2>Mira House<br />Coffee</h2>
                <div className="orbit-venue-meta"><span>River District</span><span className="orbit-rating"><Star size={14} fill="currentColor" /> 4.9 <span style={{ color: "#f9ead4", fontWeight: 500 }}>(128)</span></span></div>
              </div>
            </div>
            <div className="orbit-venue-pulse">
              <div className="orbit-pulse-copy"><span className="orbit-pulse-disc"><Users size={17} /></span><span><strong>86 visits this week</strong><small>A shared-place count, not a live crowd</small></span></div>
              <span className="orbit-sample">SAMPLE</span>
            </div>
            <div className="orbit-venue-tabs" role="tablist">
              <button className={`orbit-venue-tab ${venueTab === "story" ? "active" : ""}`} onClick={() => setVenueTab("story")} role="tab">The place</button>
              <button className={`orbit-venue-tab ${venueTab === "gather" ? "active" : ""}`} onClick={() => setVenueTab("gather")} role="tab">Gather</button>
              <button className={`orbit-venue-tab ${venueTab === "guestbook" ? "active" : ""}`} onClick={() => setVenueTab("guestbook")} role="tab">Guestbook</button>
            </div>
            <div className="orbit-venue-content">
              {venueTab === "story" && <>
                <div className="orbit-reward">
                  <div className="orbit-kicker"><Award size={14} /> A little thank-you · sample</div>
                  <h3>Coffee &amp; pastry for two</h3>
                  <p>Mira House regular reward. A warm reason to make this your usual.</p>
                </div>
                <div className="orbit-announcement">
                  <span className="orbit-announcement-mark"><Compass size={15} /></span>
                  <div><strong>A note from the team</strong><p>“The community table is open all weekend.”</p></div>
                </div>
                <div className="orbit-event">
                  <span className="orbit-date"><b>SAT</b><strong>10</strong></span>
                  <span className="orbit-event-copy"><strong>Vinyl &amp; Slow Pour</strong><small>Saturday · 10 am · sample event</small></span>
                  <button aria-label="Expand event details" onClick={() => setEventOpen(!eventOpen)}><ChevronDown size={17} /></button>
                </div>
                {eventOpen && <div className="orbit-event-detail">Bring a record, meet a neighbor, and stay for a slow pour. This is an illustrative event listing.</div>}
                <div className="orbit-event">
                  <span className="orbit-date" style={{ background: "#e4ebdf", color: "#526e50" }}><b>NEXT</b><strong>18</strong></span>
                  <span className="orbit-event-copy"><strong>Local makers morning</strong><small>Next week · neighborhood artists</small></span>
                  <button aria-label="Expand local makers event" onClick={() => setEventOpen(!eventOpen)}><ChevronRight size={17} /></button>
                </div>
                <div className="orbit-leader">
                  <div className="orbit-section-line"><strong>Familiar around here</strong><span>REGULARS · SAMPLE</span></div>
                  {[["01", "Taylor M.", "12 visits", "TM"], ["02", "Jordan E.", "9 visits", "JE"], ["03", "Alex H.", "7 visits", "AH"]].map(([rank, name, visits, initials]) => <div className="orbit-rank" key={rank}><span>{rank}</span><i className="orbit-avatar">{initials}</i><b>{name}</b><small>{visits}</small></div>)}
                </div>
              </>}
              {venueTab === "gather" && <>
                <div className="orbit-section-line"><strong>Good things coming up</strong><span>LOCAL GATHERINGS</span></div>
                <p style={{ color: "#727973", fontSize: 12, lineHeight: 1.5, margin: "4px 0 13px" }}>A little occasion to cross paths, if it suits you.</p>
                <div className="orbit-event" style={{ marginTop: 0 }}>
                  <span className="orbit-date"><b>SAT</b><strong>10</strong></span>
                  <span className="orbit-event-copy"><strong>Vinyl &amp; Slow Pour</strong><small>Saturday · 10 am · sample event</small></span>
                  <button aria-label="Expand event details" onClick={() => setEventOpen(!eventOpen)}><ChevronDown size={17} /></button>
                </div>
                {eventOpen && <div className="orbit-event-detail">Bring a record, meet a neighbor, and stay for a slow pour. This is an illustrative event listing.</div>}
                <button className="orbit-rsvp" onClick={() => setRsvp(!rsvp)}>{rsvp ? <><Check size={16} /> You’re on the sample list</> : <><CalendarDays size={16} /> I might come</>}</button>
                <div className="orbit-event" style={{ marginTop: 12 }}>
                  <span className="orbit-date" style={{ background: "#e4ebdf", color: "#526e50" }}><b>NEXT</b><strong>18</strong></span>
                  <span className="orbit-event-copy"><strong>Local makers morning</strong><small>Neighborhood artists &amp; makers</small></span>
                  <ArrowDownRight size={17} color="#4059ce" />
                </div>
              </>}
              {venueTab === "guestbook" && <>
                <div className="orbit-section-line"><strong>Guestbook</strong><span>4.9 · 128 NOTES</span></div>
                <div className="orbit-guest"><blockquote>“A lovely place to slow down and meet the neighborhood.”</blockquote><cite>TAYLOR M. · TWO DAYS AGO · SAMPLE</cite></div>
                <div className="orbit-guest" style={{ marginTop: 10, background: "#eef0ff", borderColor: "#d9def8" }}><blockquote>“The window seats and the people-watching are a small ritual now.”</blockquote><cite>JORDAN E. · LAST WEEK · SAMPLE</cite></div>
                <div className="orbit-hours"><span><Clock3 size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />Today</span><strong>Open · until 6 pm</strong></div>
                <p style={{ color: "#737a75", fontSize: 11, lineHeight: 1.5 }}>River District · Coffee, pastry &amp; a shared table.</p>
              </>}
            </div>
          </div>
          <div className="orbit-bottom">
            <button className={`orbit-checkin ${checkedIn ? "done" : ""}`} onClick={() => setCheckedIn(!checkedIn)}>
              {checkedIn ? <Check size={17} /> : <MapPin size={17} />}{checkedIn ? "Sample check-in ready" : "Check in here"}
            </button>
            <button className="orbit-directions" aria-label="Show directions preview" onClick={() => setDirectionsOpen(!directionsOpen)}><Navigation size={18} /></button>
          </div>
          {directionsOpen && <div className="orbit-directions-panel"><strong>On the River District loop</strong><p>About 1.2 km away · directions are a local preview, no location is requested.</p></div>}
        </PhoneFrame>
      </div>
    </main>
  );
}
