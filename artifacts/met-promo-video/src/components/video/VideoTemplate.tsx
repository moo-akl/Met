import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';

export const SCENE_DURATIONS = {
  hook: 3500,
  radar: 6000,
  encounters: 5500,
  requests: 5500,
  connections: 5500,
  outro: 5000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  hook: Scene1,
  radar: Scene2,
  encounters: Scene3,
  requests: Scene4,
  connections: Scene5,
  outro: Scene6,
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
    <div className="relative w-full h-screen overflow-hidden bg-[var(--color-bg-dark)] text-white">
      {/* Persistent Background Layer */}
      <div className="absolute inset-0 z-0">
        <video 
          src={`${import.meta.env.BASE_URL}videos/bg_loop.mp4`}
          autoPlay 
          loop 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-screen"
        />
        <motion.div
          className="absolute w-[80vw] h-[80vw] rounded-full blur-[120px] opacity-10"
          style={{ background: 'radial-gradient(circle, var(--color-accent), transparent)' }}
          animate={{
            x: ['-20%', '30%', '-10%', '50%', '-20%', '10%'][sceneIndex] || '-20%',
            y: ['-10%', '40%', '10%', '-20%', '-10%', '30%'][sceneIndex] || '-10%',
            scale: [1, 1.2, 0.9, 1.3, 1, 1.1][sceneIndex] || 1,
            opacity: [0.1, 0.2, 0.15, 0.2, 0.1, 0.2][sceneIndex] || 0.1,
          }}
          transition={{ duration: 3, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[100px] opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, var(--color-success), transparent)' }}
          animate={{
            x: ['50%', '-10%', '60%', '10%', '50%', '20%'][sceneIndex] || '50%',
            y: ['60%', '20%', '70%', '10%', '60%', '40%'][sceneIndex] || '60%',
            scale: [0.8, 1.4, 1.1, 0.9, 0.8, 1.2][sceneIndex] || 0.8,
          }}
          transition={{ duration: 4, ease: 'easeInOut' }}
        />

        {/* Tactical Grid / Scan lines */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik0wIDM5LjVoNDBNMzkuNSAwdi00MCIgc3Ryb2tlPSJyZ2JhKDU4LDIyNCwxMDYsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==')] opacity-60" />
      </div>

      {/* Midground dynamic shapes */}
      <motion.div
        className="absolute z-10 rounded-full border border-[var(--color-accent)] backdrop-blur-md"
        animate={{
          width: ['10vw', '40vw', '15vw', '100vw', '30vw', '0vw'][sceneIndex],
          height: ['10vw', '40vw', '15vw', '100vw', '30vw', '0vw'][sceneIndex],
          left: ['80vw', '-10vw', '70vw', '-20vw', '35vw', '50vw'][sceneIndex],
          top: ['20vh', '50vh', '10vh', '-10vh', '35vh', '50vh'][sceneIndex],
          opacity: [0, 0.1, 0.15, 0.05, 0.1, 0][sceneIndex],
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
