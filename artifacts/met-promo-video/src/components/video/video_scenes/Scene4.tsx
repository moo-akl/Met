import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { PhoneMockup } from '../PhoneMockup';
import { useLang } from '../LangContext';

export function Scene4() {
  const { t } = useLang();
  const s = t.scene4;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => timers.forEach(c => clearTimeout(c));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6"
      dir={t.dir}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: 80, filter: 'blur(10px)' }}
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
        <div className="w-full h-full bg-[var(--color-bg-dark)] relative flex flex-col justify-end" dir={t.dir}>
          <div className="absolute inset-0 p-4 pt-10 opacity-25 pointer-events-none filter blur-[2px]">
            <div className="w-full h-14 bg-[var(--color-bg-light)] rounded-xl mb-3" />
            <div className="w-full h-14 bg-[var(--color-bg-light)] rounded-xl mb-3" />
            <div className="w-full h-14 bg-[var(--color-bg-light)] rounded-xl" />
          </div>

          <motion.div
            className="absolute inset-0 bg-black/65"
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5 }}
          />

          <motion.div
            className="relative bg-[var(--color-bg-light)] rounded-t-3xl border-t border-[var(--color-accent)]/20 p-5 pb-10 w-full"
            style={{ boxShadow: '0 -10px 40px rgba(0,0,0,0.5)' }}
            initial={{ y: '100%' }}
            animate={phase >= 2 ? { y: 0 } : { y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 200 }}
          >
            <div className="w-10 h-[3px] bg-[var(--color-text-muted)] rounded-full mx-auto mb-5" />

            <div className="flex flex-col items-center mb-5">
              <div
                className="w-20 h-20 rounded-full bg-[var(--color-bg-dark)] flex items-center justify-center mb-3"
                style={{ border: '1px solid rgba(58,224,106,0.25)', filter: 'blur(3px)' }}
              >
                <span className="text-[var(--color-text-muted)] text-2xl font-bold" style={{ filter: 'blur(0px)' }}>?</span>
              </div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">{s.modalTitle}</h3>
              <p className="text-[10px] text-[var(--color-text-secondary)] text-center leading-relaxed">
                {s.modalBody.split('\n').map((line, i) => (
                  <span key={i}>{line}{i === 0 ? <br /> : null}</span>
                ))}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <motion.div
                className="w-full py-3 rounded-xl bg-[var(--color-accent)] text-[var(--color-primary)] font-bold text-sm text-center relative overflow-hidden"
                style={{ boxShadow: '0 0 12px rgba(58,224,106,0.3)' }}
                animate={phase >= 3 ? { scale: [1, 1.04, 1] } : {}}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                {s.accept}
                {phase >= 3 && (
                  <motion.div
                    className="absolute inset-0 bg-white/25"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                  />
                )}
              </motion.div>
              <div className="w-full py-3 rounded-xl text-center text-[var(--color-text-secondary)] text-sm font-semibold"
                style={{ border: '1px solid rgba(210,235,213,0.2)' }}>
                {s.notNow}
              </div>
            </div>
          </motion.div>
        </div>
      </PhoneMockup>
    </motion.div>
  );
}
