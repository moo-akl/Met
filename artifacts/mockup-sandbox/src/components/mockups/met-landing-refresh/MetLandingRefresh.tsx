import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Compass,
  Gift,
  HeartHandshake,
  MapPin,
  Megaphone,
  Menu,
  Navigation,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import "./_group.css";
import { DownloadButtons, Mark } from "./components/MetLandingParts";

const screens = {
  home: "/__mockup/images/met-home-2026.png",
  checkin: "/__mockup/images/met-checkin-2026.png",
  community: "/__mockup/images/met-community-2026.png",
  venue: "/__mockup/images/met-venue-2026.png",
  encounters: "/__mockup/images/met-encounters-2026.png",
  reveal: "/__mockup/images/met-reveal-2026.png",
  profile: "/__mockup/images/met-profile-2026.png",
};

const sampleNote = "Illustrative product screen · fictional sample data";

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className={`mb-5 flex items-center gap-2 font-['Space_Mono'] text-[10px] font-bold uppercase tracking-[.17em] ${light ? "text-[#d8ff68]" : "text-[#607b68]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${light ? "bg-[#d8ff68]" : "bg-[#eb735c]"}`} />
      {children}
    </div>
  );
}

function ProductScreen({
  src,
  alt,
  className = "",
  caption = sampleNote,
  contain = false,
}: {
  src: string;
  alt: string;
  className?: string;
  caption?: string;
  contain?: boolean;
}) {
  return (
    <figure className={`overflow-hidden rounded-[25px] border border-[#d9dfcf] bg-[#fdfbf5] p-2 shadow-[0_24px_65px_rgba(23,59,49,.13)] ${className}`}>
      <div className="overflow-hidden rounded-[18px] bg-[#ecefe6]">
        <img src={src} alt={alt} className={`block w-full ${contain ? "object-contain" : "object-cover"}`} />
      </div>
      <figcaption className="px-2 pb-1 pt-3 font-['Space_Mono'] text-[8px] uppercase tracking-[.1em] text-[#708270]">{caption}</figcaption>
    </figure>
  );
}

