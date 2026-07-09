import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { PhoneMockup } from '../PhoneMockup';
import { useLang } from '../LangContext';

const SOCIAL_ICONS = ['📷', '🎵', '𝕏', '💼'];

export function Scene7() {
  const { t } = useLang();
  const s = t.scene7;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 500),
      setTimeout(() => setPhase(3), 850),
      setTimeout(() => setPhase(4), 1200),
      setTimeout(() => setPhase(5), 1600),
      setTimeout(() => setPhase(6), 2400),
    ];
    return () => timers.forEach(c => clearTimeout(c));
  }, []);

  const socialLabels = ['Instagram', 'TikTok', 'X', 'LinkedIn'];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6"
      dir={t.dir}
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 100%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 100%)' }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 0.95 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
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
            {s.profileLabel}
          </motion.div>

          <motion.div
            className="flex items-center gap-3 mb-5"
            initial={{ opacity: 0, x: -15 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -15 }}
            transition={{ duration: 0.5 }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black text-[var(--color-primary)]"
              style={{ background: 'linear-gradient(135deg, #3AE06A, #22c55e)' }}
            >
              {s.userName.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-[var(--color-text-primary)] text-sm">{s.userName}</div>
              <div className="text-[9px] text-[var(--color-text-secondary)]">{s.userBio}</div>
            </div>
          </motion.div>

          <div className="text-[8px] text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">{s.socialsLabel}</div>
          <div className="flex flex-col gap-2">
            {socialLabels.map((label, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-xl tactical-border"
                style={{ background: 'var(--color-bg-light)' }}
                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                animate={phase >= i + 2 ? { opacity: 1, scale: 1, x: 0 } : { opacity: 0, scale: 0.8, x: -10 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              >
                <span className="text-sm">{SOCIAL_ICONS[i]}</span>
                <span className="text-[10px] font-semibold text-[var(--color-text-primary)] flex-1">{label}</span>
                <span className="text-[9px] text-[var(--color-accent)]">@yourname</span>
                <motion.div
                  className="w-4 h-4 rounded-full bg-[var(--color-accent)] flex items-center justify-center"
                  animate={phase >= i + 2 ? { scale: [0, 1.3, 1] } : { scale: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <svg className="w-2.5 h-2.5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              </motion.div>
            ))}
          </div>

          {phase >= 6 && (
            <motion.div
              className="mt-3 w-full py-2 rounded-xl text-center text-[10px] font-bold text-[var(--color-primary)]"
              style={{ background: 'var(--color-accent)', boxShadow: '0 0 16px rgba(58,224,106,0.5)' }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: [0.85, 1.05, 1] }}
              transition={{ duration: 0.5, type: 'spring' }}
            >
              {s.confirmed}
            </motion.div>
          )}
        </div>
      </PhoneMockup>
    </motion.div>
  );
}
