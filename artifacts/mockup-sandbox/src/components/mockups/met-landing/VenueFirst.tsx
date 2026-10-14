import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BellRing,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Clock3,
  Compass,
  Edit3,
  ExternalLink,
  Gift,
  HeartHandshake,
  MapPin,
  Megaphone,
  Menu,
  MessageCircle,
  MoveUpRight,
  Navigation,
  NotebookPen,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

const APP_STORE_URL =
  "https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926";
const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=app.met.founders";

const reveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

function Mark({ light = false }: { light?: boolean }) {
  return (
    <span className={`flex items-center gap-2 ${light ? "text-[#f8f4e9]" : "text-[#173b31]"}`}>
      <span
        className={`grid h-8 w-8 place-items-center rounded-[11px] ${
          light ? "bg-[#d8ff68] text-[#173b31]" : "bg-[#173b31] text-[#d8ff68]"
        }`}
      >
        <span className="text-[17px] font-black tracking-[-0.14em]">M</span>
      </span>
      <span className="font-['DM_Sans'] text-[19px] font-extrabold tracking-[-0.07em]">met</span>
    </span>
  );
}

function ArrowButton({
  href,
  children,
  inverse = false,
  className = "",
  testId,
}: {
  href: string;
  children: ReactNode;
  inverse?: boolean;
  className?: string;
  testId: string;
}) {
  return (
    <a
      href={href}
      data-testid={testId}
      className={`group inline-flex items-center justify-center gap-3 rounded-full px-5 py-3.5 font-['DM_Sans'] text-sm font-bold transition-transform duration-300 hover:-translate-y-1 ${
        inverse
          ? "bg-[#f8f4e9] text-[#173b31] shadow-[0_10px_25px_rgba(3,28,20,0.16)]"
          : "bg-[#d8ff68] text-[#173b31] shadow-[0_10px_25px_rgba(16,50,40,0.18)]"
      } ${className}`}
    >
      {children}
      <span
        className={`grid h-7 w-7 place-items-center rounded-full transition-transform duration-300 group-hover:rotate-45 ${
          inverse ? "bg-[#173b31] text-[#d8ff68]" : "bg-[#173b31] text-[#d8ff68]"
        }`}
      >
        <ArrowUpRight size={15} strokeWidth={2.5} />
      </span>
    </a>
  );
}

function Label({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <div
      className={`mb-5 flex items-center gap-2 font-['Space_Mono'] text-[10px] font-bold uppercase tracking-[0.18em] ${
        light ? "text-[#d8ff68]" : "text-[#5e7b6a]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${light ? "bg-[#d8ff68]" : "bg-[#ef725a]"}`} />
      {children}
    </div>
  );
}

