import { useEffect, useRef, ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';
import { Scene7 } from './video_scenes/Scene7';
import { Scene8 } from './video_scenes/Scene8';
import { Scene9 } from './video_scenes/Scene9';

export const SCENE_DURATIONS = {
  hook:        3000,
  radar:       4500,
  encounters:  4500,
  requests:    4500,
  social:      4500,
  networks:    4500,
  privacy:     4500,
  connections: 4500,
  outro:       4500,
};

const SCENE_COMPONENTS: Record<string, ComponentType> = {
  hook:        Scene1,
  radar:       Scene2,
  encounters:  Scene3,
  requests:    Scene4,
  social:      Scene7,
  networks:    Scene8,
  privacy:     Scene9,
  connections: Scene5,
  outro:       Scene6,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.4;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div
        className="relative overflow-hidden bg-[var(--color-bg-dark)] text-white"
        style={{
          width: 'min(100vw, calc(100vh * 9 / 16))',
          height: '100vh',
        }}
      >
        {/* Persistent Background */}
        <div className="absolute inset-0 z-0">
          <video
            src={`${import.meta.env.BASE_URL}videos/bg_loop.mp4`}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen"
          />
          <motion.div
            className="absolute w-[120%] h-[60%] rounded-full blur-[80px] opacity-10 -left-[10%]"
            style={{ background: 'radial-gradient(circle, var(--color-accent), transparent)' }}
            animate={{
              top: ['-20%', '30%', '-10%', '60%', '-20%', '10%', '40%', '20%', '-20%'][sceneIndex] ?? '-20%',
              scale: [1, 1.2, 0.9, 1.3, 1, 1.1, 0.95, 1.05, 1][sceneIndex] ?? 1,
              opacity: [0.1, 0.2, 0.15, 0.2, 0.18, 0.12, 0.22, 0.16, 0.1][sceneIndex] ?? 0.1,
            }}
            transition={{ duration: 3, ease: 'easeInOut' }}
          />

          {/* Tactical grid */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: `linear-gradient(rgba(58,224,106,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(58,224,106,0.05) 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />

          {/* Scan line */}
          <motion.div
            className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-20"
            animate={{ top: ['-1%', '101%'] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* Persistent midground orb */}
        <motion.div
          className="absolute z-10 rounded-full border border-[var(--color-accent)]/10 backdrop-blur-sm"
          animate={{
            width:   ['60%', '90%', '40%', '110%', '70%', '50%', '80%', '60%', '50%'][sceneIndex] ?? '60%',
            height:  ['30%', '40%', '20%', '50%',  '35%', '25%', '40%', '30%', '25%'][sceneIndex] ?? '30%',
            left:    ['70%', '-5%', '60%', '-15%', '30%', '65%', '-10%', '40%', '50%'][sceneIndex] ?? '70%',
            top:     ['10%', '45%', '5%',  '-5%',  '30%', '60%', '40%',  '55%', '45%'][sceneIndex] ?? '10%',
            opacity: [0,     0.08,  0.12,  0.04,   0.08,  0.1,   0.06,   0.08,  0][sceneIndex] ?? 0,
          }}
          transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Foreground Scenes */}
        <div className="relative z-20 w-full h-full">
          <AnimatePresence mode="popLayout">
            {SceneComponent && <SceneComponent key={currentSceneKey} />}
          </AnimatePresence>
        </div>

        <audio
          ref={audioRef}
          src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
          preload="auto"
          autoPlay
          muted={muted}
        />
      </div>
    </div>
  );
}
