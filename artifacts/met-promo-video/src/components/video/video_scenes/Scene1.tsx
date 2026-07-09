import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300), // First text
      setTimeout(() => setPhase(2), 1800), // Second text
      setTimeout(() => setPhase(3), 3200), // Exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const text1 = "You walk past them every day.";
  const text2 = "What if you could actually meet them?";

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, filter: 'blur(20px)', scale: 1.5 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="text-center px-12 relative z-10 w-full max-w-5xl mx-auto h-[300px]">
        {/* Text 1 */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center flex-wrap gap-x-3 w-full">
          {text1.split(' ').map((word, i) => (
            <motion.span 
              key={`w1-${i}`}
              className="text-[4vw] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight inline-block"
              initial={{ opacity: 0, y: 40, rotateX: -30 }}
              animate={
                phase === 1 
                  ? { opacity: 1, y: 0, rotateX: 0 } 
                  : phase >= 2 
                    ? { opacity: 0, y: -40, rotateX: 30 } 
                    : { opacity: 0, y: 40, rotateX: -30 }
              }
              transition={{ 
                type: 'spring', 
                stiffness: 300, 
                damping: 20, 
                delay: phase === 1 ? i * 0.08 : i * 0.04 
              }}
            >
              {word}
            </motion.span>
          ))}
        </div>

        {/* Text 2 */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center flex-wrap gap-x-4 w-full">
          {text2.split(' ').map((word, i) => (
            <motion.span 
              key={`w2-${i}`}
              className="text-[4.5vw] font-black tracking-tighter text-[var(--color-accent)] leading-none inline-block drop-shadow-[0_0_15px_rgba(58,224,106,0.3)]"
              initial={{ opacity: 0, y: 40, scale: 0.8 }}
              animate={
                phase >= 2 && phase < 3
                  ? { opacity: 1, y: 0, scale: 1 } 
                  : { opacity: 0, y: phase >= 3 ? -40 : 40, scale: phase >= 3 ? 1.2 : 0.8 }
              }
              transition={{ 
                type: 'spring', 
                stiffness: 400, 
                damping: 25, 
                delay: phase >= 2 ? i * 0.06 : 0 
              }}
            >
              {word}
            </motion.span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
