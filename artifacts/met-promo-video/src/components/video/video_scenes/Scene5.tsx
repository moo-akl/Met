import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { PhoneMockup } from '../PhoneMockup';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1100),
      setTimeout(() => setPhase(4), 1400),
      setTimeout(() => setPhase(5), 4800), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const chats = [
    { name: 'Sarah J.', msg: 'Hey! Nice meeting you earlier.', time: '2m', unread: true },
    { name: 'Alex L.', msg: 'Are you going to that tech meetup?', time: '1h', unread: false },
    { name: 'David M.', msg: 'Cool jacket btw ✌️', time: '3h', unread: false },
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, clipPath: 'polygon(50% 0, 50% 0, 50% 100%, 50% 100%)' }}
      animate={{ opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
      exit={{ opacity: 0, x: 100, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-row items-center w-full max-w-6xl gap-16 px-12">
        {/* Phone Side */}
        <div className="flex-1 flex justify-center perspective-1000">
          <PhoneMockup>
            <div className="w-full h-full pt-16 px-6 flex flex-col bg-[var(--color-bg-dark)]">
              <motion.div 
                className="text-[10px] tracking-[0.2em] text-[var(--color-text-secondary)] font-semibold mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                // CONNECTIONS
              </motion.div>

              <motion.div 
                className="w-full bg-[var(--color-bg-light)] border border-[var(--color-text-muted)] rounded-lg p-3 mb-6 flex items-center gap-2"
                initial={{ opacity: 0, y: -10 }}
                animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
              >
                <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-[var(--color-text-secondary)] text-sm">Search</span>
              </motion.div>

              <div className="flex flex-col gap-4">
                {chats.map((chat, i) => (
                  <motion.div 
                    key={i}
                    className="flex items-center gap-4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={phase >= i + 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                    transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}
                  >
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full bg-[var(--color-bg-light)] border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-text-primary)] font-bold text-lg">
                        {chat.name.charAt(0)}
                      </div>
                      {chat.unread && (
                        <div className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-[var(--color-accent)] border-2 border-[var(--color-bg-dark)] shadow-[0_0_8px_var(--color-accent)]" />
                      )}
                    </div>
                    <div className="flex-1 pb-4 border-b border-[var(--color-text-muted)]/30">
                      <div className="flex justify-between items-baseline mb-1">
                        <div className="font-bold text-[var(--color-text-primary)] text-base">{chat.name}</div>
                        <div className={`text-[11px] font-mono ${chat.unread ? 'text-[var(--color-accent)] font-bold' : 'text-[var(--color-text-muted)]'}`}>
                          {chat.time}
                        </div>
                      </div>
                      <div className={`text-sm truncate ${chat.unread ? 'text-[var(--color-text-primary)] font-semibold' : 'text-[var(--color-text-secondary)]'}`}>
                        {chat.msg}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

            </div>
          </PhoneMockup>
        </div>

        {/* Text Side */}
        <div className="flex-1">
          <motion.h2 
            className="text-[4.5vw] font-bold leading-[1.1] tracking-tight text-[var(--color-text-primary)]"
            initial={{ opacity: 0, x: -30 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            Turn encounters <br/>
            <span className="text-[var(--color-accent)] drop-shadow-[0_0_15px_rgba(58,224,106,0.3)]">into connections.</span>
          </motion.h2>
        </div>
      </div>
    </motion.div>
  );
}
