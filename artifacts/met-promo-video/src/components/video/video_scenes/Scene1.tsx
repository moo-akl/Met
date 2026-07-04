import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import onboardingImg from '@assets/met_screens/01_onboarding.jpg';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2200),
      setTimeout(() => setPhase(4), 5000), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-row items-center w-full max-w-[80vw] gap-16">
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8 overflow-hidden rounded-2xl w-20 h-20 bg-gradient-to-tr from-emerald-400 to-cyan-500 flex items-center justify-center text-4xl font-bold"
          >
            Met.
          </motion.div>
          
          <motion.h1 
            className="text-[4.5vw] font-bold leading-[1.1] tracking-tight"
            initial={{ opacity: 0, x: -50 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            You cross paths with <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              hundreds of people
            </span>
          </motion.h1>
          
          <motion.p 
            className="text-[1.8vw] text-white/60 mt-6 max-w-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            What if you could actually connect with them?
          </motion.p>
        </div>

        <motion.div 
          className="flex-1 flex justify-end perspective-1000"
          initial={{ opacity: 0, rotateY: -30, x: 100 }}
          animate={phase >= 1 ? { opacity: 1, rotateY: -10, x: 0 } : { opacity: 0, rotateY: -30, x: 100 }}
          transition={{ duration: 1.2, type: "spring", bounce: 0.4 }}
        >
          <div className="relative w-[28vw] rounded-[2.5rem] border-[8px] border-[#18181B] bg-black shadow-2xl overflow-hidden transform-gpu" style={{ aspectRatio: '1170/2532' }}>
            <img src={onboardingImg} alt="Onboarding" className="w-full h-full object-cover" />
            
            {/* Glossy reflection */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-transparent pointer-events-none" />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
