import { useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Compass,
  Gift,
  HeartHandshake,
  MapPin,
  Megaphone,
  Menu,
  Radio,
  ShieldCheck,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import { DownloadButtons, Mark } from "../components/MetLandingParts";
import {
  venueApplicationHref,
} from "../lib/analytics";

const images = {
  map: "/images/met-home-2026.png",
  checkin: "/images/met-checkin-2026.png",
  community: "/images/met-community-2026.png",
  encounters: "/images/met-encounters-2026.png",
  venue: "/images/met-venue-2026.png",
};

const sampleCaption = "Met product screen · fictional sample data";

function Note({
  children,
  light = false,
}: {
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <div
      className={`mb-4 flex items-center gap-2 font-['Space_Mono'] text-[9px] font-bold uppercase tracking-[.19em] ${
        light ? "text-[#d8ff68]" : "text-[#63806b]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          light ? "bg-[#d8ff68]" : "bg-[#e8765d]"
        }`}
      />
      {children}
    </div>
  );
}

function AtlasImage({
  src,
  alt,
  label,
  className = "",
  imageClassName = "",
}: {
  src: string;
  alt: string;
  label: string;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <figure
      className={`overflow-hidden rounded-[24px] border border-[#d5dece] bg-[#fcfaf2] p-2 shadow-[0_22px_52px_rgba(23,59,49,.13)] ${className}`}
    >
      <div className="overflow-hidden rounded-[17px] bg-[#e8eee2]">
        <img
          src={src}
          alt={alt}
          className={`block h-auto w-full object-contain ${imageClassName}`}
        />
      </div>
      <figcaption className="px-2 pb-1 pt-3 font-['Space_Mono'] text-[8px] uppercase tracking-[.1em] text-[#6d826d]">
        {label} · {sampleCaption}
      </figcaption>
    </figure>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const items: { question: string; answer: ReactNode }[] = [
    {
      question: "What is Met?",
      answer:
        "Met helps people discover nearby venues on a social map, check in, and remember people and places they encountered.",
    },
    {
      question: "How does social reveal work?",
      answer:
        "A reveal request is mutual: social details are shared only when both people accept.",
    },
    {
      question: "What can a venue do on Met?",
      answer:
        "Venues can share events and announcements, and approved partners can update their details, photos, hours, and contact information.",
    },
    {
      question: "Is it free to apply?",
      answer: "Yes. Venue applications are free and are reviewed before approval.",
    },
    {
      question: "How do I register my venue?",
      answer: (
        <>
          Apply using Met’s{" "}
          <a
            href={venueApplicationHref("faq")}
            className="font-bold text-[#315844] underline decoration-[#ef725a] underline-offset-2 hover:text-[#173b31]"
          >
            venue application form
          </a>
          . Applications are free and reviewed before approval.
        </>
      ),
    },
    {
      question: "How is my privacy protected?",
      answer:
        "Data sent between your device and Met is encrypted in transit. Nearby visibility is optional and uses Bluetooth to detect nearby Met users; GPS may also be used for nearby features. Met does not keep a continuous GPS history.",
    },
  ];

  return (
    <div className="divide-y divide-[#cfd9c8] border-y border-[#cfd9c8]">
      {items.map(({ question, answer }, index) => {
        const expanded = open === index;
        return (
          <div key={question}>
            <button
              type="button"
              data-testid={`button-faq-${index}`}
              aria-expanded={expanded}
              aria-controls={`landing-faq-answer-${index}`}
              onClick={() => setOpen(expanded ? null : index)}
              className="flex w-full items-center justify-between gap-5 py-5 text-left"
            >
              <span className="font-['DM_Sans'] text-sm font-extrabold text-[#173b31] sm:text-base">
                {question}
              </span>
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#a9bba5] text-[#315844] transition-transform ${
                  expanded ? "rotate-180 bg-[#d8ff68]" : ""
                }`}
              >
                <ChevronDown size={16} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  id={`landing-faq-answer-${index}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="max-w-[680px] overflow-hidden pb-5 font-['DM_Sans'] text-sm leading-relaxed text-[#5c7463]"
                >
                  {answer}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export default function CityFieldGuideLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    { label: "The field guide", href: "#field-guide" },
    { label: "Travel guides", href: "/guides/" },
    { label: "For venues", href: "#venues" },
    { label: "Questions", href: "#questions" },
  ];

  return (
    <div className="met-creative min-h-[100dvh] overflow-x-hidden bg-[#f8f4e9] text-[#173b31]">
      <style>{`
        .met-creative { width: 100%; max-width: 100vw; }
        .met-creative * { box-sizing: border-box; }
        .met-paper-grid {
          background-image: linear-gradient(rgba(23,59,49,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(23,59,49,.055) 1px, transparent 1px);
          background-size: 32px 32px;
        }
        .met-path-dash { stroke-dasharray: 5 9; animation: path-walk 22s linear infinite; }
        @keyframes path-walk { to { stroke-dashoffset: -140; } }
        @media (prefers-reduced-motion: reduce) { .met-path-dash { animation: none; } }
      `}</style>

      <header className="sticky top-0 z-50 border-b border-[#dbe2d4] bg-[#f8f4e9]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[70px] max-w-[1280px] items-center justify-between px-5 lg:px-8">
          <a href="#top" data-testid="link-brand" aria-label="Met home">
            <Mark />
          </a>
          <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
            {links.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                data-testid={
                  href === "#venues"
                    ? "link-nav-venues"
                    : href === "#questions"
                      ? "link-nav-questions"
                      : href === "/guides/"
                        ? "link-nav-travel-guides"
                        : "link-nav-field-guide"
                }
                className="font-['DM_Sans'] text-sm font-bold text-[#597260] transition-colors hover:text-[#173b31]"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <a
              href={venueApplicationHref("header")}
              data-testid="link-nav-apply"
              className="hidden rounded-full border border-[#aebfaa] px-4 py-2.5 font-['DM_Sans'] text-xs font-extrabold transition-colors hover:bg-white sm:inline-flex"
            >
              Apply your venue
            </a>
            <a
              href="#download"
              data-testid="link-nav-download"
              className="rounded-full bg-[#173b31] px-4 py-2.5 font-['DM_Sans'] text-xs font-extrabold text-[#d8ff68] transition-transform hover:-translate-y-0.5"
            >
              Get the app
            </a>
            <button
              type="button"
              data-testid="button-mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
              className="grid h-10 w-10 place-items-center rounded-full border border-[#aebfaa] md:hidden"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              aria-label="Mobile"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-[#dbe2d4] bg-[#f8f4e9] md:hidden"
            >
              <div className="flex flex-col gap-1 px-5 py-3">
                {links.map(({ label, href }) => (
                  <a
                    key={href}
                    href={href}
                    data-testid={`link-mobile-${label.toLowerCase().replaceAll(" ", "-")}`}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl px-3 py-3 font-['DM_Sans'] text-sm font-bold text-[#597260] hover:bg-white"
                  >
                    {label}
                  </a>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main id="top">
        <section className="relative overflow-hidden bg-[#173b31] text-[#f8f4e9]">
          <div className="absolute inset-0 opacity-[.2] met-paper-grid" />
          <div className="absolute -right-40 -top-56 h-[600px] w-[600px] rounded-full border border-[#d8ff68]/20" />
          <div className="relative mx-auto grid max-w-[1280px] gap-8 px-5 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-16 lg:grid-cols-[1.12fr_.88fr] lg:items-start lg:gap-12 lg:px-10 lg:pb-16 lg:pt-14">
            <div className="relative z-10 min-w-0">
              <Note light>Met field guide · 01 / look around</Note>
              <h1 className="max-w-[620px] font-['DM_Sans'] text-[clamp(3rem,7.5vw,6.7rem)] font-black leading-[.85] tracking-[-.09em]">
                A city is made of{" "}
                <span className="font-['Instrument_Serif'] text-[.76em] font-normal italic tracking-normal text-[#d8ff68]">
                  places we share.
                </span>
              </h1>
              <p className="mt-6 max-w-[485px] font-['DM_Sans'] text-base leading-relaxed text-[#c4d5bd] sm:text-lg">
                Find nearby venues on Met’s social map. Check in, notice who you
                cross paths with, and keep the moments that make a place yours.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#download"
                  data-testid="link-hero-app-download"
                  className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#d8ff68] px-5 py-3 font-['DM_Sans'] text-sm font-extrabold text-[#173b31] transition-transform hover:-translate-y-0.5"
                >
                  Explore Met{" "}
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#173b31] text-[#d8ff68] transition-transform group-hover:rotate-45">
                    <ArrowUpRight size={15} />
                  </span>
                </a>
                <a
                  href={venueApplicationHref("hero")}
                  data-testid="link-hero-venue-apply"
                  className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-[#8aa38d] px-5 py-3 font-['DM_Sans'] text-sm font-extrabold text-[#f8f4e9] transition-colors hover:bg-[#214b3d]"
                >
                  For local venues <ArrowRight size={16} className="text-[#d8ff68]" />
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-['Space_Mono'] text-[8px] uppercase tracking-[.12em] text-[#9db79a]">
                <span className="flex items-center gap-2">
                  <Radio size={13} className="text-[#d8ff68]" /> Nearby through
                  Bluetooth
                </span>
                <span className="flex items-center gap-2">
                  <ShieldCheck size={13} className="text-[#d8ff68]" /> Reveal is
                  mutual
                </span>
              </div>
              <div className="mt-10 hidden items-center gap-3 border-t border-[#52715a]/70 pt-4 sm:flex">
                <span className="font-['Space_Mono'] text-[8px] uppercase tracking-[.13em] text-[#91ad8d]">
                  A small route
                </span>
                <span className="h-px w-12 bg-[#d8ff68]/70" />
                <span className="font-['DM_Sans'] text-xs font-semibold text-[#dce9d7]">
                  Discover <span className="text-[#d8ff68]">→</span> Check in{" "}
                  <span className="text-[#d8ff68]">→</span> Remember
                </span>
              </div>
            </div>

            <div className="relative min-w-0">
              <div className="absolute -inset-4 rounded-[35%] bg-[#d8ff68]/10 blur-3xl" />
              <div className="relative mx-auto max-w-[510px] rotate-[1deg]">
                <AtlasImage
                  src={images.map}
                  alt="Met social map showing a sample city map and featured venues"
                  label="Map sheet 01 · nearby places"
                  className="relative z-10 mx-auto max-w-[440px]"
                  imageClassName="h-[360px] sm:h-[460px] lg:h-[640px]"
                />
                <div className="absolute -bottom-3 -left-4 z-20 flex max-w-[70%] items-center gap-3 rounded-[18px] border border-[#c9dcbd] bg-[#d8ff68] px-4 py-3 text-[#173b31] shadow-xl sm:-left-7 sm:px-5">
                  <Compass size={19} />
                  <div>
                    <p className="font-['Space_Mono'] text-[7px] font-bold uppercase tracking-[.12em]">
                      Your next place
                    </p>
                    <p className="font-['DM_Sans'] text-sm font-extrabold">
                      Somewhere to meet.
                    </p>
                  </div>
                </div>
              </div>
              <p className="relative z-10 mt-6 text-right font-['Space_Mono'] text-[7px] uppercase tracking-[.12em] text-[#91ad8d]">
                {sampleCaption}
              </p>
            </div>
          </div>
          <div className="relative border-t border-[#52715a]/60 bg-[#214b3d]">
            <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 font-['Space_Mono'] text-[8px] uppercase tracking-[.13em] text-[#b5ccaa] sm:px-8 lg:px-10">
              <span>01 / Notice the neighborhood</span>
              <span>02 / Find the hub</span>
              <span>03 / Leave a little richer</span>
            </div>
          </div>
        </section>

        <section
          id="field-guide"
          className="relative overflow-hidden py-16 sm:py-20 lg:py-24"
        >
          <div className="pointer-events-none absolute left-0 top-0 h-full w-[8px] bg-[#d8ff68]" />
          <div className="mx-auto max-w-[1280px] px-5 sm:px-8 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[.65fr_1.35fr] lg:items-end">
              <div>
                <Note>Field notes · 02 / the people in a place</Note>
                <h2 className="font-['DM_Sans'] text-[clamp(2.6rem,6vw,5.3rem)] font-black leading-[.88] tracking-[-.085em]">
                  A check-in is a{" "}
                  <span className="font-['Instrument_Serif'] font-normal italic text-[#e8765d]">
                    bookmark.
                  </span>
                </h2>
              </div>
              <p className="max-w-[580px] font-['DM_Sans'] text-base leading-relaxed text-[#5a7567]">
                Met helps you remember the places you’ve been and the people
                whose paths crossed yours. Nearby encounters can be found
                through Bluetooth; a social reveal is shared only by mutual
                consent.
              </p>
            </div>
            <div className="relative mt-10 grid gap-5 md:grid-cols-3">
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute left-[12%] top-7 hidden h-28 w-[76%] overflow-visible md:block"
                viewBox="0 0 800 100"
                fill="none"
              >
                <path
                  d="M8 54 C150 10 245 110 390 54 S640 2 792 55"
                  stroke="#78936f"
                  strokeWidth="2"
                  className="met-path-dash"
                />
              </svg>
              {[
                {
                  mark: "A",
                  icon: MapPin,
                  title: "Find a nearby place",
                  text: "Explore local venues on the social map.",
                },
                {
                  mark: "B",
                  icon: Radio,
                  title: "Notice who’s nearby",
                  text: "Bluetooth helps detect nearby Met users.",
                },
                {
                  mark: "C",
                  icon: HeartHandshake,
                  title: "Choose to reveal",
                  text: "Social details appear only when both people accept.",
                },
              ].map(({ mark, icon: Icon, title, text }, index) => (
                <article
                  key={mark}
                  className={`relative rounded-[26px] border border-[#dce3d5] p-5 sm:p-6 ${
                    index === 1
                      ? "mt-0 bg-[#e5f1d6] md:mt-10"
                      : "bg-[#fcfaf2]"
                  }`}
                >
                  <div className="mb-8 flex items-start justify-between">
                    <span className="font-['Instrument_Serif'] text-4xl italic text-[#e8765d]">
                      {mark}
                    </span>
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#173b31] text-[#d8ff68]">
                      <Icon size={18} />
                    </span>
                  </div>
                  <h3 className="font-['DM_Sans'] text-lg font-extrabold tracking-[-.04em]">
                    {title}
                  </h3>
                  <p className="mt-2 font-['DM_Sans'] text-sm leading-relaxed text-[#607968]">
                    {text}
                  </p>
                </article>
              ))}
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-[1.2fr_.8fr] sm:items-center">
              <AtlasImage
                src={images.encounters}
                alt="Illustrative Met screen for people whose paths crossed"
                label="Field note · crossed paths"
                className="mx-auto w-full max-w-[380px] sm:mx-0"
              />
              <div className="rounded-[24px] bg-[#f2eadb] p-5 sm:p-7">
                <Note>Keep what matters</Note>
                <h3 className="font-['DM_Sans'] text-2xl font-black leading-tight tracking-[-.06em]">
                  A city becomes familiar one encounter at a time.
                </h3>
                <p className="mt-3 font-['DM_Sans'] text-sm leading-relaxed text-[#607968]">
                  Review the places and people you’ve encountered. Your
                  visibility and profile controls remain yours to choose.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative bg-[#f0eadb] py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-[1280px] px-5 sm:px-8 lg:px-10">
            <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-[600px]">
                <Note>Gathered at the hub · 03</Note>
                <h2 className="font-['DM_Sans'] text-[clamp(2.7rem,6vw,5.3rem)] font-black leading-[.88] tracking-[-.085em]">
                  Some places leave{" "}
                  <span className="font-['Instrument_Serif'] font-normal italic text-[#e8765d]">
                    something behind.
                  </span>
                </h2>
              </div>
              <p className="max-w-[370px] font-['DM_Sans'] text-sm leading-relaxed text-[#5a7567]">
                Check in, find the community, and take part in the life of a Hub.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <article className="relative overflow-hidden rounded-[28px] bg-[#173b31] p-5 text-[#f8f4e9] sm:p-7">
                <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full border border-[#d8ff68]/25" />
                <div className="relative grid gap-6 sm:grid-cols-[.8fr_1.2fr] sm:items-center">
                  <AtlasImage
                    src={images.community}
                    alt="Illustrative Met Hub visitor community leaderboard"
                    label="Community ledger"
                    className="mx-auto w-full max-w-[235px] rotate-[-2deg]"
                  />
                  <div>
                    <Note light>
                      <Trophy size={12} /> Hub monthly leaderboard
                    </Note>
                    <h3 className="font-['DM_Sans'] text-3xl font-black leading-[.94] tracking-[-.07em]">
                      Earn your place on the podium.
                    </h3>
                    <p className="mt-4 font-['DM_Sans'] text-sm leading-relaxed text-[#c4d5bd]">
                      Trophies go to ranks 1, 2, and 3 on a Hub’s monthly
                      leaderboard.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#f2d888] px-3 py-2 font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.08em] text-[#59421e]">
                        1 · Gold
                      </span>
                      <span className="rounded-full bg-[#dce2df] px-3 py-2 font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.08em] text-[#485954]">
                        2 · Silver
                      </span>
                      <span className="rounded-full bg-[#e6b08b] px-3 py-2 font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.08em] text-[#5b3e2b]">
                        3 · Bronze
                      </span>
                    </div>
                    <p className="mt-4 flex items-start gap-2 font-['DM_Sans'] text-xs leading-relaxed text-[#c4d5bd]">
                      <ShieldCheck
                        size={15}
                        className="mt-0.5 shrink-0 text-[#d8ff68]"
                      />{" "}
                      Choose whether your trophy is public or private.
                    </p>
                  </div>
                </div>
              </article>

              <article className="grid gap-6 rounded-[28px] border border-[#eac0b0] bg-[#f9d4c9] p-5 sm:grid-cols-[.8fr_1.2fr] sm:items-center sm:p-7">
                <AtlasImage
                  src={images.venue}
                  alt="Illustrative Met venue profile showing the Guest Book tab"
                  label="Guest Book page"
                  className="mx-auto w-full max-w-[235px] rotate-[2deg]"
                />
                <div>
                  <Note>
                    <BookOpen size={12} /> The Guest Book
                  </Note>
                  <h3 className="font-['DM_Sans'] text-3xl font-black leading-[.94] tracking-[-.07em]">
                    A visit, in your own words.
                  </h3>
                  <p className="mt-4 font-['DM_Sans'] text-sm leading-relaxed text-[#52694f]">
                    Visitors can leave handwritten-style notes and photos from
                    real visits.
                  </p>
                  <p className="mt-4 border-t border-[#e6ac9b] pt-3 font-['DM_Sans'] text-xs leading-relaxed text-[#52694f]">
                    Entries don’t automatically expire. Authors can delete
                    their entries; moderation still applies.
                  </p>
                </div>
              </article>
            </div>
            <p className="mt-6 text-center font-['Space_Mono'] text-[8px] uppercase tracking-[.1em] text-[#708270]">
              {sampleCaption}
            </p>
          </div>
        </section>

        <section
          id="venues"
          className="relative overflow-hidden bg-[#d8ff68] py-16 sm:py-20 lg:py-24"
        >
          <div className="absolute inset-y-0 right-0 hidden w-[38%] border-l border-[#173b31]/10 met-paper-grid lg:block" />
          <div className="relative mx-auto grid max-w-[1280px] gap-8 px-5 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:items-center lg:px-10">
            <div>
              <Note>For the keeper of a place</Note>
              <h2 className="font-['DM_Sans'] text-[clamp(2.8rem,6vw,5.5rem)] font-black leading-[.88] tracking-[-.09em]">
                A local venue can become a{" "}
                <span className="font-['Instrument_Serif'] font-normal italic">
                  gathering point.
                </span>
              </h2>
              <p className="mt-5 max-w-[490px] font-['DM_Sans'] text-base leading-relaxed text-[#42603e]">
                Put your place on Met’s nearby map. Share events and
                announcements, welcome guest check-ins, and keep your details
                current after approval.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href={venueApplicationHref("venue_section")}
                  data-testid="link-venue-apply"
                  className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#173b31] px-5 py-3 font-['DM_Sans'] text-sm font-extrabold text-[#f8f4e9] transition-transform hover:-translate-y-0.5"
                >
                  Apply for free{" "}
                  <ArrowUpRight size={16} className="text-[#d8ff68]" />
                </a>
                <a
                  href="/venues"
                  data-testid="link-venue-details"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#879c73] px-5 py-3 font-['DM_Sans'] text-sm font-extrabold text-[#173b31] transition-colors hover:bg-[#e8ff9f]"
                >
                  Venue details <ArrowRight size={16} />
                </a>
              </div>
              <p className="mt-4 font-['Space_Mono'] text-[8px] uppercase tracking-[.12em] text-[#607750]">
                Free to apply · reviewed before approval
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[.9fr_1.1fr] sm:items-center">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[20px] bg-[#f8f4e9] p-4">
                  <CalendarDays size={18} className="mb-7 text-[#ef725a]" />
                  <p className="font-['Space_Mono'] text-[8px] uppercase tracking-[.12em] text-[#708270]">
                    Events
                  </p>
                  <p className="mt-2 font-['DM_Sans'] text-sm font-extrabold">
                    Share what’s coming.
                  </p>
                </div>
                <div className="mt-6 rounded-[20px] bg-[#f9d4c9] p-4">
                  <Megaphone size={18} className="mb-7 text-[#173b31]" />
                  <p className="font-['Space_Mono'] text-[8px] uppercase tracking-[.12em] text-[#708270]">
                    Updates
                  </p>
                  <p className="mt-2 font-['DM_Sans'] text-sm font-extrabold">
                    Keep guests in the loop.
                  </p>
                </div>
                <div className="rounded-[20px] bg-[#173b31] p-4 text-[#f8f4e9]">
                  <Gift size={18} className="mb-7 text-[#d8ff68]" />
                  <p className="font-['Space_Mono'] text-[8px] uppercase tracking-[.12em] text-[#a9c1a5]">
                    Rewards
                  </p>
                  <p className="mt-2 font-['DM_Sans'] text-sm font-extrabold">
                    Make return visits count.
                  </p>
                </div>
                <div className="mt-6 rounded-[20px] bg-[#f8f4e9] p-4">
                  <UsersRound size={18} className="mb-7 text-[#ef725a]" />
                  <p className="font-['Space_Mono'] text-[8px] uppercase tracking-[.12em] text-[#708270]">
                    Community
                  </p>
                  <p className="mt-2 font-['DM_Sans'] text-sm font-extrabold">
                    Find your regulars.
                  </p>
                </div>
              </div>
              <AtlasImage
                src={images.checkin}
                alt="Illustrative Met venue check-in screen with community rewards"
                label="Guest check-in"
                className="mx-auto w-full max-w-[290px] rotate-[2deg]"
              />
            </div>
          </div>
          <div className="relative mx-auto mt-10 max-w-[1280px] border-t border-[#173b31]/20 px-5 pt-4 sm:px-8 lg:px-10">
            <div className="flex flex-wrap items-start gap-x-8 gap-y-3 font-['DM_Sans'] text-xs text-[#52694f]">
              <span className="flex items-center gap-2">
                <Check size={14} /> Edit details after approval
              </span>
              <span className="flex items-center gap-2">
                <Check size={14} /> Update photos, hours, and contact
              </span>
              <span className="flex items-center gap-2">
                <Check size={14} /> Application reviewed by Met
              </span>
            </div>
          </div>
        </section>

        <section
          id="travel-guides"
          className="relative bg-[#f0eadb] py-16 sm:py-20 lg:py-24"
          aria-labelledby="travel-guides-title"
        >
          <div className="mx-auto max-w-[1280px] px-5 sm:px-8 lg:px-10">
            <div className="mb-9 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-[680px]">
                <Note>Met travel notes · around the world</Note>
                <h2
                  id="travel-guides-title"
                  className="font-['DM_Sans'] text-[clamp(2.7rem,6vw,5rem)] font-black leading-[.88] tracking-[-.085em]"
                >
                  Go somewhere.{" "}
                  <span className="font-['Instrument_Serif'] font-normal italic text-[#e8765d]">
                    Remember more.
                  </span>
                </h2>
              </div>
              <a
                href="/guides/"
                data-testid="link-home-all-travel-guides"
                className="group inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-[#9eae9c] px-4 py-2 font-['DM_Sans'] text-xs font-extrabold transition-colors hover:bg-[#fcfaf2] md:self-auto"
              >
                Browse all guides <ArrowRight size={15} />
              </a>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <article className="group overflow-hidden rounded-[24px] border border-[#dce3d5] bg-[#fcfaf2] transition-transform hover:-translate-y-1">
                <a href="/guides/sossusvlei/" data-testid="card-home-guide-sossusvlei" className="block">
                  <img
                    src="/images/travel-guides/sossusvlei.jpg"
                    alt="Red dunes rise above the open desert at Sossusvlei"
                    width={1280}
                    height={853}
                    loading="lazy"
                    className="h-[190px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="p-5">
                    <p className="font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.13em] text-[#607968]">
                      Namibia · desert
                    </p>
                    <h3 className="mt-2 font-['DM_Sans'] text-xl font-extrabold tracking-[-.05em]">
                      A first visit to Sossusvlei
                    </h3>
                    <p className="mt-2 font-['DM_Sans'] text-sm leading-relaxed text-[#607968]">
                      Plan for vast dunes, desert conditions, and the route through Sesriem.
                    </p>
                  </div>
                </a>
                <p className="border-t border-[#dce3d5] px-5 py-3 font-['DM_Sans'] text-[10px] leading-relaxed text-[#607968]">
                  Photo by{" "}
                  <a href="https://commons.wikimedia.org/wiki/File:2011-02-09_066.JPG" target="_blank" rel="noopener noreferrer" className="underline decoration-[#a9bba5] underline-offset-2">Anagoria</a>
                  {" · "}
                  <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer" className="underline decoration-[#a9bba5] underline-offset-2">CC BY 3.0</a>
                </p>
              </article>
              <article className="group overflow-hidden rounded-[24px] border border-[#dce3d5] bg-[#fcfaf2] transition-transform hover:-translate-y-1">
                <a href="/guides/alhambra/" data-testid="card-home-guide-alhambra" className="block">
                  <img
                    src="/images/travel-guides/alhambra.jpg"
                    alt="The Alhambra palace complex above Granada at dusk"
                    width={1280}
                    height={854}
                    loading="lazy"
                    className="h-[190px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="p-5">
                    <p className="font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.13em] text-[#607968]">
                      Granada · heritage
                    </p>
                    <h3 className="mt-2 font-['DM_Sans'] text-xl font-extrabold tracking-[-.05em]">
                      Plan your Alhambra visit
                    </h3>
                    <p className="mt-2 font-['DM_Sans'] text-sm leading-relaxed text-[#607968]">
                      Organize your time around the Nasrid Palaces entry slot.
                    </p>
                  </div>
                </a>
                <p className="border-t border-[#dce3d5] px-5 py-3 font-['DM_Sans'] text-[10px] leading-relaxed text-[#607968]">
                  Photo by{" "}
                  <a href="https://commons.wikimedia.org/wiki/File:Alhambra_palace_and_surrounding_area.jpg" target="_blank" rel="noopener noreferrer" className="underline decoration-[#a9bba5] underline-offset-2">Er Komandante</a>
                  {" · "}
                  <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="underline decoration-[#a9bba5] underline-offset-2">CC BY-SA 4.0</a>
                </p>
              </article>
              <article className="group overflow-hidden rounded-[24px] border border-[#dce3d5] bg-[#fcfaf2] transition-transform hover:-translate-y-1">
                <a href="/guides/kinkaku-ji/" data-testid="card-home-guide-kinkakuji" className="block">
                  <img
                    src="/images/travel-guides/kinkaku-ji.jpg"
                    alt="Kyoto’s Golden Pavilion reflected in a pond at Kinkaku-ji"
                    width={1280}
                    height={1920}
                    loading="lazy"
                    className="h-[190px] w-full object-cover object-[center_55%] transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="p-5">
                    <p className="font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[.13em] text-[#607968]">
                      Kyoto · temple
                    </p>
                    <h3 className="mt-2 font-['DM_Sans'] text-xl font-extrabold tracking-[-.05em]">
                      A thoughtful Kinkaku-ji visit
                    </h3>
                    <p className="mt-2 font-['DM_Sans'] text-sm leading-relaxed text-[#607968]">
                      Find the official access details and take time with the garden.
                    </p>
                  </div>
                </a>
                <p className="border-t border-[#dce3d5] px-5 py-3 font-['DM_Sans'] text-[10px] leading-relaxed text-[#607968]">
                  Photo by{" "}
                  <a href="https://commons.wikimedia.org/wiki/File:Golden_Pavilion_Kinkaku-ji_water_mirror_2024.jpg" target="_blank" rel="noopener noreferrer" className="underline decoration-[#a9bba5] underline-offset-2">Nacaru</a>
                  {" · "}
                  <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="underline decoration-[#a9bba5] underline-offset-2">CC BY-SA 4.0</a>
                </p>
              </article>
            </div>
            <p className="mt-5 font-['DM_Sans'] text-xs leading-relaxed text-[#607968]">
              Met check-in is available at participating places only. Check the app map before planning around a check-in.
            </p>
          </div>
        </section>

        <section id="questions" className="relative py-16 sm:py-20 lg:py-24">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-5 sm:px-8 lg:grid-cols-[.58fr_1.42fr] lg:px-10">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Note>Margin notes · questions</Note>
              <h2 className="font-['DM_Sans'] text-[clamp(2.7rem,5vw,4.8rem)] font-black leading-[.88] tracking-[-.085em]">
                Before you{" "}
                <span className="font-['Instrument_Serif'] font-normal italic text-[#e8765d]">
                  go.
                </span>
              </h2>
              <p className="mt-4 max-w-[300px] font-['DM_Sans'] text-sm leading-relaxed text-[#607968]">
                A few notes on how Met works for people and local venues.
              </p>
            </div>
            <FAQ />
          </div>
        </section>

        <section
          id="download"
          className="relative overflow-hidden bg-[#173b31] py-16 text-[#f8f4e9] sm:py-20 lg:py-24"
        >
          <div className="pointer-events-none absolute -right-28 -top-36 h-[440px] w-[440px] rounded-full border border-[#d8ff68]/20" />
          <div className="relative mx-auto grid max-w-[1280px] gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end lg:px-10">
            <div className="max-w-[700px]">
              <Note light>Take the city with you</Note>
              <h2 className="font-['DM_Sans'] text-[clamp(3rem,7vw,6rem)] font-black leading-[.86] tracking-[-.09em]">
                There’s more to meet{" "}
                <span className="font-['Instrument_Serif'] font-normal italic text-[#d8ff68]">
                  out there.
                </span>
              </h2>
              <p className="mt-5 max-w-[500px] font-['DM_Sans'] text-base leading-relaxed text-[#c4d5bd]">
                Explore places nearby, check in, and make room for a connection
                when it feels right.
              </p>
            </div>
            <div>
              <p className="mb-3 font-['Space_Mono'] text-[8px] uppercase tracking-[.14em] text-[#9db79a]">
                Available on iPhone and Android
              </p>
              <DownloadButtons location="guest_section" />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#102d26] py-9 text-[#c4d5bd]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-7 px-5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <div>
            <Mark light />
            <p className="mt-3 max-w-[280px] font-['DM_Sans'] text-xs leading-relaxed text-[#92ae91]">
              A city field guide for people and the places that bring them
              together.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3 font-['DM_Sans'] text-xs font-bold text-[#b3cab0]">
            <a href="#field-guide" className="hover:text-[#d8ff68]">
              The field guide
            </a>
            <a
              href="#venues"
              data-testid="link-footer-venues"
              className="hover:text-[#d8ff68]"
            >
              For venues
            </a>
            <a href="/guides/" data-testid="link-footer-travel-guides" className="hover:text-[#d8ff68]">
              Travel guides
            </a>
            <a
              href="/venues"
              data-testid="link-footer-venue-info"
              className="hover:text-[#d8ff68]"
            >
              Venue info
            </a>
            <a href="/privacy" className="hover:text-[#d8ff68]">
              Privacy
            </a>
            <a href="/support" className="hover:text-[#d8ff68]">
              Terms
            </a>
            <a
              href="#download"
              data-testid="link-footer-app"
              className="hover:text-[#d8ff68]"
            >
              Download Met
            </a>
            <a
              href="mailto:metapp.contact@gmail.com"
              data-testid="link-footer-contact"
              className="hover:text-[#d8ff68]"
            >
              Contact
            </a>
          </nav>
          <span className="font-['Space_Mono'] text-[8px] uppercase tracking-[.12em] text-[#718f77]">
            © {new Date().getFullYear()} Met
          </span>
        </div>
      </footer>
    </div>
  );
}