function DownloadButtons({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-col gap-2 ${compact ? "sm:flex-row" : "sm:flex-row"}`}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noreferrer"
        data-testid="link-download-app-store"
        className="group inline-flex items-center gap-3 rounded-[18px] bg-[#173b31] px-4 py-3 text-left text-[#f8f4e9] shadow-[0_12px_24px_rgba(23,59,49,0.16)] transition-transform hover:-translate-y-1"
      >
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#d8ff68] text-[#173b31] text-sm font-black">A</span>
        <span>
          <span className="block font-['Space_Mono'] text-[8px] uppercase tracking-[0.12em] text-[#a9c1a5]">Download on the</span>
          <span className="block font-['DM_Sans'] text-sm font-extrabold">App Store</span>
        </span>
        <ExternalLink size={14} className="ml-1 text-[#d8ff68]" />
      </a>
      <a
        href={GOOGLE_PLAY_URL}
        target="_blank"
        rel="noreferrer"
        data-testid="link-download-google-play"
        className="group inline-flex items-center gap-3 rounded-[18px] border border-[#8da886] bg-[#f8f4e9] px-4 py-3 text-left text-[#173b31] transition-transform hover:-translate-y-1"
      >
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ef725a] text-[#173b31] text-sm font-black">G</span>
        <span>
          <span className="block font-['Space_Mono'] text-[8px] uppercase tracking-[0.12em] text-[#66806c]">Get it on</span>
          <span className="block font-['DM_Sans'] text-sm font-extrabold">Google Play</span>
        </span>
        <ExternalLink size={14} className="ml-1 text-[#ef725a]" />
      </a>
    </div>
  );
}

function VenueManagerCard() {
  return (
    <motion.div
      variants={reveal}
      className="relative mx-auto w-full max-w-[490px] rotate-[2.5deg] rounded-[28px] border border-[#cbd5bd] bg-[#fbf8ef] p-3 shadow-[0_32px_70px_rgba(13,54,43,0.19)] transition-transform duration-500 hover:rotate-0"
    >
      <div className="rounded-[20px] border border-[#dce3d3] bg-white p-4">
        <div className="mb-5 flex items-center justify-between border-b border-[#edf0e9] pb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#173b31] text-[#d8ff68]">
              <Store size={16} />
            </span>
            <div>
              <p className="font-['DM_Sans'] text-xs font-extrabold text-[#173b31]">Venue manager</p>
              <p className="font-['Space_Mono'] text-[9px] uppercase tracking-[0.12em] text-[#94a595]">The Green Room</p>
            </div>
          </div>
          <span className="rounded-full bg-[#eaf7ce] px-2.5 py-1 font-['Space_Mono'] text-[9px] font-bold uppercase tracking-[0.08em] text-[#42722a]">
            Published
          </span>
        </div>
        <div className="mb-4 overflow-hidden rounded-2xl bg-[#dce8d3]">
          <img
            src="/__mockup/images/coffee-shop.png"
            alt="A warm coffee shop interior"
            className="h-[144px] w-full object-cover"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Edit3, title: "Venue details", value: "Edit anytime" },
            { icon: Clock3, title: "Opening hours", value: "Up to date" },
            { icon: NotebookPen, title: "Photos", value: "4 live photos" },
            { icon: BellRing, title: "Contact", value: "hello@greenroom" },
          ].map(({ icon: Icon, title, value }) => (
            <div key={title} className="rounded-2xl border border-[#e9eee5] bg-[#fcfdf9] p-3">
              <Icon size={15} className="mb-3 text-[#ef725a]" />
              <p className="font-['DM_Sans'] text-[11px] font-bold text-[#173b31]">{title}</p>
              <p className="mt-1 font-['Space_Mono'] text-[8px] uppercase tracking-[0.08em] text-[#91a190]">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#f2f7e9] px-3.5 py-3">
          <div className="flex items-center gap-2">
            <BadgeCheck size={17} className="text-[#538f36]" />
            <span className="font-['DM_Sans'] text-xs font-bold text-[#31583a]">Verified partner</span>
          </div>
          <span className="font-['Space_Mono'] text-[9px] uppercase tracking-[0.08em] text-[#718b6e]">Approved</span>
        </div>
      </div>
    </motion.div>
  );
}

function LiveMapCard() {
  const pins = [
    { x: "22%", y: "30%", name: "Common Ground", color: "#ef725a" },
    { x: "68%", y: "25%", name: "The Green Room", color: "#d8ff68" },
    { x: "50%", y: "68%", name: "Pavilion 8", color: "#ef725a" },
  ];

  return (
    <div className="relative h-[360px] overflow-hidden rounded-[30px] border border-[#3c604a] bg-[#193f34] shadow-[0_25px_60px_rgba(22,61,49,0.2)]">
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(#9dbb8f 1px, transparent 1px), linear-gradient(90deg, #9dbb8f 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
      <div className="absolute -left-16 top-20 h-56 w-56 rounded-full border border-[#98c475]/30" />
      <div className="absolute left-10 top-16 h-72 w-72 rounded-full border border-[#98c475]/20" />
      <div className="absolute right-[-90px] bottom-[-100px] h-80 w-80 rounded-full bg-[#d8ff68]/10 blur-3xl" />
      <div className="absolute left-5 right-5 top-5 flex items-center justify-between">
        <div>
          <p className="font-['Space_Mono'] text-[9px] uppercase tracking-[0.18em] text-[#d8ff68]">Live nearby</p>
          <p className="mt-1 font-['DM_Sans'] text-sm font-bold text-[#f8f4e9]">West End, Cape Town</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[#0f3028]/80 px-3 py-2 font-['Space_Mono'] text-[9px] uppercase tracking-[0.1em] text-[#c6dac0]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d8ff68]" />
          Social map
        </div>
      </div>
      {pins.map((pin) => (
        <motion.div
          key={pin.name}
          initial={{ opacity: 0, scale: 0.5 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="absolute"
          style={{ left: pin.x, top: pin.y }}
        >
          <div className="relative">
            <div className="absolute -inset-2 animate-ping rounded-full opacity-20" style={{ backgroundColor: pin.color }} />
            <div className="relative grid h-9 w-9 place-items-center rounded-full border-2 border-[#173b31] shadow-lg" style={{ backgroundColor: pin.color }}>
              {pin.name === "The Green Room" ? <BadgeCheck size={17} className="text-[#173b31]" /> : <MapPin size={17} className="text-[#173b31]" />}
            </div>
            <div className="absolute left-1/2 top-11 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#f8f4e9] px-2.5 py-1 font-['DM_Sans'] text-[10px] font-bold text-[#173b31] shadow-lg">
              {pin.name}
            </div>
          </div>
        </motion.div>
      ))}
      <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/10 bg-[#0f3028]/80 p-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex -space-x-2">
              {["AM", "KL", "RS"].map((initials, index) => (
                <span key={initials} className={`grid h-7 w-7 place-items-center rounded-full border-2 border-[#173b31] text-[9px] font-bold ${index === 1 ? "bg-[#ef725a]" : "bg-[#d8ff68]"} text-[#173b31]`}>
                  {initials}
                </span>
              ))}
            </div>
            <span className="font-['DM_Sans'] text-xs font-medium text-[#dce9d7]">Guests are checking in nearby</span>
          </div>
          <ArrowRight size={16} className="text-[#d8ff68]" />
        </div>
      </div>
    </div>
  );
}

function BenefitCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  tint = "cream",
}: {
  icon: typeof MapPin;
  eyebrow: string;
  title: string;
  description: string;
  tint?: "cream" | "lime" | "coral";
}) {
  const backgrounds = {
    cream: "bg-[#f8f4e9] border-[#e9e1cf]",
    lime: "bg-[#e5f7b9] border-[#cbe891]",
    coral: "bg-[#f9d4c9] border-[#f1b8a7]",
  };
  return (
    <motion.div
      variants={reveal}
      className={`group min-h-[250px] rounded-[25px] border p-6 transition-transform duration-300 hover:-translate-y-1 ${backgrounds[tint]}`}
    >
      <div className="mb-12 flex items-start justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#173b31] text-[#d8ff68]">
          <Icon size={20} />
        </span>
        <ArrowDownRight size={20} className="text-[#5e7b6a] transition-transform duration-300 group-hover:translate-x-1 group-hover:translate-y-1" />
      </div>
      <p className="mb-2 font-['Space_Mono'] text-[9px] font-bold uppercase tracking-[0.16em] text-[#65806a]">{eyebrow}</p>
      <h3 className="mb-2 font-['DM_Sans'] text-[21px] font-extrabold leading-[1.08] tracking-[-0.04em] text-[#173b31]">{title}</h3>
      <p className="font-['DM_Sans'] text-sm leading-relaxed text-[#557064]">{description}</p>
    </motion.div>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const faqs = [
    ["Is there a cost to apply?", "No. Applying to become a Met partner venue is free. Every application is manually reviewed before a venue is approved."],
    ["What can I change after approval?", "Through the venue manager, approved partners can edit venue details, photos, opening hours, and contact information."],
    ["What happens after I apply?", "Met reviews the venue information manually. If approved, the venue can appear in hub discovery with a verified-partner badge."],
    ["What kinds of places belong on Met?", "Met is built for public social spaces such as cafés, bars, restaurants, gyms, co-working spaces, and event venues."],
  ];
  return (
    <div className="divide-y divide-[#d7dfd0] border-y border-[#d7dfd0]">
      {faqs.map(([question, answer], index) => {
        const isOpen = open === index;
        return (
          <div key={question}>
            <button
              type="button"
              data-testid={`button-faq-${index}`}
              onClick={() => setOpen(isOpen ? null : index)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-5 py-5 text-left"
            >
              <span className="font-['DM_Sans'] text-base font-bold text-[#173b31]">{question}</span>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#abc1a6] text-[#4f7659] transition-transform duration-300 ${isOpen ? "rotate-180 bg-[#d8ff68]" : ""}`}>
                <ChevronDown size={15} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.p
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="max-w-[620px] overflow-hidden pb-5 font-['DM_Sans'] text-sm leading-relaxed text-[#5a7567]"
                >
                  {answer}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export function VenueFirst() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-hidden bg-[#f8f4e9] text-[#173b31] selection:bg-[#d8ff68] selection:text-[#173b31]">
      <style>{`
        @keyframes venue-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes soft-float { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-8px) rotate(-2deg); } }
        .met-marquee { animation: venue-marquee 28s linear infinite; }
        .met-float { animation: soft-float 5s ease-in-out infinite; }
        .met-grain::after { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .055; mix-blend-mode: multiply; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.45'/%3E%3C/svg%3E"); }
        html, body, #root { max-width: 100%; overflow-x: hidden; }
      `}</style>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#dce3d5]/80 bg-[#f8f4e9]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <a href="#top" data-testid="link-brand" aria-label="Met home">
            <Mark />
          </a>
          <nav className="hidden items-center gap-7 md:flex">
            <a href="#for-venues" data-testid="link-nav-venues" className="font-['DM_Sans'] text-sm font-bold text-[#557064] transition-colors hover:text-[#173b31]">For venues</a>
            <a href="#how-it-works" data-testid="link-nav-how-it-works" className="font-['DM_Sans'] text-sm font-bold text-[#557064] transition-colors hover:text-[#173b31]">How it works</a>
            <a href="#for-people" data-testid="link-nav-people" className="font-['DM_Sans'] text-sm font-bold text-[#557064] transition-colors hover:text-[#173b31]">For people</a>
          </nav>
          <div className="flex items-center gap-3">
            <a href="#for-venues" data-testid="link-nav-apply" className="hidden rounded-full border border-[#aabca9] px-4 py-2.5 font-['DM_Sans'] text-xs font-extrabold text-[#173b31] transition-colors hover:bg-white sm:inline-flex">Apply your venue</a>
             <a href="#download" data-testid="link-nav-download" className="rounded-full bg-[#173b31] px-4 py-2.5 font-['DM_Sans'] text-xs font-extrabold text-[#d8ff68] transition-transform hover:-translate-y-0.5">Get the app</a>
            <button type="button" data-testid="button-mobile-menu" onClick={() => setMenuOpen(!menuOpen)} className="grid h-10 w-10 place-items-center rounded-full border border-[#aabca9] md:hidden">
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-[#dce3d5] bg-[#f8f4e9] md:hidden">
              <div className="flex flex-col gap-1 px-5 py-4">
                {[
                  ["For venues", "#for-venues"],
                  ["How it works", "#how-it-works"],
                  ["For people", "#for-people"],
                ].map(([label, href]) => (
                  <a key={href} href={href} data-testid={`link-mobile-${label.toLowerCase().replaceAll(" ", "-")}`} onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 font-['DM_Sans'] text-sm font-bold text-[#557064] hover:bg-white">{label}</a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="top">
        <section className="met-grain relative min-h-[540px] overflow-hidden bg-[#173b31] pt-[126px] text-[#f8f4e9] lg:min-h-0 lg:pt-[154px]">
          <div className="absolute -right-44 top-[-180px] h-[560px] w-[560px] rounded-full border border-[#7ca65c]/30" />
          <div className="absolute right-[-100px] top-[-35px] h-[410px] w-[410px] rounded-full border border-[#7ca65c]/20" />
          <div className="absolute bottom-[-280px] left-[-160px] h-[500px] w-[500px] rounded-full bg-[#d8ff68]/10 blur-3xl" />
          <div className="relative mx-auto hidden max-w-[1240px] gap-14 px-5 pb-20 lg:grid lg:grid-cols-[0.93fr_1.07fr] lg:items-center lg:px-8 lg:pb-28">
            <div className="relative z-10 max-w-[630px]">
              <div><Label light>Built for the places people choose</Label></div>
              <h1 className="max-w-[650px] font-['DM_Sans'] text-[clamp(3.5rem,8vw,7.5rem)] font-black leading-[0.89] tracking-[-0.085em]">
                Make your place <span className="font-['Instrument_Serif'] font-normal italic text-[#d8ff68]">the meeting point.</span>
              </h1>
              <p className="mt-7 max-w-[530px] font-['DM_Sans'] text-base leading-relaxed text-[#c4d5bd] sm:text-lg">
                Met puts trusted venues on the social map, so nearby guests can find your space, check in, and discover reasons to come back.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <ArrowButton href="/venues" testId="link-hero-venue-apply">Apply your venue</ArrowButton>
                <ArrowButton href="#download" inverse testId="link-hero-app-download">Download Met</ArrowButton>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-['Space_Mono'] text-[10px] uppercase tracking-[0.1em] text-[#91ad8d]">
                <span className="flex items-center gap-2"><CircleCheck size={13} className="text-[#d8ff68]" /> Free to apply</span>
                <span className="flex items-center gap-2"><CircleCheck size={13} className="text-[#d8ff68]" /> Manual review</span>
                <span className="flex items-center gap-2"><CircleCheck size={13} className="text-[#d8ff68]" /> Edit after approval</span>
              </div>
            </div>
            <div className="relative min-h-[500px]">
              <div className="absolute right-0 top-0 z-10 w-[85%] max-w-[520px] overflow-hidden rounded-[30px] border-[7px] border-[#f8f4e9]/85 shadow-[0_25px_80px_rgba(0,0,0,0.3)]">
                <img src="/__mockup/images/coffee-shop.png" alt="Guests gathering at a welcoming venue" className="h-[405px] w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#173b31]/80 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5">
                  <div className="mb-2 flex items-center gap-2 font-['Space_Mono'] text-[9px] uppercase tracking-[0.16em] text-[#d8ff68]"><span className="h-1.5 w-1.5 rounded-full bg-[#d8ff68]" /> Partner venue</div>
                  <p className="font-['DM_Sans'] text-2xl font-extrabold tracking-[-0.05em] text-white">The Green Room</p>
                  <p className="mt-1 font-['DM_Sans'] text-xs text-white/75">Coffee, conversation, and a reason to stay a little longer.</p>
                </div>
              </div>
              <div className="met-float absolute bottom-4 left-0 z-20 w-[230px] rounded-[23px] border border-[#d8ff68]/50 bg-[#d8ff68] p-4 text-[#173b31] shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
                <div className="mb-4 flex items-center justify-between"><span className="font-['Space_Mono'] text-[9px] font-bold uppercase tracking-[0.14em]">Right now</span><Navigation size={16} /></div>
                <p className="font-['DM_Sans'] text-[29px] font-black leading-none tracking-[-0.07em]">Find your people.</p>
                <p className="mt-3 font-['DM_Sans'] text-xs font-medium leading-relaxed text-[#416040]">Nearby guests can discover your hub and check in when it feels like the right place to be.</p>
              </div>
              <div className="absolute bottom-14 right-[-8px] z-10 hidden rounded-2xl bg-[#f8f4e9] px-4 py-3 shadow-xl sm:block">
                <div className="flex items-center gap-2"><BadgeCheck size={16} className="text-[#538f36]" /><span className="font-['DM_Sans'] text-xs font-bold text-[#173b31]">Verified partner</span></div>
              </div>
            </div>
          </div>
          <div className="absolute left-0 right-0 top-[112px] z-30 box-border block w-full max-w-full overflow-x-hidden px-5 pb-16 lg:hidden">
            <Label light>Built for the places people choose</Label>
            <h1 style={{ width: "calc(100vw - 40px)", maxWidth: "100%", whiteSpace: "normal" }} className="break-words font-['DM_Sans'] text-[3.2rem] font-black leading-[0.88] tracking-[-0.085em]">
              Make your place <span className="font-['Instrument_Serif'] font-normal italic text-[#d8ff68]">the meeting point.</span>
            </h1>
            <p style={{ width: "calc(100vw - 40px)", maxWidth: "100%", whiteSpace: "normal" }} className="mt-6 font-['DM_Sans'] text-base leading-relaxed text-[#c4d5bd]">
              Met puts trusted venues on the social map, so nearby guests can find your space, check in, and discover reasons to come back.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <a href="/venues" data-testid="link-mobile-hero-venue-apply" style={{ display: "flex", width: "calc(100vw - 40px)", maxWidth: "calc(100vw - 40px)", minWidth: 0, boxSizing: "border-box", alignItems: "center", justifyContent: "center", textAlign: "center", whiteSpace: "normal", color: "#173b31", fontSize: "14px", lineHeight: "20px", fontWeight: 800 }} className="rounded-full bg-[#d8ff68] px-5 py-3.5">Apply your venue</a>
              <a href="#download" data-testid="link-mobile-hero-app-download" style={{ display: "flex", width: "calc(100vw - 40px)", maxWidth: "calc(100vw - 40px)", minWidth: 0, boxSizing: "border-box", alignItems: "center", justifyContent: "center", textAlign: "center", whiteSpace: "normal", color: "#173b31", fontSize: "14px", lineHeight: "20px", fontWeight: 800 }} className="rounded-full bg-[#f8f4e9] px-5 py-3.5">Download Met</a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 font-['Space_Mono'] text-[9px] uppercase tracking-[0.1em] text-[#91ad8d]">
              <span className="flex items-center gap-1.5"><CircleCheck size={12} className="text-[#d8ff68]" /> Free to apply</span>
              <span className="flex items-center gap-1.5"><CircleCheck size={12} className="text-[#d8ff68]" /> Manual review</span>
            </div>
          </div>
          <div className="mt-[430px] overflow-hidden border-t border-[#52715a]/45 bg-[#214b3d] py-3.5 lg:mt-0">
            <div className="met-marquee flex w-max items-center gap-8 whitespace-nowrap font-['Space_Mono'] text-[10px] uppercase tracking-[0.15em] text-[#b5ccaa]">
              {Array.from({ length: 2 }).flatMap((_, group) =>
                ["Your hub on the social map", "Events", "Rewards", "Announcements", "Nearby guests", "A place worth returning to"].map((item, index) => (
                  <span key={`${group}-${item}`} className="flex items-center gap-8">{item}<span className="text-[#d8ff68]">·</span></span>
                )),
              )}
            </div>
          </div>
        </section>

        <section id="for-venues" className="relative bg-[#f8f4e9] py-20 lg:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 lg:grid-cols-[0.68fr_1.32fr] lg:px-8">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="max-w-[380px]">
              <motion.div variants={reveal}><Label>Why partner with Met</Label></motion.div>
              <motion.h2 variants={reveal} className="font-['DM_Sans'] text-[clamp(2.5rem,5vw,4.6rem)] font-black leading-[0.94] tracking-[-0.075em]">A better way to be <span className="font-['Instrument_Serif'] font-normal italic text-[#ef725a]">found.</span></motion.h2>
              <motion.p variants={reveal} className="mt-6 font-['DM_Sans'] text-base leading-relaxed text-[#5a7567]">Your venue is more than an address. It is where plans form, communities gather, and familiar faces become part of the story.</motion.p>
              <motion.a variants={reveal} href="/apply" data-testid="link-benefits-apply" className="mt-7 inline-flex items-center gap-2 font-['DM_Sans'] text-sm font-extrabold text-[#173b31] underline decoration-[#ef725a] decoration-2 underline-offset-4 hover:text-[#ef725a]">See the application <ArrowRight size={16} /></motion.a>
            </motion.div>
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="grid gap-3 sm:grid-cols-2">
              <BenefitCard icon={MapPin} eyebrow="01 / Visibility" title="Show up where people are looking." description="Approved partner venues can appear in Met's social map and hub discovery, giving nearby guests another place to explore." tint="lime" />
              <BenefitCard icon={UsersRound} eyebrow="02 / Footfall" title="Turn nearby interest into a visit." description="Guests close to your venue can discover it, check in, and see the place as part of their social surroundings." tint="cream" />
              <BenefitCard icon={HeartHandshake} eyebrow="03 / Connection" title="Give the room a social layer." description="Met helps people find real people nearby and build mutual private interest before they chat — around places that matter." tint="coral" />
              <BenefitCard icon={CalendarDays} eyebrow="04 / Events" title="Make the next gathering easy to find." description="Put upcoming events where nearby guests are already looking, so a good night has a better chance of filling the room." tint="cream" />
              <BenefitCard icon={Gift} eyebrow="05 / Rewards" title="Give guests a reason to return." description="Share venue rewards through your hub and make a visit feel connected to the next one." tint="lime" />
              <BenefitCard icon={Megaphone} eyebrow="06 / Announcements" title="Keep your regulars in the loop." description="Surface timely announcements, new moments, and updates without relying on a guest to remember to check elsewhere." tint="coral" />
            </motion.div>
          </div>
        </section>

        <section className="bg-[#f2eadb] py-16 lg:py-24">
          <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
            <div className="grid gap-8 overflow-hidden rounded-[32px] bg-[#ef725a] p-6 text-[#173b31] sm:p-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:p-14">
              <div>
                <Label>More than a listing</Label>
                <h2 className="font-['DM_Sans'] text-[clamp(2.4rem,5vw,4.5rem)] font-black leading-[0.94] tracking-[-0.075em]">Give people a reason to <span className="font-['Instrument_Serif'] font-normal italic">show up.</span></h2>
                <p className="mt-5 max-w-[420px] font-['DM_Sans'] text-base leading-relaxed text-[#4f5f43]">A Met hub can help guests discover what is happening at your venue now, what is coming next, and what makes a return visit worth it.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: CalendarDays, label: "EVENT", title: "Friday social", text: "Starts 19:00" },
                  { icon: Gift, label: "REWARD", title: "Bring a friend", text: "This weekend" },
                  { icon: Megaphone, label: "NOTICE", title: "New menu", text: "Just posted" },
                ].map(({ icon: Icon, label, title, text }) => (
                  <div key={label} className="rounded-[22px] border border-[#f5a28d] bg-[#f8f4e9]/90 p-4 shadow-[0_12px_25px_rgba(115,52,36,0.11)]">
                    <div className="mb-9 flex items-center justify-between"><Icon size={17} className="text-[#ef725a]" /><span className="font-['Space_Mono'] text-[8px] font-bold tracking-[0.14em] text-[#71856d]">{label}</span></div>
                    <p className="font-['DM_Sans'] text-base font-extrabold">{title}</p>
                    <p className="mt-1 font-['Space_Mono'] text-[9px] uppercase tracking-[0.08em] text-[#71856d]">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#e6f1d7] py-16 lg:py-24">
          <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
            <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="max-w-[560px]">
                <Label>Picture the handoff</Label>
                <h2 className="font-['DM_Sans'] text-[clamp(2.4rem,5vw,4.5rem)] font-black leading-[0.94] tracking-[-0.075em]">From map glance to <span className="font-['Instrument_Serif'] font-normal italic text-[#ef725a]">hello.</span></h2>
              </div>
              <p className="max-w-[350px] font-['DM_Sans'] text-sm leading-relaxed text-[#5a7567]">The guest experience starts before the door and continues after the check-in.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
              <LiveMapCard />
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} variants={stagger} className="space-y-3">
                {[
                  { icon: Search, step: "01", title: "They spot your hub", description: "Your approved venue is part of the nearby social map and hub discovery." },
                  { icon: Navigation, step: "02", title: "They check in", description: "A guest can choose your venue as the place they are spending time right now." },
                  { icon: MessageCircle, step: "03", title: "The room connects", description: "Met makes room for real people, mutual interest, and conversations with context." },
                ].map(({ icon: Icon, step, title, description }) => (
                  <motion.div variants={reveal} key={step} className="flex gap-4 rounded-[21px] border border-[#cadbbd] bg-[#f8f4e9]/70 p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#173b31] font-['Space_Mono'] text-[10px] font-bold text-[#d8ff68]">{step}</span>
                    <div><div className="mb-1 flex items-center gap-2"><Icon size={15} className="text-[#ef725a]" /><h3 className="font-['DM_Sans'] text-sm font-extrabold text-[#173b31]">{title}</h3></div><p className="font-['DM_Sans'] text-xs leading-relaxed text-[#607968]">{description}</p></div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-[#173b31] py-20 text-[#f8f4e9] lg:py-28">
          <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <Label light>Simple by design</Label>
                <h2 className="font-['DM_Sans'] text-[clamp(2.6rem,5vw,4.9rem)] font-black leading-[0.92] tracking-[-0.08em]">The good stuff starts with <span className="font-['Instrument_Serif'] font-normal italic text-[#d8ff68]">trust.</span></h2>
                <p className="mt-6 max-w-[400px] font-['DM_Sans'] text-base leading-relaxed text-[#b8cbb4]">You stay in control of your venue details. Met keeps the network considered with a manual review before a partner is approved.</p>
              </div>
              <div className="grid gap-3">
                {[
                  { icon: Plus, title: "Apply for free", text: "Share your venue information through the partner application. There is no charge to apply." },
                  { icon: ShieldCheck, title: "Get manually reviewed", text: "Met reviews each application so venue discovery stays relevant and trusted." },
                  { icon: Edit3, title: "Make it yours", text: "Once approved, use the venue manager to edit details, photos, hours, and contact information." },
                ].map(({ icon: Icon, title, text }, index) => (
                  <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} key={title} className="flex items-start gap-5 rounded-[24px] border border-[#3b6250] bg-[#214b3d] p-5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#d8ff68] text-[#173b31]"><Icon size={19} /></span>
                    <div><h3 className="font-['DM_Sans'] text-lg font-extrabold text-[#f8f4e9]">{title}</h3><p className="mt-1 max-w-[500px] font-['DM_Sans'] text-sm leading-relaxed text-[#aec4aa]">{text}</p></div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="for-people" className="bg-[#f8f4e9] py-20 lg:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8">
            <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
              <div className="absolute -left-4 -top-4 z-10 rounded-2xl bg-[#ef725a] px-4 py-3 font-['Space_Mono'] text-[9px] font-bold uppercase tracking-[0.12em] text-[#173b31] shadow-lg">For the curious nearby</div>
              <div className="overflow-hidden rounded-[30px] border-[7px] border-[#173b31] bg-[#173b31] shadow-[0_30px_65px_rgba(23,59,49,0.2)]">
                <img src="/__mockup/images/park-app.png" alt="People using Met to discover a place nearby" className="h-[440px] w-full object-cover" />
              </div>
            </motion.div>
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
              <motion.div variants={reveal}><Label>And for the people in the room</Label></motion.div>
              <motion.h2 variants={reveal} className="font-['DM_Sans'] text-[clamp(2.6rem,5vw,4.7rem)] font-black leading-[0.92] tracking-[-0.08em]">Real people. <br /><span className="font-['Instrument_Serif'] font-normal italic text-[#ef725a]">Right nearby.</span></motion.h2>
              <motion.p variants={reveal} className="mt-6 max-w-[480px] font-['DM_Sans'] text-base leading-relaxed text-[#5a7567]">Met helps guests find a social layer in the places they already go. Discover nearby hubs, check in, and find a reason to say hello — without the pressure.</motion.p>
              <motion.div variants={reveal} className="mt-7 grid max-w-[500px] gap-3 sm:grid-cols-2">
                {[
                  "Find real people nearby",
                  "Share private interest before chat",
                  "Discover communities around places",
                  "See events and rewards at hubs",
                ].map((text) => <div key={text} className="flex items-start gap-2 font-['DM_Sans'] text-sm font-bold text-[#315844]"><CircleCheck size={16} className="mt-0.5 shrink-0 text-[#ef725a]" />{text}</div>)}
              </motion.div>
               <motion.div variants={reveal} id="download" className="mt-9">
                 <p className="mb-3 font-['Space_Mono'] text-[9px] font-bold uppercase tracking-[0.14em] text-[#65806a]">Available for iPhone and Android</p>
                 <DownloadButtons />
               </motion.div>
            </motion.div>
          </div>
        </section>

        <section className="bg-[#f2eadb] py-20 lg:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
            <div>
              <Label>Good to know</Label>
              <h2 className="font-['DM_Sans'] text-[clamp(2.5rem,5vw,4.4rem)] font-black leading-[0.94] tracking-[-0.075em]">Questions, <span className="font-['Instrument_Serif'] font-normal italic text-[#ef725a]">answered.</span></h2>
              <p className="mt-5 max-w-[350px] font-['DM_Sans'] text-sm leading-relaxed text-[#607968]">A clear partnership starts with clear expectations.</p>
            </div>
            <FAQ />
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#d8ff68] py-20 lg:py-28">
          <div className="absolute -right-20 -top-32 h-[400px] w-[400px] rounded-full border border-[#173b31]/15" />
          <div className="absolute -right-2 top-[-60px] h-[250px] w-[250px] rounded-full border border-[#173b31]/10" />
          <div className="relative mx-auto flex max-w-[900px] flex-col items-center px-5 text-center">
            <Sparkles size={25} className="mb-6 text-[#ef725a]" />
            <h2 className="font-['DM_Sans'] text-[clamp(2.8rem,6vw,5.8rem)] font-black leading-[0.9] tracking-[-0.09em] text-[#173b31]">Put your place <br /><span className="font-['Instrument_Serif'] font-normal italic">on the map.</span></h2>
            <p className="mt-6 max-w-[550px] font-['DM_Sans'] text-base leading-relaxed text-[#42603e]">Apply to become a Met partner venue. It is free to apply, reviewed manually, and built to help the right people find the places worth showing up for.</p>
             <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <ArrowButton href="/apply" testId="link-final-venue-apply">Apply to list your venue</ArrowButton>
            </div>
             <div className="mt-7 flex justify-center">
               <DownloadButtons compact />
             </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#173b31] py-10 text-[#c4d5bd]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div><Mark light /><p className="mt-4 max-w-[270px] font-['DM_Sans'] text-xs leading-relaxed text-[#92ae91]">A social map for people and the places that bring them together.</p></div>
          <div className="flex flex-wrap gap-x-7 gap-y-3 font-['DM_Sans'] text-xs font-bold text-[#b3cab0]">
            <a href="#for-venues" data-testid="link-footer-venues" className="hover:text-[#d8ff68]">For venues</a>
            <a href={APP_STORE_URL} target="_blank" rel="noreferrer" data-testid="link-footer-app" className="hover:text-[#d8ff68]">Download Met</a>
            <a href="mailto:metapp.contact@gmail.com" data-testid="link-footer-contact" className="hover:text-[#d8ff68]">Contact</a>
          </div>
          <p className="font-['Space_Mono'] text-[9px] uppercase tracking-[0.12em] text-[#718f77]">© {new Date().getFullYear()} Met</p>
        </div>
      </footer>
    </div>
  );
}

export default VenueFirst;