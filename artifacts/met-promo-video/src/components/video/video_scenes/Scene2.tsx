import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import discoverImg from '@assets/met_screens/02_discover.jpg';
import recentImg from '@assets/met_screens/03_recent.jpg';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1800),
      setTimeout(() => setPhase(3), 3200),
      setTimeout(() => setPhase(4), 5500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center pt-[5vh]"
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="text-center mb-12 z-20">
        <motion.h2 
          className="text-[4vw] font-bold leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          Discover <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">who's nearby</span>
        </motion.h2>
        <motion.p
          className="text-[1.5vw] text-white/60 mt-4"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        >
          Using radar and precise proximity
        </motion.p>
      </div>

      <div className="relative w-full max-w-[70vw] h-[55vh] flex justify-center items-center perspective-1000 z-10">
        <motion.div
          className="absolute z-10 w-[22vw] rounded-[2.5rem] border-[8px] border-[#18181B] bg-black shadow-2xl overflow-hidden"
          style={{ aspectRatio: '1170/2532' }}
          initial={{ opacity: 0, scale: 0.8, x: -100, rotateY: 20 }}
          animate={phase >= 1 ? { 
            opacity: 1, 
            scale: phase >= 3 ? 0.9 : 1, 
            x: phase >= 3 ? '-12vw' : 0, 
            rotateY: phase >= 3 ? 15 : 0 
          } : { opacity: 0, scale: 0.8, x: -100, rotateY: 20 }}
          transition={{ duration: 1.2, type: "spring", bounce: 0.3 }}
        >
          <img src={discoverImg} alt="Discover" className="w-full h-full object-cover" />
        </motion.div>

        <motion.div
          className="absolute z-20 w-[22vw] rounded-[2.5rem] border-[8px] border-[#18181B] bg-black shadow-2xl overflow-hidden"
          style={{ aspectRatio: '1170/2532' }}
          initial={{ opacity: 0, scale: 0.8, x: 100, rotateY: -20 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1.05, x: '12vw', rotateY: -10, zIndex: 30 } : { opacity: 0, scale: 0.8, x: 100, rotateY: -20, zIndex: 10 }}
          transition={{ duration: 1.2, type: "spring", bounce: 0.3 }}
        >
          <img src={recentImg} alt="Recent Encounters" className="w-full h-full object-cover" />
        </motion.div>
      </div>
    </motion.div>
  );
}
