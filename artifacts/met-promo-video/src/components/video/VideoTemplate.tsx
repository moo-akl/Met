import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS = {
  intro: 6000,
  discover: 6500,
  connect: 6000,
  premium: 6000,
  outro: 5000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  intro: Scene1,
  discover: Scene2,
  connect: Scene3,
  premium: Scene4,
  outro: Scene5,
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
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white">
      {/* Persistent Background Layer */}
      <div className="absolute inset-0 z-0">
        <motion.div
          className="absolute w-[80vw] h-[80vw] rounded-full blur-[120px] opacity-30"
          style={{ background: 'radial-gradient(circle, var(--color-accent-3), transparent)' }}
          animate={{
            x: ['-20%', '30%', '-10%', '50%', '-20%'][sceneIndex] || '-20%',
            y: ['-10%', '40%', '10%', '-20%', '-10%'][sceneIndex] || '-10%',
            scale: [1, 1.2, 0.9, 1.3, 1][sceneIndex] || 1,
            opacity: [0.3, 0.4, 0.5, 0.3, 0.2][sceneIndex] || 0.3,
          }}
          transition={{ duration: 3, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[100px] opacity-20"
          style={{ background: 'radial-gradient(circle, var(--color-accent-2), transparent)' }}
          animate={{
            x: ['50%', '-10%', '60%', '10%', '50%'][sceneIndex] || '50%',
            y: ['60%', '20%', '70%', '10%', '60%'][sceneIndex] || '60%',
            scale: [0.8, 1.4, 1.1, 0.9, 0.8][sceneIndex] || 0.8,
          }}
          transition={{ duration: 4, ease: 'easeInOut' }}
        />

        {/* Subtle grid pattern for tech feel */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-50" />
      </div>

      {/* Midground dynamic shapes */}
      <motion.div
        className="absolute z-10 rounded-full border border-white/10 backdrop-blur-3xl"
        animate={{
          width: ['10vw', '40vw', '15vw', '100vw', '30vw'][sceneIndex],
          height: ['10vw', '40vw', '15vw', '100vw', '30vw'][sceneIndex],
          left: ['80vw', '-10vw', '70vw', '-20vw', '35vw'][sceneIndex],
          top: ['20vh', '50vh', '10vh', '-10vh', '35vh'][sceneIndex],
          opacity: [0, 0.2, 0.3, 0.05, 0.1][sceneIndex],
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
  );
}
