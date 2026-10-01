import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, ChevronDown, ExternalLink, MapPin } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

declare global {
  interface Window {
    ttq?: { track: (event: string, params?: Record<string, unknown>) => void; page: () => void };
  }
}

function trackDownload(store: "android" | "ios", location: string) {
  window.ttq?.track("ClickButton", {
    content_id: `app_download_${store}`,
    content_name: `Download Met — ${store === "android" ? "Google Play" : "App Store"}`,
    content_category: "app_download",
    description: location,
  });
}

const APP_STORE_URL =
  "https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926";
const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=app.met.founders";

export const reveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: "easeOut" } },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

export function Mark({ light = false }: { light?: boolean }) {
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

export function ArrowButton({
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

export function Label({ children, light = false }: { children: ReactNode; light?: boolean }) {
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

export function DownloadButtons({ compact = false, location }: { compact?: boolean; location: string }) {
  return (
    <div className={`flex flex-col gap-2 ${compact ? "sm:flex-row" : "sm:flex-row"}`}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noreferrer"
        data-testid="link-download-app-store"
        onClick={() => trackDownload("ios", location)}
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
        onClick={() => trackDownload("android", location)}
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

export function LiveMapCard() {
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
          <p className="font-['Space_Mono'] text-[9px] uppercase tracking-[0.18em] text-[#d8ff68]">Example discovery view</p>
          <p className="mt-1 font-['DM_Sans'] text-sm font-bold text-[#f8f4e9]">Your neighborhood</p>
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
            <span className="font-['DM_Sans'] text-xs font-medium text-[#dce9d7]">Guests can check in at a hub</span>
          </div>
          <ArrowRight size={16} className="text-[#d8ff68]" />
        </div>
      </div>
    </div>
  );
}

export function BenefitCard({
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

export function FAQ() {
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
