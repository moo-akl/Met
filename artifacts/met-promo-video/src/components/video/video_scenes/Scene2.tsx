import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { PhoneMockup } from '../PhoneMockup';
import { useLang } from '../LangContext';

export function Scene2() {
  const { t } = useLang();
  const s = t.scene2;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 700),
      setTimeout(() => setPhase(3), 1300),
      setTimeout(() => setPhase(4), 1900),
    ];
    return () => timers.forEach(c => clearTimeout(c));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6"
      dir={t.dir}
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, scale: 0.92, filter: 'blur(10px)' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
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
          initial={{ opacity: 0, y: 15 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {s.headline}{' '}
          <span className="text-[var(--color-accent)] drop-shadow-[0_0_10px_rgba(58,224,106,0.4)]">{s.headlineAccent}</span>
        </motion.h2>
      </div>

      <PhoneMockup>
        <div className="w-full h-full pt-8 px-4 flex flex-col" dir={t.dir}>
          <motion.div
            className="text-[8px] tracking-[0.2em] text-[var(--color-accent)] font-semibold mb-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {s.radarLabel}
          </motion.div>

          <div className="relative w-full aspect-square rounded-full border border-[var(--color-accent)]/20 mb-4 flex items-center justify-center">
            <div className="absolute w-[67%] h-[67%] rounded-full border border-[var(--color-accent)]/15" />
            <div className="absolute w-[34%] h-[34%] rounded-full border border-[var(--color-accent)]/20" />
            <div className="absolute w-full h-[1px] bg-[var(--color-accent)]/15" />
            <div className="absolute h-full w-[1px] bg-[var(--color-accent)]/15" />
            <motion.div
              className="absolute top-1/2 left-1/2 w-1/2 h-[1.5px] bg-gradient-to-r from-transparent to-[var(--color-accent)] origin-left"
              animate={{ rotate: 360 }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute top-1/2 left-1/2 w-1/2 h-1/2 origin-top-left"
              style={{ background: 'conic-gradient(from 0deg at 0% 0%, transparent 0deg, rgba(58,224,106,0.15) 90deg, transparent 90deg)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
            />
            {phase >= 2 && (
              <motion.div className="absolute w-[7px] h-[7px] rounded-full bg-[var(--color-accent)] top-[22%] left-[28%]"
                style={{ boxShadow: '0 0 8px var(--color-accent)' }}
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.6, 1], opacity: [0, 1, 0.85] }} transition={{ duration: 0.5 }}>
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[7px] text-[var(--color-text-primary)] font-bold whitespace-nowrap">JK</div>
              </motion.div>
            )}
            {phase >= 3 && (
              <motion.div className="absolute w-[7px] h-[7px] rounded-full bg-[var(--color-accent)] bottom-[28%] right-[22%]"
                style={{ boxShadow: '0 0 8px var(--color-accent)' }}
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.6, 1], opacity: [0, 1, 0.85] }} transition={{ duration: 0.5 }}>
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[7px] text-[var(--color-text-primary)] font-bold whitespace-nowrap">AM</div>
              </motion.div>
            )}
            {phase >= 4 && (
              <motion.div className="absolute w-[6px] h-[6px] rounded-full bg-[var(--color-accent)] top-[55%] left-[60%]"
                style={{ boxShadow: '0 0 6px var(--color-accent)' }}
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0.75] }} transition={{ duration: 0.4 }}>
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[7px] text-[var(--color-text-primary)] font-bold whitespace-nowrap">RL</div>
              </motion.div>
            )}
            <motion.div className="absolute w-3 h-3 rounded-full bg-[var(--color-accent)]"
              style={{ boxShadow: '0 0 12px var(--color-accent)' }}
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: s.nearby, val: '3' },
              { label: s.connections, val: '12' },
              { label: s.pending, val: '2', accent: true },
            ].map((stat, i) => (
              <motion.div key={i}
                className="bg-[var(--color-bg-light)] rounded-xl p-2 text-center tactical-border"
                initial={{ opacity: 0, y: 12 }}
                animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}>
                <div className="text-[7px] text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">{stat.label}</div>
                <div className={`text-base font-bold ${stat.accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>{stat.val}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </PhoneMockup>

      <motion.div className="flex items-center gap-2"
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4 }}>
        <motion.div className="w-2 h-2 rounded-full bg-[#EF4444]"
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }} />
        <span className="text-[9px] tracking-[0.18em] text-[var(--color-text-secondary)] font-semibold uppercase">{s.liveScan}</span>
      </motion.div>
    </motion.div>
  );
}
