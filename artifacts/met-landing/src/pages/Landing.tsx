import React from 'react';
import { motion } from 'framer-motion';
import { HeroPhone } from '../components/HeroPhone';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background overflow-hidden selection:bg-primary/20 selection:text-primary-foreground">
      
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/60 backdrop-blur-md border-b border-white/20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="text-xl font-black tracking-tighter text-gray-900">MET</div>
          <a href="#download" className="bg-gray-900 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-green-600 transition-colors duration-300">
            Get the App
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 bg-hero-gradient overflow-hidden">
        {/* Abstract background shapes */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none opacity-40">
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-green-200/50 blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-white/80 blur-[100px]" />
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          
          {/* Hero Copy */}
          <motion.div 
            className="flex-1 text-center lg:text-left"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 bg-green-100/80 backdrop-blur-sm text-green-700 text-xs font-bold px-3 py-1.5 rounded-full mb-6 tracking-wider uppercase border border-green-200/50 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live nearby
            </div>
            <h1 className="text-5xl lg:text-7xl font-black text-gray-900 leading-[1.05] tracking-tight mb-6">
              Meet the people you keep <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-green-600">passing by.</span>
            </h1>
            <p className="text-lg lg:text-xl text-gray-600 leading-relaxed mb-10 max-w-xl mx-auto lg:mx-0 font-medium">
              No swiping. No algorithms. Met uses Bluetooth to quietly connect you with the people sharing your spaces.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <a href="#download" className="w-full sm:w-auto bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-full font-bold text-base shadow-xl shadow-gray-900/20 hover:scale-105 transition-all duration-300 text-center">
                Download Met — Free
              </a>
              <span className="text-sm font-medium text-gray-500">Available on iOS & Android</span>
            </div>
          </motion.div>

          {/* Hero Phone Mockup */}
          <motion.div 
            className="flex-1 w-full max-w-[320px] lg:max-w-none flex justify-center"
            initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          >
            <HeroPhone />
          </motion.div>

        </div>
      </section>

      {/* Social Proof / How it feels */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tight mb-6">
              The missed connections end here.
            </h2>
            <p className="text-lg text-gray-600 font-medium">
              You see them at the coffee shop every Tuesday. You read the same books on the train. Now, you have a way to break the ice without the awkwardness.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Passive Detection",
                desc: "Keep your phone in your pocket. Met silently detects other users nearby using low-energy Bluetooth."
              },
              {
                title: "Mutual Interest",
                desc: "Send a discrete signal. They only know you're interested if they signal back. Total privacy, zero rejection."
              },
              {
                title: "Real Interactions",
                desc: "No distant pen-pals. You only match with people who are physically in the same room as you right now."
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                className="bg-green-50/50 border border-green-100 rounded-3xl p-8 hover:bg-green-50 transition-colors duration-300"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="w-12 h-12 bg-white rounded-2xl border border-green-100 flex items-center justify-center mb-6 shadow-sm">
                  <div className="w-4 h-4 bg-green-500 rounded-full" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section className="py-24 bg-gray-50 border-y border-gray-100 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16">
          <motion.div 
            className="flex-1"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <div className="rounded-[32px] overflow-hidden relative shadow-xl shadow-green-900/5 rotate-[-2deg]">
              <img 
                src="/park-app.png" 
                alt="Using Met in a park" 
                className="w-full aspect-[3/4] object-cover"
                onError={(e) => {
                  e.currentTarget.src = "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=1949&auto=format&fit=crop";
                }}
              />
              <div className="absolute inset-0 bg-green-900/10 mix-blend-overlay" />
            </div>
          </motion.div>

          <motion.div 
            className="flex-1"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tight mb-12">
              Serendipity, engineered.
            </h2>

            <div className="space-y-8">
              {[
                { step: "01", title: "Walk into a room", desc: "Your phone privately registers other Met users in your immediate vicinity." },
                { step: "02", title: "See someone interesting?", desc: "Open the app and anonymously express interest in their profile." },
                { step: "03", title: "The mutual reveal", desc: "If they're also interested, your profiles unlock. The rest is up to you." }
              ].map((item, i) => (
                <div key={i} className="flex gap-6 items-start">
                  <div className="text-sm font-black text-green-500 bg-green-100/50 px-3 py-1 rounded-lg">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900 mb-1">{item.title}</h4>
                    <p className="text-gray-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Story / Testimonial */}
      <section className="py-32 bg-white text-center">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="text-green-500 mb-8">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
                <path d="M10 11H6C5.44772 11 5 10.5523 5 10V6C5 5.44772 5.44772 5 6 5H10C10.5523 5 11 5.44772 11 6V10C11 10.5523 10.5523 11 10 11ZM20 11H16C15.4477 11 15 10.5523 15 10V6C15 5.44772 15.4477 5 16 5H20C20.5523 5 21 5.44772 21 6V10C21 10.5523 20.5523 11 20 11ZM10 14H6V19H10V14ZM20 14H16V19H20V14Z" fill="currentColor"/>
              </svg>
            </div>
            <h3 className="text-2xl lg:text-4xl font-medium text-gray-900 leading-relaxed mb-10 tracking-tight">
              "We rode the same bus for a year. I noticed him, he noticed me, but neither of us said anything. Met finally gave us an excuse to say hello."
            </h3>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
                <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=100&auto=format&fit=crop" alt="User" className="w-full h-full object-cover" />
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900">Sarah & James</div>
                <div className="text-sm text-gray-500">Connected in Brooklyn, NY</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Lifestyle Image Section */}
      <section className="py-12 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="rounded-[40px] overflow-hidden relative shadow-2xl shadow-green-900/10">
            <div className="absolute inset-0 bg-gray-900/20 z-10 mix-blend-multiply" />
            <img 
              src="/coffee-shop.png" 
              alt="Two people meeting in a coffee shop" 
              className="w-full h-[600px] object-cover"
              onError={(e) => {
                e.currentTarget.src = "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop";
              }}
            />
            <div className="absolute inset-0 z-20 flex flex-col justify-end p-10 lg:p-16 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="max-w-2xl"
              >
                <h2 className="text-3xl lg:text-5xl font-black text-white leading-tight mb-4 tracking-tight">
                  Stop wondering "what if?"
                </h2>
                <p className="text-lg text-white/80 font-medium">
                  Real life happens offline. We just give you the spark to start the conversation.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="download" className="py-32 bg-hero-gradient relative overflow-hidden">
        <div className="absolute inset-0 bg-white/40 backdrop-blur-3xl" />
        
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="w-20 h-20 bg-white rounded-3xl mx-auto shadow-xl shadow-green-900/10 flex items-center justify-center mb-8 border border-green-50">
              <span className="text-2xl font-black text-gray-900 tracking-tighter">MET</span>
            </div>
            
            <h2 className="text-4xl lg:text-6xl font-black text-gray-900 mb-6 tracking-tight">
              Ready to meet?
            </h2>
            <p className="text-xl text-gray-600 mb-10 font-medium max-w-xl mx-auto">
              Join thousands of people discovering the connections hiding in plain sight.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://apps.apple.com/app/id6743545199"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-full font-bold text-base shadow-2xl shadow-gray-900/20 hover:scale-105 transition-all duration-300"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                App Store
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=app.met.founders"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-full font-bold text-base shadow-2xl shadow-gray-900/20 hover:scale-105 transition-all duration-300"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.76c.3.17.64.22.98.15l12.38-7.14-2.76-2.77-10.6 9.76zm-1.51-20.1C1.44 3.96 1.5 4.2 1.5 4.45v15.1c0 .25-.06.49.17.79l.09.08 8.46-8.46v-.2L1.67 3.58l-.01.08zm18.07 8.23-2.7-1.56-3.03 3.03 3.03 3.03 2.72-1.57c.78-.45.78-1.48-.02-1.93zM4.16.3L16.54 7.43l-2.76 2.76L3.18.43C3.48.27 3.86.3 4.16.3z"/></svg>
                Google Play
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-xl font-black tracking-tighter text-gray-900">MET</div>
          <div className="flex gap-6 text-sm font-medium text-gray-500">
            <a href="/privacy" className="hover:text-green-600 transition-colors">Privacy</a>
            <a href="/support" className="hover:text-green-600 transition-colors">Terms</a>
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