function ArrowLink({ href, children, light = false }: { href: string; children: React.ReactNode; light?: boolean }) {
  return (
    <a href={href} className={`group inline-flex min-h-12 items-center justify-center gap-3 rounded-full px-5 py-3 font-['DM_Sans'] text-sm font-extrabold transition-transform hover:-translate-y-0.5 ${light ? "bg-[#f8f4e9] text-[#173b31]" : "bg-[#d8ff68] text-[#173b31]"}`}>
      {children}
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#173b31] text-[#d8ff68] transition-transform group-hover:rotate-45"><ArrowUpRight size={15} /></span>
    </a>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const items: { question: string; answer: React.ReactNode }[] = [
    { question: "What is Met?", answer: "Met helps people discover nearby venues on a social map, check in, and remember people and places they encountered." },
    { question: "How does social reveal work?", answer: "A reveal request is mutual: social details are shared only when both people accept." },
    { question: "What can a venue do on Met?", answer: "Venues can share events and announcements, and approved partners can update their details, photos, hours, and contact information." },
    { question: "Is it free to apply?", answer: "Yes. Venue applications are free and are reviewed before approval." },
    {
      question: "How do I register my venue?",
      answer: <>Apply using Met’s <a href="/apply" className="font-bold text-[#315844] underline decoration-[#ef725a] underline-offset-2 hover:text-[#173b31]">venue application form</a>. Applications are free and reviewed before approval.</>,
    },
    {
      question: "How is my privacy protected?",
      answer: "Data sent between your device and Met is encrypted in transit. Nearby visibility is optional and uses Bluetooth to detect nearby Met users; GPS may also be used for nearby features. Met does not keep a continuous GPS history.",
    },
  ];
  return (
    <div className="divide-y divide-[#d7dfd0] border-y border-[#d7dfd0]">
      {items.map(({ question, answer }, i) => (
        <div key={question}>
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-5 py-5 text-left">
            <span className="font-['DM_Sans'] text-base font-bold text-[#173b31]">{question}</span>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#abc1a6] text-[#315844] transition-transform ${open === i ? "rotate-180 bg-[#d8ff68]" : ""}`}><ChevronDown size={16} /></span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="max-w-[640px] overflow-hidden pb-5 font-['DM_Sans'] text-sm leading-relaxed text-[#607968]">{answer}</motion.p>}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

export function MetLandingRefresh() {
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = [
    ["For people", "#people"],
    ["For venues", "#venues"],
    ["How it works", "#how"],
  ];

  return (
    <div className="met-root min-h-[100dvh] overflow-hidden bg-[#f8f4e9] text-[#173b31] selection:bg-[#d8ff68] selection:text-[#173b31]">
      <style>{`
        @keyframes met-drift { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-9px) rotate(-2deg); } }
        @keyframes met-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .met-drift { animation: met-drift 6s ease-in-out infinite; }
        .met-marquee { animation: met-marquee 32s linear infinite; }
        .met-reveal { animation: met-in .7s both; }
        .met-root { display: block; width: 100%; max-width: 100vw; min-width: 0; overflow-x: clip; }
        .met-hero-section { width: 100%; max-width: 100vw; min-width: 0; }
        .met-hero-layout { display: block; box-sizing: border-box; width: min(100%, 1240px); max-width: 100%; min-width: 0; margin-inline: auto; padding: 16px 20px 40px; }
        .met-hero-copy { position: relative; z-index: 10; min-width: 0; }
        .met-hero-title { max-width: 600px; font-size: clamp(2.9rem, 6.3vw, 6.25rem); line-height: .86; }
        .met-hero-art { position: relative; width: 100%; max-width: 580px; min-width: 0; margin: 28px auto 0; padding: 4px 0 20px; }
        .met-hero-device { position: relative; width: 46%; max-width: 270px; margin-inline: auto; overflow: hidden; }
        @media (min-width: 640px) { .met-hero-layout { padding: 16px 24px 56px; } .met-hero-art { margin-top: 36px; } }
        @media (min-width: 1024px) {
          .met-hero-layout { display: grid; grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr); align-items: start; gap: 40px; padding: 20px 32px 64px; }
          .met-hero-copy { padding-top: 28px; }
          .met-hero-title { font-size: clamp(3.4rem, 6vw, 5.8rem); }
          .met-hero-art { max-width: none; margin: 0; padding: 0; justify-self: end; }
          .met-hero-device { width: 48%; max-width: 280px; }
        }
        @keyframes met-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .met-drift,.met-marquee,.met-reveal { animation: none; } }
      `}</style>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#dce3d5]/80 bg-[#f8f4e9]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <a href="#top" aria-label="Met home"><Mark /></a>
          <nav className="hidden items-center gap-8 md:flex">
            {nav.map(([label, href]) => <a key={href} href={href} className="font-['DM_Sans'] text-sm font-bold text-[#557064] transition-colors hover:text-[#173b31]">{label}</a>)}
          </nav>
          <div className="flex items-center gap-3">
            <a href="/apply" className="hidden rounded-full border border-[#aabca9] px-4 py-2.5 font-['DM_Sans'] text-xs font-extrabold hover:bg-white sm:inline-flex">Apply your venue</a>
            <a href="#download" className="rounded-full bg-[#173b31] px-4 py-2.5 font-['DM_Sans'] text-xs font-extrabold text-[#d8ff68] transition-transform hover:-translate-y-0.5">Get the app</a>
            <button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="grid h-10 w-10 place-items-center rounded-full border border-[#aabca9] md:hidden">
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen && <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-[#dce3d5] bg-[#f8f4e9] md:hidden">
            <div className="flex flex-col gap-1 px-5 py-4">{nav.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 font-['DM_Sans'] text-sm font-bold text-[#557064] hover:bg-white">{label}</a>)}</div>
          </motion.nav>}
        </AnimatePresence>
      </header>

      <main id="top">
        <section className="met-hero-section relative overflow-hidden bg-[#173b31] pt-[88px] text-[#f8f4e9] sm:pt-[100px] lg:pt-[112px]">
          <div className="pointer-events-none absolute -right-40 -top-52 h-[620px] w-[620px] rounded-full border border-[#d8ff68]/20" />
          <div className="pointer-events-none absolute right-[-20px] top-[-65px] h-[380px] w-[380px] rounded-full border border-[#d8ff68]/15" />
          <div className="pointer-events-none absolute -bottom-40 left-[30%] h-[420px] w-[420px] rounded-full bg-[#d8ff68]/[.07] blur-3xl" />
          <div className="met-hero-layout relative">
            <div className="met-hero-copy">
              <Eyebrow light>Find your place in the city</Eyebrow>
              <h1 className="met-hero-title font-['DM_Sans'] font-black tracking-[-.09em]">The city is better <span className="font-['Instrument_Serif'] font-normal italic text-[#d8ff68]">when it’s shared.</span></h1>
              <p className="mt-5 max-w-[490px] font-['DM_Sans'] text-base leading-relaxed text-[#c4d5bd] sm:mt-6 sm:text-lg">Discover nearby venues, check in, and remember the people and places that make a day feel like yours.</p>
              <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
                <ArrowLink href="#download">Explore Met</ArrowLink>
                <ArrowLink href="/apply" light>For venue partners</ArrowLink>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-['Space_Mono'] text-[9px] uppercase tracking-[.12em] text-[#9db79a] sm:mt-8">
                <span className="flex items-center gap-2"><Check size={13} className="text-[#d8ff68]" /> Mutual-consent reveal</span>
                <span className="flex items-center gap-2"><Check size={13} className="text-[#d8ff68]" /> Free venue application</span>
              </div>
            </div>
            <div className="met-hero-art">
              <div className="absolute inset-6 rounded-[42%] bg-[#d8ff68]/10 blur-3xl" />
              <div className="met-hero-device rotate-[2deg] rounded-[24px] border-[5px] border-[#f8f4e9] bg-[#f8f4e9] shadow-[0_32px_90px_rgba(0,0,0,.35)] sm:rounded-[30px] sm:border-[7px]">
                <img src={screens.home} alt="Illustrative Met social map with nearby venues" className="block w-full" />
                <div className="bg-[#f8f4e9] px-3 pb-2 pt-1 font-['Space_Mono'] text-[8px] uppercase tracking-[.1em] text-[#607b68]">Social map · illustrative sample</div>
              </div>
              <div className="met-drift absolute bottom-10 left-0 z-10 w-[43%] rounded-[18px] border border-[#cbe891] bg-[#d8ff68] p-3 text-[#173b31] shadow-[0_18px_40px_rgba(0,0,0,.24)] sm:bottom-20 sm:left-1 sm:w-[45%] sm:rounded-[22px] sm:p-4">
                <div className="mb-3 flex items-center justify-between sm:mb-5"><span className="font-['Space_Mono'] text-[7px] font-bold uppercase tracking-[.1em] sm:text-[8px] sm:tracking-[.14em]">Nearby, on Met</span><Navigation size={15} /></div>
                <p className="font-['DM_Sans'] text-[clamp(1.2rem,3vw,1.8rem)] font-black leading-[.95] tracking-[-.06em]">Places worth finding.</p>
                <p className="mt-2 font-['DM_Sans'] text-[9px] leading-relaxed text-[#416040] sm:text-xs">A social map made for the moments around you.</p>
              </div>
              <div className="absolute right-0 top-4 z-10 max-w-[42%] rounded-2xl border border-white/20 bg-[#f8f4e9] px-2 py-2 text-[#173b31] shadow-xl sm:right-2 sm:top-12 sm:max-w-[46%] sm:px-4 sm:py-3">
                <div className="flex items-center gap-2"><Compass size={16} className="text-[#ef725a]" /><span className="font-['DM_Sans'] text-[9px] font-extrabold sm:text-xs">Find nearby venues</span></div>
              </div>
              <p className="mt-3 text-center font-['Space_Mono'] text-[8px] uppercase tracking-[.1em] text-[#91ad8d]">{sampleNote}</p>
            </div>
          </div>
          <div className="overflow-hidden border-t border-[#52715a]/45 bg-[#214b3d] py-3.5">
            <div className="met-marquee flex w-max items-center gap-8 whitespace-nowrap font-['Space_Mono'] text-[9px] uppercase tracking-[.15em] text-[#b5ccaa]">
              {Array.from({ length: 2 }).flatMap((_, group) => ["Nearby discovery", "Guest check-ins", "Shared places", "Community rewards", "Events & updates", "Mutual-consent connections"].map((text, i) => <span key={`${group}-${i}`} className="flex items-center gap-8">{text}<span className="text-[#d8ff68]">·</span></span>))}
            </div>
          </div>
        </section>

        <section id="people" className="relative py-20 lg:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 lg:grid-cols-[.82fr_1.18fr] lg:items-center lg:px-8">
            <div className="max-w-[490px]">
              <Eyebrow>A little more connected</Eyebrow>
              <h2 className="font-['DM_Sans'] text-[clamp(2.8rem,6vw,5.4rem)] font-black leading-[.9] tracking-[-.085em]">Your city, with <span className="font-['Instrument_Serif'] font-normal italic text-[#ef725a]">context.</span></h2>
              <p className="mt-6 font-['DM_Sans'] text-base leading-relaxed text-[#5a7567]">Met brings venues and people together through places they share. Explore the map, check in as a guest, then revisit the people and places you crossed paths with.</p>
              <div className="mt-8 space-y-4">
                {[
                  [MapPin, "Discover nearby", "Explore venues on Met’s social map."],
                  [Navigation, "Check in", "Mark a venue as the place you’re spending time."],
                  [UsersRound, "Remember encounters", "Keep track of people and places you encountered."],
                ].map(([Icon, title, detail], i) => {
                  const FeatureIcon = Icon as typeof MapPin;
                  return <div key={title as string} className="flex items-start gap-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${i === 1 ? "bg-[#ef725a] text-[#173b31]" : "bg-[#e5f1d6] text-[#315844]"}`}><FeatureIcon size={17} /></span>
                    <div><h3 className="font-['DM_Sans'] text-sm font-extrabold">{title as string}</h3><p className="mt-0.5 font-['DM_Sans'] text-xs leading-relaxed text-[#607968]">{detail as string}</p></div>
                  </div>;
                })}
              </div>
            </div>
            <div className="relative grid grid-cols-[1fr_.82fr] items-center gap-3 sm:gap-5">
              <ProductScreen src={screens.home} alt="Illustrative sample of Met's social map and featured venues" className="relative z-10 rotate-[-2deg]" />
              <div className="space-y-4 pt-12 sm:pt-16">
                <ProductScreen src={screens.encounters} alt="Illustrative sample of people whose paths crossed" />
                <div className="rounded-[20px] bg-[#e5f1d6] p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between"><HeartHandshake size={18} className="text-[#ef725a]" /><span className="font-['Space_Mono'] text-[8px] uppercase tracking-[.14em] text-[#66806c]">Connection, by choice</span></div>
                  <p className="font-['DM_Sans'] text-sm font-extrabold leading-snug">A shared moment can start a conversation.</p>
                  <p className="mt-2 font-['DM_Sans'] text-xs leading-relaxed text-[#607968]">Social reveal is mutual: both people need to accept.</p>
                </div>
              </div>
              <div className="absolute -right-2 top-3 z-20 rounded-full bg-[#ef725a] px-4 py-2 font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.12em] text-[#173b31] sm:right-0">Real places, real context</div>
            </div>
          </div>
        </section>

        <section className="bg-[#e6f1d7] py-16 lg:py-24">
          <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
            <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="max-w-[650px]"><Eyebrow>From first visit to familiar place</Eyebrow><h2 className="font-['DM_Sans'] text-[clamp(2.7rem,6vw,5rem)] font-black leading-[.9] tracking-[-.085em]">A check-in is a <span className="font-['Instrument_Serif'] font-normal italic text-[#ef725a]">starting point.</span></h2></div>
              <p className="max-w-[360px] font-['DM_Sans'] text-sm leading-relaxed text-[#5a7567]">At a venue, guests check in and find a community layer: updates, shared rewards, and the people and places they remember.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-[.95fr_1.05fr] lg:items-center">
              <ProductScreen src={screens.checkin} alt="Illustrative product screen showing venue QR check-in and community rewards" className="mx-auto w-full max-w-[430px] rotate-[-1deg]" />
              <div className="space-y-3">
                {[
                  [1, "Arrive at a place", "Check in at a venue through its Met experience.", MapPin],
                  [2, "Find the community", "Explore a venue’s visitor community and leaderboard.", UsersRound],
                  [3, "Come back for more", "See the rewards and updates shared by the venue.", Gift],
                ].map(([step, title, text, Icon], index) => {
                  const StepIcon = Icon as typeof Gift;
                  return <div key={index} className="flex gap-4 rounded-[21px] border border-[#cadbbd] bg-[#f8f4e9]/75 p-4 sm:p-5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#173b31] font-['Space_Mono'] text-[10px] font-bold text-[#d8ff68]">{String(step).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1"><div className="mb-1 flex items-center gap-2"><StepIcon size={15} className="text-[#ef725a]" /><h3 className="font-['DM_Sans'] text-sm font-extrabold">{title as string}</h3></div><p className="font-['DM_Sans'] text-xs leading-relaxed text-[#607968]">{text as string}</p></div>
                    <ArrowDownRight size={17} className="mt-1 shrink-0 text-[#6b8871]" />
                  </div>;
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden bg-[#f2eadb] py-20 lg:py-28">
          <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
              <div><Eyebrow>Made for local places</Eyebrow><h2 className="font-['DM_Sans'] text-[clamp(2.8rem,6vw,5rem)] font-black leading-[.9] tracking-[-.085em]">A venue becomes a <span className="font-['Instrument_Serif'] font-normal italic text-[#ef725a]">hub.</span></h2></div>
              <p className="max-w-[560px] font-['DM_Sans'] text-base leading-relaxed text-[#5a7567]">Met gives local venues a place in nearby discovery and a way to keep their community in the loop. Approved partners can share what’s happening and keep their venue information current.</p>
            </div>
            <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-[24px] bg-[#d8ff68] p-5 sm:p-6"><CalendarDays className="mb-8 text-[#173b31]" size={22} /><p className="font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.15em] text-[#607b68]">Events</p><h3 className="mt-2 font-['DM_Sans'] text-xl font-black leading-tight tracking-[-.05em]">Bring the next gathering into view.</h3></div>
                <div className="mt-8 rounded-[24px] bg-[#f9d4c9] p-5 sm:p-6"><Megaphone className="mb-8 text-[#ef725a]" size={22} /><p className="font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.15em] text-[#607b68]">Announcements</p><h3 className="mt-2 font-['DM_Sans'] text-xl font-black leading-tight tracking-[-.05em]">Keep guests up to date.</h3></div>
                <div className="rounded-[24px] bg-[#e5f1d6] p-5 sm:p-6"><Gift className="mb-8 text-[#315844]" size={22} /><p className="font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.15em] text-[#607b68]">Rewards</p><h3 className="mt-2 font-['DM_Sans'] text-xl font-black leading-tight tracking-[-.05em]">Make return visits count.</h3></div>
                <div className="mt-8 rounded-[24px] bg-[#173b31] p-5 text-[#f8f4e9] sm:p-6"><UsersRound className="mb-8 text-[#d8ff68]" size={22} /><p className="font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.15em] text-[#a9c1a5]">Community</p><h3 className="mt-2 font-['DM_Sans'] text-xl font-black leading-tight tracking-[-.05em]">Give familiar faces a shared place.</h3></div>
              </div>
              <div className="relative">
                <ProductScreen src={screens.venue} alt="Illustrative sample of a Met venue profile and venue updates" className="relative z-10 mx-auto w-full max-w-[430px] rotate-[1deg]" />
                <ProductScreen src={screens.community} alt="Illustrative sample of a venue visitor community" className="absolute -bottom-5 -left-2 hidden w-[46%] rotate-[-4deg] sm:block" />
                <div className="absolute -right-3 top-8 rounded-2xl bg-[#ef725a] px-4 py-3 font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.12em] text-[#173b31] sm:right-0">A place to show what’s on</div>
              </div>
            </div>
            <p className="mt-8 text-center font-['Space_Mono'] text-[8px] uppercase tracking-[.1em] text-[#708270]">{sampleNote}</p>
          </div>
        </section>

        <section id="community-keepsakes" className="bg-[#e5f1d6] py-16 lg:py-24">
          <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
            <div className="mb-9 max-w-[700px]">
              <Eyebrow>Little things that stay with you</Eyebrow>
              <h2 className="font-['DM_Sans'] text-[clamp(2.7rem,6vw,4.8rem)] font-black leading-[.9] tracking-[-.085em]">A place can leave a <span className="font-['Instrument_Serif'] font-normal italic text-[#ef725a]">mark.</span></h2>
              <p className="mt-5 max-w-[550px] font-['DM_Sans'] text-base leading-relaxed text-[#5a7567]">From community milestones to a note in the Guest Book, Met gives shared places a way to be remembered.</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <article className="grid gap-5 overflow-hidden rounded-[28px] border border-[#cbdcbf] bg-[#f8f4e9] p-4 sm:grid-cols-[.8fr_1.2fr] sm:items-center sm:p-6">
                <div className="flex h-full min-h-[190px] items-center justify-center overflow-hidden rounded-[20px] bg-[#173b31] p-3">
                  <img src={screens.community} alt="Illustrative Met hub community leaderboard screen" className="max-h-[250px] w-auto max-w-full rounded-[14px] object-contain" />
                </div>
                <div>
                  <div className="mb-4 flex items-center justify-between"><Trophy size={21} className="text-[#ef725a]" /><span className="font-['Space_Mono'] text-[8px] uppercase tracking-[.13em] text-[#708270]">Hub monthly leaderboard</span></div>
                  <h3 className="font-['DM_Sans'] text-2xl font-black leading-tight tracking-[-.06em]">Earn a trophy by making the podium.</h3>
                  <p className="mt-3 font-['DM_Sans'] text-sm leading-relaxed text-[#607968]">Finish 1st, 2nd, or 3rd on a hub’s monthly leaderboard to earn a gold, silver, or bronze trophy.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#f2d888] px-3 py-1.5 font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.08em] text-[#59421e]">1st · Gold</span>
                    <span className="rounded-full bg-[#dce2df] px-3 py-1.5 font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.08em] text-[#485954]">2nd · Silver</span>
                    <span className="rounded-full bg-[#e6b08b] px-3 py-1.5 font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.08em] text-[#5b3e2b]">3rd · Bronze</span>
                  </div>
                  <p className="mt-4 border-t border-[#dce3d5] pt-3 font-['DM_Sans'] text-xs leading-relaxed text-[#607968]"><strong className="text-[#173b31]">Your trophy, your choice.</strong> Set its visibility to public or private.</p>
                </div>
              </article>
              <article className="grid gap-5 overflow-hidden rounded-[28px] border border-[#f1c1b2] bg-[#f9d4c9]/55 p-4 sm:grid-cols-[.8fr_1.2fr] sm:items-center sm:p-6">
                <div className="flex h-full min-h-[190px] items-center justify-center overflow-hidden rounded-[20px] bg-[#173b31] p-3">
                  <img src={screens.venue} alt="Illustrative Met venue screen with its Guest Book tab" className="max-h-[250px] w-auto max-w-full rounded-[14px] object-contain" />
                </div>
                <div>
                  <div className="mb-4 flex items-center justify-between"><HeartHandshake size={21} className="text-[#ef725a]" /><span className="font-['Space_Mono'] text-[8px] uppercase tracking-[.13em] text-[#708270]">The Guest Book</span></div>
                  <h3 className="font-['DM_Sans'] text-2xl font-black leading-tight tracking-[-.06em]">Leave a real visit in the story.</h3>
                  <p className="mt-3 font-['DM_Sans'] text-sm leading-relaxed text-[#607968]">Visitors can leave handwritten-style notes and photos from a real visit.</p>
                  <p className="mt-4 border-t border-[#e9b9a9] pt-3 font-['DM_Sans'] text-xs leading-relaxed text-[#607968]">Entries do not automatically expire. Authors can delete their entries, and moderation still applies.</p>
                </div>
              </article>
            </div>
            <p className="mt-6 text-center font-['Space_Mono'] text-[8px] uppercase tracking-[.1em] text-[#708270]">{sampleNote}</p>
          </div>
        </section>

        <section id="how" className="bg-[#173b31] py-20 text-[#f8f4e9] lg:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 lg:grid-cols-[.85fr_1.15fr] lg:px-8">
            <div className="max-w-[450px]"><Eyebrow light>Thoughtful by design</Eyebrow><h2 className="font-['DM_Sans'] text-[clamp(2.8rem,6vw,5.2rem)] font-black leading-[.9] tracking-[-.09em]">Connection, <span className="font-['Instrument_Serif'] font-normal italic text-[#d8ff68]">on your terms.</span></h2><p className="mt-6 font-['DM_Sans'] text-base leading-relaxed text-[#b8cbb4]">Met helps people remember the places and people they encounter, while keeping social reveal mutual and personal profile controls visible.</p></div>
            <div className="grid gap-5 md:grid-cols-2">
              <ProductScreen src={screens.reveal} alt="Illustrative sample of a mutual reveal request in Met" className="bg-[#f8f4e9]" />
              <div className="flex flex-col justify-center rounded-[26px] border border-[#3b6250] bg-[#214b3d] p-6 sm:p-8">
                <div className="mb-8 flex items-center justify-between"><ShieldCheck size={23} className="text-[#d8ff68]" /><span className="font-['Space_Mono'] text-[8px] uppercase tracking-[.14em] text-[#aec4aa]">Mutual consent</span></div>
                <h3 className="font-['DM_Sans'] text-2xl font-black leading-tight tracking-[-.06em]">A reveal happens only when both say yes.</h3>
                <p className="mt-4 font-['DM_Sans'] text-sm leading-relaxed text-[#aec4aa]">People can choose whether to be visible and decide when to accept a social reveal request. No pressure to make a connection public.</p>
                <div className="mt-7 inline-flex items-center gap-2 font-['Space_Mono'] text-[8px] uppercase tracking-[.12em] text-[#d8ff68]"><BadgeCheck size={14} /> Your profile, your controls</div>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-9 max-w-[1240px] px-5 lg:px-8">
            <ProductScreen src={screens.profile} alt="Illustrative sample of Met profile visibility and profile controls" className="mx-auto w-full max-w-[300px]" />
          </div>
          <p className="mt-4 text-center font-['Space_Mono'] text-[8px] uppercase tracking-[.1em] text-[#9db79a]">{sampleNote}</p>
        </section>

        <section id="venues" className="bg-[#f8f4e9] py-20 lg:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 lg:grid-cols-[.68fr_1.32fr] lg:px-8">
            <div className="max-w-[410px]">
              <Eyebrow>For the people behind the place</Eyebrow>
              <h2 className="font-['DM_Sans'] text-[clamp(2.7rem,6vw,5rem)] font-black leading-[.9] tracking-[-.085em]">Your place, part of the <span className="font-['Instrument_Serif'] font-normal italic text-[#ef725a]">neighborhood.</span></h2>
              <p className="mt-6 font-['DM_Sans'] text-base leading-relaxed text-[#5a7567]">Make your venue easier to discover on Met’s social map, welcome guest check-ins, and give your community a home for events, rewards, and updates.</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <ArrowLink href="/apply">Apply for free</ArrowLink>
                <a href="/venues" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#b3c5af] px-5 py-3 font-['DM_Sans'] text-sm font-extrabold transition-colors hover:bg-white">Venue information <ArrowRight size={16} /></a>
              </div>
              <p className="mt-4 font-['Space_Mono'] text-[8px] uppercase tracking-[.12em] text-[#708270]">Applications are reviewed before approval.</p>
            </div>
            <div className="space-y-3">
              {[
                [MapPin, "Be discoverable nearby", "Approved partner venues can appear on Met’s social map and in nearby discovery."],
                [CalendarDays, "Share what’s coming up", "Post events and announcements for guests to find."],
                [Gift, "Make visits meaningful", "Offer community rewards and show your visitor community."],
                [Sparkles, "Keep your venue details fresh", "After approval, edit your venue details, photos, hours, and contact information."],
              ].map(([Icon, title, copy], i) => {
                const ItemIcon = Icon as typeof MapPin;
                return <div key={title as string} className={`group flex items-start gap-4 rounded-[22px] border p-5 transition-transform hover:-translate-y-0.5 ${i === 1 ? "border-[#f1b8a7] bg-[#f9d4c9]/55" : "border-[#dce3d5] bg-white/55"}`}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#173b31] text-[#d8ff68]"><ItemIcon size={19} /></span>
                  <div className="flex-1"><h3 className="font-['DM_Sans'] text-base font-extrabold">{title as string}</h3><p className="mt-1 font-['DM_Sans'] text-sm leading-relaxed text-[#607968]">{copy as string}</p></div>
                  <ArrowDownRight size={18} className="text-[#829681] transition-transform group-hover:translate-x-1 group-hover:translate-y-1" />
                </div>;
              })}
              <div className="flex flex-wrap items-center gap-3 rounded-[22px] bg-[#e5f1d6] p-5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#173b31] text-[#d8ff68]"><Check size={17} /></span>
                <p className="font-['DM_Sans'] text-sm font-bold">Free to apply <span className="font-normal text-[#607968]">· reviewed by Met · edit details after approval</span></p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f2eadb] py-20 lg:py-24">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 lg:grid-cols-[.7fr_1.3fr] lg:px-8">
            <div><Eyebrow>Good to know</Eyebrow><h2 className="font-['DM_Sans'] text-[clamp(2.7rem,5vw,4.6rem)] font-black leading-[.92] tracking-[-.08em]">A few clear <span className="font-['Instrument_Serif'] font-normal italic text-[#ef725a]">answers.</span></h2><p className="mt-5 max-w-[350px] font-['DM_Sans'] text-sm leading-relaxed text-[#607968]">The basics, before you get started.</p></div>
            <FAQ />
          </div>
        </section>

        <section id="download" className="relative overflow-hidden bg-[#d8ff68] py-20 lg:py-28">
          <div className="pointer-events-none absolute -right-16 -top-28 h-[430px] w-[430px] rounded-full border border-[#173b31]/15" />
          <div className="pointer-events-none absolute right-12 top-[-40px] h-[270px] w-[270px] rounded-full border border-[#173b31]/10" />
          <div className="relative mx-auto grid max-w-[1100px] gap-10 px-5 md:grid-cols-[1fr_auto] md:items-center lg:px-8">
            <div className="max-w-[680px]"><Eyebrow>Go see what’s around</Eyebrow><h2 className="font-['DM_Sans'] text-[clamp(3rem,7vw,6rem)] font-black leading-[.88] tracking-[-.09em]">The next good place is <span className="font-['Instrument_Serif'] font-normal italic">nearby.</span></h2><p className="mt-6 max-w-[500px] font-['DM_Sans'] text-base leading-relaxed text-[#42603e]">Find local venues, check in, and make more of the places you already love.</p></div>
            <div className="flex flex-col gap-3 md:items-end"><p className="mb-1 font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.14em] text-[#55704f]">Available on iPhone and Android</p><DownloadButtons location="guest_section" /></div>
          </div>
          <div className="mx-auto mt-14 flex max-w-[1100px] flex-wrap items-center justify-between gap-4 border-t border-[#173b31]/15 px-5 pt-5 font-['Space_Mono'] text-[8px] uppercase tracking-[.13em] text-[#55704f] lg:px-8">
            <span>For venues, too</span><span>Free application</span><span>Manual review</span><a href="/apply" className="inline-flex items-center gap-2 font-bold text-[#173b31] hover:underline">Apply to become a partner <ArrowRight size={13} /></a>
          </div>
        </section>
      </main>

      <footer className="bg-[#173b31] py-10 text-[#c4d5bd]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div><Mark light /><p className="mt-4 max-w-[280px] font-['DM_Sans'] text-xs leading-relaxed text-[#92ae91]">A social map for people and the places that bring them together.</p></div>
          <div className="flex flex-wrap gap-x-7 gap-y-3 font-['DM_Sans'] text-xs font-bold text-[#b3cab0]">
            <a href="#people" className="hover:text-[#d8ff68]">For people</a><a href="#venues" className="hover:text-[#d8ff68]">For venues</a><a href="/venues" className="hover:text-[#d8ff68]">Venue info</a><a href="#download" className="hover:text-[#d8ff68]">Get the app</a><a href="/privacy" className="hover:text-[#d8ff68]">Privacy</a><a href="/support" className="hover:text-[#d8ff68]">Support</a>
          </div>
          <p className="font-['Space_Mono'] text-[9px] uppercase tracking-[.12em] text-[#718f77]">© {new Date().getFullYear()} Met</p>
        </div>
      </footer>
    </div>
  );
}
