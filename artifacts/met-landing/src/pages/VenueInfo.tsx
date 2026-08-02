import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    q: "Is there any cost to list my venue?",
    a: "No. Becoming a Met partner venue is completely free. There are no setup fees, monthly subscriptions, or commission charges. We may introduce optional promoted placements in the future, but basic listing will always be free.",
  },
  {
    q: "How long does the approval process take?",
    a: "Our team manually reviews every application, typically within 2–4 business days. You'll receive an email as soon as a decision is made. If we need more information we'll reach out before rejecting the application.",
  },
  {
    q: "What proof of ownership is accepted?",
    a: "We accept a business licence, a recent utility or rates bill addressed to the venue, a lease agreement, or an official company registration document that shows the venue address. The document should be dated within the last 12 months and clearly show your name or business name.",
  },
  {
    q: "Can I update my venue details after going live?",
    a: "Yes. Once approved you'll have access to a venue manager portal where you can update your description, photos, opening hours, and contact details at any time. Changes go live on the app within a few minutes.",
  },
  {
    q: "How do I remove my venue from Met?",
    a: "You can request removal at any time by emailing metapp.contact@gmail.com with your venue name. We'll delist it within one business day. Your data is deleted from our systems within 30 days of the request.",
  },
  {
    q: "Does Met work for all types of venues?",
    a: "Met works best for social spaces — bars, cafés, restaurants, co-working spots, gyms, and event venues. We don't currently list private residences, adult-only venues, or businesses that aren't open to the general public.",
  },
];

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tight mb-4">
            Frequently asked questions
          </h2>
          <p className="text-lg text-gray-500 font-medium">
            Everything venue owners ask before applying.
          </p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <motion.div
                key={i}
                className="border border-gray-200 rounded-2xl overflow-hidden"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left bg-white hover:bg-green-50/50 transition-colors duration-200"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-semibold text-gray-900 leading-snug">
                    {faq.q}
                  </span>
                  <span
                    className={`shrink-0 w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 transition-transform duration-300 ${
                      isOpen ? "rotate-45 bg-green-50 border-green-200 text-green-600" : ""
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-gray-600 leading-relaxed text-sm border-t border-gray-100 pt-4">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          className="text-center text-sm text-gray-400 mt-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          Still have questions?{" "}
          <a href="mailto:metapp.contact@gmail.com" className="text-green-600 font-semibold hover:underline">
            Email us
          </a>{" "}
          and we'll get back to you within one business day.
        </motion.p>
      </div>
    </section>
  );
}

export default function VenueInfo() {
  return (
    <div className="min-h-screen bg-white overflow-hidden">

      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/70 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="text-xl font-black tracking-tighter text-gray-900">MET</a>
          <a
            href="/apply"
            className="bg-gray-900 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-green-600 transition-colors duration-300"
          >
            Apply now
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 bg-gradient-to-b from-green-50 to-white relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-green-200/40 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-[-5%] w-[400px] h-[400px] rounded-full bg-green-100/30 blur-[100px] pointer-events-none" />

        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 bg-green-100/80 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full mb-6 tracking-wider uppercase border border-green-200/50 shadow-sm">
              🏢 For venue owners
            </div>
            <h1 className="text-5xl lg:text-7xl font-black text-gray-900 leading-[1.05] tracking-tight mb-6">
              Put your venue on the{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-green-600">
                social map.
              </span>
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed mb-10 max-w-2xl mx-auto font-medium">
              Met is the app people use to connect with others nearby. When your venue becomes a Met partner, it shows up on the heatmap and hub discovery — right in front of your ideal crowd.
            </p>
            <a
              href="/apply"
              className="inline-block bg-gray-900 hover:bg-green-600 text-white px-10 py-4 rounded-full font-bold text-base shadow-xl shadow-gray-900/20 hover:scale-105 transition-all duration-300"
            >
              Apply to list your venue — it's free
            </a>
          </motion.div>
        </div>
      </section>

      {/* Benefits grid */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tight mb-4">
              What you get as a Met partner
            </h2>
            <p className="text-lg text-gray-500 font-medium">
              A free way to reach people who are already out and looking to connect — right in your neighbourhood.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                emoji: "📍",
                title: "Heatmap visibility",
                desc: "Your venue appears as a highlighted hotspot on the Met live heatmap. Users browsing nearby locations see your space at a glance before they even walk in.",
              },
              {
                emoji: "🧭",
                title: "Hub discovery",
                desc: "Met users can check in to your venue's hub, unlocking leaderboards and social features. This drives word-of-mouth and repeat visits from people who love meeting others.",
              },
              {
                emoji: "🎯",
                title: "The right crowd",
                desc: "Met's users are sociable, location-aware, and actively looking to meet people. They're exactly the kind of guests who turn a quiet Tuesday into a buzzing evening.",
              },
              {
                emoji: "📈",
                title: "Increased foot traffic",
                desc: "A verified partner badge builds trust. Met users are more likely to choose a partner venue when they're deciding where to go — your listing becomes a social destination.",
              },
              {
                emoji: "🆓",
                title: "Free to apply",
                desc: "There are no fees to become a Met partner venue. We review every application manually to keep the network quality high — apply once and we'll take it from there.",
              },
              {
                emoji: "🏅",
                title: "Verified partner badge",
                desc: "Approved venues display a gold verified badge in the app. It signals to Met users that your space is a trusted, active part of the Met social network.",
              },
            ].map((benefit, i) => (
              <motion.div
                key={i}
                className="bg-gray-50 border border-gray-100 rounded-3xl p-8 hover:bg-green-50/60 hover:border-green-100 transition-colors duration-300"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <div className="w-12 h-12 bg-white rounded-2xl border border-gray-100 flex items-center justify-center mb-6 shadow-sm text-2xl">
                  {benefit.emoji}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-gray-600 leading-relaxed text-sm">{benefit.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-green-50/50 border-y border-green-100/60">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tight mb-4">
              How the partnership works
            </h2>
            <p className="text-lg text-gray-500 font-medium">
              Getting listed takes a few minutes. Everything after that is automatic.
            </p>
          </motion.div>

          <div className="space-y-8">
            {[
              {
                step: "01",
                title: "Submit your application",
                desc: "Fill in your venue details, add a short description, and upload a proof-of-ownership document. The whole form takes under five minutes.",
              },
              {
                step: "02",
                title: "We review and approve",
                desc: "Our team manually checks every application — usually within a few business days. We'll email you as soon as you're approved.",
              },
              {
                step: "03",
                title: "Your venue goes live on Met",
                desc: "Once approved, your venue appears on the heatmap and in hub discovery. Met users nearby can check in, connect, and spread the word.",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="flex gap-6 items-start bg-white rounded-2xl border border-gray-100 px-8 py-6 shadow-sm"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="text-sm font-black text-green-500 bg-green-100/60 px-3 py-1 rounded-lg shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 mb-1">{item.title}</h4>
                  <p className="text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FAQSection />

      {/* CTA */}
      <section className="py-32 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="w-16 h-16 bg-green-100 rounded-2xl mx-auto flex items-center justify-center mb-8 shadow-sm">
              <span className="text-2xl">🏢</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 mb-4 tracking-tight">
              Ready to grow your venue?
            </h2>
            <p className="text-xl text-gray-600 mb-3 font-medium max-w-xl mx-auto">
              Join the Met partner network and connect with guests who are already at your door.
            </p>
            <p className="text-sm text-green-600 font-semibold mb-10">
              Free to apply · No subscription · Approved in days
            </p>
            <a
              href="/apply"
              className="inline-block bg-gray-900 hover:bg-green-600 text-white px-10 py-4 rounded-full font-bold text-base shadow-xl shadow-gray-900/20 hover:scale-105 transition-all duration-300"
            >
              List your venue →
            </a>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <a href="/" className="text-xl font-black tracking-tighter text-gray-900">MET</a>
          <div className="flex gap-6 text-sm font-medium text-gray-500">
            <a href="/privacy" className="hover:text-green-600 transition-colors">Privacy</a>
            <a href="/support" className="hover:text-green-600 transition-colors">Terms</a>
            <a href="/apply" className="hover:text-green-600 transition-colors">Apply to list</a>
            <a href="mailto:metapp.contact@gmail.com" className="hover:text-green-600 transition-colors">Contact</a>
          </div>
          <div className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Met App. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}
