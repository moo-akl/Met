import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import paywallImg from '@assets/met_screens/06_paywall.jpg';
import referralsImg from '@assets/met_screens/07_referrals.jpg';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2800),
      setTimeout(() => setPhase(4), 5000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, y: -100, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full max-w-[80vw] flex items-center gap-16">
        
        <div className="flex-1 relative h-[65vh] flex items-center justify-center">
          <motion.div
            className="absolute z-10 w-[24vw] rounded-[2.5rem] border-[8px] border-[#18181B] bg-black shadow-[0_0_50px_rgba(59,130,246,0.2)] overflow-hidden"
            style={{ aspectRatio: '1170/2532' }}
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={phase >= 1 ? { opacity: 1, scale: phase >= 3 ? 0.9 : 1, x: phase >= 3 ? '-10vw' : 0 } : { opacity: 0, scale: 0.8, y: 50 }}
            transition={{ duration: 1, type: "spring", bounce: 0.3 }}
          >
            <img src={paywallImg} alt="Met Plus Paywall" className="w-full h-full object-cover" />
          </motion.div>

          <motion.div
            className="absolute z-20 w-[24vw] rounded-[2.5rem] border-[8px] border-[#18181B] bg-black shadow-[0_0_50px_rgba(16,185,129,0.2)] overflow-hidden"
            style={{ aspectRatio: '1170/2532' }}
            initial={{ opacity: 0, scale: 0.8, x: '10vw', y: 50 }}
            animate={phase >= 3 ? { opacity: 1, scale: 1.05, x: '10vw', y: 0 } : { opacity: 0, scale: 0.8, x: '10vw', y: 50 }}
            transition={{ duration: 1, type: "spring", bounce: 0.3 }}
          >
            <img src={referralsImg} alt="Referrals" className="w-full h-full object-cover" />
          </motion.div>
        </div>

        <div className="flex-1">
          <motion.h2 
            className="text-[4vw] font-bold leading-tight"
            initial={{ opacity: 0, y: -20 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Elevate <br/>
            your network.
          </motion.h2>
          
          <motion.div 
            className="mt-6 flex flex-col gap-4"
            initial={{ opacity: 0, x: 20 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <p className="text-[1.5vw] text-white/80 font-medium">Met Plus unlocks premium features.</p>
          </motion.div>

          <motion.div
            className="mt-6"
            initial={{ opacity: 0, x: 20 }}
            animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-[1.5vw] text-white/80 font-medium">Grow organically with referrals.</p>
          </motion.div>
        </div>

      </div>
    </motion.div>
  );
}
