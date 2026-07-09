import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { PhoneMockup } from '../PhoneMockup';
import { useLang } from '../LangContext';

const NETWORK_EMOJIS = ['🎓', '💼', '👥', '🏠'];
const NETWORK_COLORS = [
  'rgba(58,224,106,0.12)',
  'rgba(58,224,106,0.08)',
  'rgba(58,224,106,0.12)',
  'rgba(58,224,106,0.08)',
];

export function Scene8() {
  const { t } = useLang();
  const s = t.scene8;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 500),
      setTimeout(() => setPhase(3), 800),
      setTimeout(() => setPhase(4), 1100),
      setTimeout(() => setPhase(5), 1400),
    ];
    return () => timers.forEach(c => clearTimeout(c));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6"
      dir={t.dir}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -60, filter: 'blur(10px)' }}
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
            className="text-[7px] tracking-[0.2em] text-[var(--color-text-secondary)] font-semibold mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {s.networksLabel}
          </motion.div>

          <div className="grid grid-cols-2 gap-2">
            {s.networks.map((net, i) => (
              <motion.div
                key={i}
                className="rounded-xl p-3 flex flex-col gap-1 tactical-border"
                style={{ background: NETWORK_COLORS[i] }}
                initial={{ opacity: 0, scale: 0.75, y: 15 }}
                animate={phase >= i + 1 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.75, y: 15 }}
                transition={{ type: 'spring', stiffness: 340, damping: 22 }}
              >
                <div className="text-xl mb-1">{NETWORK_EMOJIS[i]}</div>
                <div className="font-bold text-[var(--color-text-primary)] text-[11px]">{net.label}</div>
                <div className="text-[8px] text-[var(--color-text-secondary)]">{net.members}</div>
                <div className="flex items-center gap-1 mt-1">
                  <svg className="w-[8px] h-[8px] text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-[7px] text-[var(--color-accent)] font-semibold tracking-wide">{s.privateLabel}</span>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl tactical-border bg-[var(--color-bg-light)]"
            initial={{ opacity: 0, y: 10 }}
            animate={phase >= 5 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.5 }}
          >
            <svg className="w-3 h-3 text-[var(--color-accent)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-[8px] text-[var(--color-text-secondary)] leading-tight">{s.note}</span>
          </motion.div>
        </div>
      </PhoneMockup>
    </motion.div>
  );
}
