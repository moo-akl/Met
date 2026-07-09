import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useLang } from '../LangContext';

export function Scene6() {
  const { t } = useLang();
  const s = t.scene6;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1300),
      setTimeout(() => setPhase(3), 2200),
    ];
    return () => timers.forEach(c => clearTimeout(c));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-dark)]"
      dir={t.dir}
      initial={{ opacity: 0, scale: 1.15 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="absolute w-[70%] h-[70%] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(58,224,106,0.12), transparent)' }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="w-24 h-24 rounded-3xl flex items-center justify-center text-[40px] font-black text-[var(--color-primary)] mb-7 relative"
        style={{ background: 'linear-gradient(135deg, #3AE06A 0%, #22c55e 100%)', boxShadow: '0 0 60px rgba(58,224,106,0.35), 0 8px 32px rgba(0,0,0,0.4)' }}
        initial={{ scale: 0, rotate: -30 }}
        animate={phase >= 1 ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -30 }}
        transition={{ duration: 0.9, type: 'spring', bounce: 0.45 }}
      >
        M.
        <motion.div
          className="absolute inset-0 rounded-3xl border-2 border-[var(--color-accent)]"
          animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
      </motion.div>

      <div className="overflow-hidden mb-3">
        <motion.h1
          className="text-[44px] font-black tracking-tighter text-[var(--color-accent)] leading-none"
          style={{ textShadow: '0 0 30px rgba(58,224,106,0.4)' }}
          initial={{ y: '110%' }}
          animate={phase >= 2 ? { y: '0%' } : { y: '110%' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          Met.
        </motion.h1>
      </div>

      <motion.p
        className="text-[16px] text-[var(--color-text-primary)] font-bold tracking-wide"
        initial={{ opacity: 0, y: 14 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
        transition={{ duration: 0.7, delay: 0.15 }}
      >
        {s.tagline}
      </motion.p>

      <motion.div
        className="flex gap-2 mt-6 flex-wrap justify-center"
        initial={{ opacity: 0, y: 12 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        {s.tags.map((tag, i) => (
          <motion.div
            key={i}
            className="px-3 py-1 rounded-full text-[10px] font-semibold text-[var(--color-accent)] tactical-border"
            style={{ background: 'rgba(58,224,106,0.08)' }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ delay: i * 0.07, type: 'spring', stiffness: 300 }}
          >
            {tag}
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
