import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { PhoneMockup } from '../PhoneMockup';
import { useLang } from '../LangContext';

export function Scene3() {
  const { t } = useLang();
  const s = t.scene3;
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
      initial={{ opacity: 0, filter: 'blur(16px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
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
        <div className="w-full h-full pt-8 px-3 flex flex-col" dir={t.dir}>
          <motion.div
            className="text-[7px] tracking-[0.2em] text-[var(--color-text-secondary)] font-semibold mb-4 flex justify-between"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <span>{s.encountersLabel}</span>
            <span className="text-[var(--color-accent)]">{s.nodes}</span>
          </motion.div>

          <div className="flex flex-col gap-2">
            {s.encounters.map((enc, i) => (
              <motion.div
                key={i}
                className="bg-[var(--color-bg-light)] rounded-xl p-3 flex items-center gap-3 tactical-border"
                initial={{ opacity: 0, x: -20 }}
                animate={phase >= i + 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                transition={{ duration: 0.45, type: 'spring', bounce: 0.35 }}
              >
                <div className="relative flex-shrink-0">
                  <div
                    className="w-10 h-10 rounded-full bg-[var(--color-bg-dark)] flex items-center justify-center text-[var(--color-accent)] font-bold text-xs"
                    style={{ border: '1.5px solid var(--color-accent)' }}
                  >
                    {enc.name.charAt(0)}
                  </div>
                  {i === 0 && (
                    <motion.div
                      className="absolute -top-0.5 -right-0.5 w-[10px] h-[10px] rounded-full bg-[#EF4444]"
                      style={{ border: '1.5px solid var(--color-bg-light)' }}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[var(--color-text-primary)] text-[11px]">{enc.name}</div>
                  <div className="text-[9px] text-[var(--color-text-secondary)] truncate">{enc.loc}</div>
                </div>
                <div className="text-[8px] text-[var(--color-text-muted)] font-mono flex-shrink-0">{enc.time}</div>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="mt-2 bg-[var(--color-bg-light)] rounded-xl p-3 tactical-border opacity-30 filter blur-[2px]"
            initial={{ opacity: 0 }}
            animate={phase >= 4 ? { opacity: 0.3 } : { opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-bg-dark)]" />
              <div className="flex-1">
                <div className="h-2 bg-[var(--color-text-muted)] rounded w-16 mb-2" />
                <div className="h-2 bg-[var(--color-text-muted)] rounded w-24" />
              </div>
            </div>
          </motion.div>
        </div>
      </PhoneMockup>
    </motion.div>
  );
}
