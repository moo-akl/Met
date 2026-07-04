import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import connectionsImg from '@assets/met_screens/04_connections.jpg';
import profileImg from '@assets/met_screens/05_profile.jpg';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 5000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: -100, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-row items-center w-full max-w-[85vw] gap-12">
        
        {/* Phones Layout */}
        <div className="flex-1 flex justify-center relative h-[60vh] perspective-1000">
          <motion.div
            className="absolute left-0 w-[24vw] rounded-[2.5rem] border-[6px] border-[#18181B] bg-black shadow-2xl overflow-hidden z-10"
            style={{ aspectRatio: '1170/2532' }}
            initial={{ opacity: 0, y: 100, rotateZ: -10 }}
            animate={phase >= 1 ? { opacity: 1, y: '5vh', rotateZ: -5 } : { opacity: 0, y: 100, rotateZ: -10 }}
            transition={{ duration: 1, type: "spring", bounce: 0.3 }}
          >
            <img src={connectionsImg} alt="Connections" className="w-full h-full object-cover" />
          </motion.div>
          
          <motion.div
            className="absolute right-0 w-[24vw] rounded-[2.5rem] border-[6px] border-[#18181B] bg-black shadow-2xl overflow-hidden z-20"
            style={{ aspectRatio: '1170/2532' }}
            initial={{ opacity: 0, y: 100, rotateZ: 10 }}
            animate={phase >= 2 ? { opacity: 1, y: '-5vh', rotateZ: 5 } : { opacity: 0, y: 100, rotateZ: 10 }}
            transition={{ duration: 1, type: "spring", bounce: 0.3, delay: 0.2 }}
          >
            <img src={profileImg} alt="Profile" className="w-full h-full object-cover" />
          </motion.div>
        </div>

        {/* Text */}
        <div className="flex-1 pl-10">
          <motion.h2 
            className="text-[4vw] font-bold leading-tight"
            initial={{ opacity: 0, x: 50 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Turn missed <br/>
            connections <br/>
            into <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">real ones.</span>
          </motion.h2>
          
          <motion.p
            className="text-[1.6vw] text-white/60 mt-6 border-l-2 border-emerald-500/50 pl-4"
            initial={{ opacity: 0, height: 0 }}
            animate={phase >= 3 ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.6 }}
          >
            Share your profile, link socials, and chat seamlessly.
          </motion.p>
        </div>

      </div>
    </motion.div>
  );
}
