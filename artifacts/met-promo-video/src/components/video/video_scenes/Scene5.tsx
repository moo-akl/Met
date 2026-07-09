import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { PhoneMockup } from '../PhoneMockup';
import { useLang } from '../LangContext';

export function Scene5() {
  const { t } = useLang();
  const s = t.scene5;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 900),
      setTimeout(() => setPhase(4), 1200),
    ];
    return () => timers.forEach(c => clearTimeout(c));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6"
      dir={t.dir}
      initial={{ opacity: 0, clipPath: 'polygon(50% 0, 50% 0, 50% 100%, 50% 100%)' }}
      animate={{ opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
      exit={{ opacity: 0, x: 60, filter: 'blur(10px)' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="text-center">
        <motion.div
          className="text-[9px] tracking-[0.22em] text-[var(--color-accent)] font-semibold uppercase mb-2"
          initial={{ opacity: 0, y: -10 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
        >
          {s.section}
        </motion.div>
        <motion.h2
          className="text-[26px] font-black tracking-tight text-[var(--color-text-primary)] leading-tight"
          initial={{ opacity: 0, y: 12 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {s.headline}{' '}
          <span className="text-[var(--color-accent)] drop-shadow-[0_0_10px_rgba(58,224,106,0.4)]">{s.headlineAccent}</span>
        </motion.h2>
      </div>

      <PhoneMockup>
        <div className="w-full h-full pt-8 px-4 flex flex-col" dir={t.dir}>
          <motion.div
            className="text-[7px] tracking-[0.2em] text-[var(--color-text-secondary)] font-semibold mb-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {s.connectionsLabel}
          </motion.div>

          <motion.div
            className="w-full bg-[var(--color-bg-light)] border border-[var(--color-text-muted)]/30 rounded-lg p-2 mb-4 flex items-center gap-2"
            initial={{ opacity: 0, y: -8 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
          >
            <svg className="w-3 h-3 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-[9px] text-[var(--color-text-secondary)]">{s.searchPlaceholder}</span>
          </motion.div>

          <div className="flex flex-col gap-3">
            {s.chats.map((chat, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: 18 }}
                animate={phase >= i + 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 18 }}
                transition={{ duration: 0.45, type: 'spring', bounce: 0.35 }}
              >
                <div className="relative flex-shrink-0">
                  <div
                    className="w-11 h-11 rounded-full bg-[var(--color-bg-light)] flex items-center justify-center text-[var(--color-text-primary)] font-bold text-sm"
                    style={{ border: '1.5px solid rgba(58,224,106,0.25)' }}
                  >
                    {chat.name.charAt(0)}
                  </div>
                  {i === 0 && (
                    <div
                      className="absolute top-0 right-0 w-3 h-3 rounded-full bg-[var(--color-accent)]"
                      style={{ border: '1.5px solid var(--color-bg-dark)', boxShadow: '0 0 6px var(--color-accent)' }}
                    />
                  )}
                </div>
                <div className="flex-1 pb-3" style={{ borderBottom: '1px solid rgba(210,235,213,0.12)' }}>
                  <div className="flex justify-between items-baseline mb-[3px]">
                    <div className="font-bold text-[var(--color-text-primary)] text-[11px]">{chat.name}</div>
                    <div className={`text-[8px] font-mono ${i === 0 ? 'text-[var(--color-accent)] font-bold' : 'text-[var(--color-text-muted)]'}`}>
                      {chat.time}
                    </div>
                  </div>
                  <div className={`text-[9px] truncate ${i === 0 ? 'text-[var(--color-text-primary)] font-semibold' : 'text-[var(--color-text-secondary)]'}`}>
                    {chat.msg}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </PhoneMockup>
    </motion.div>
  );
}
