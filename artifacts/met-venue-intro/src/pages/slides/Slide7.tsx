import { copy } from '@/data/language';

const base = import.meta.env.BASE_URL;

export default function Slide7() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-paper text-text">
      <div className="absolute left-0 top-0 h-full w-[42vw] bg-soft-green" />
        <div className="relative z-10 flex h-full items-center gap-[12vw] px-[8vw] py-[8vh]">
        <div className="relative ml-[2vw] w-[20vw]">
          <img
            src={`${base}media/met-recent-encounters-preview.jpg`}
            crossOrigin="anonymous"
            className="h-[77vh] w-full rounded-[1.8vw] border-[0.45vw] border-white object-contain shadow-[0_2vw_5vw_rgba(18,59,45,0.16)]"
            alt="Illustrative Met Recent Encounters list with multiple user profiles"
          />
          <span className="absolute bottom-[1.2vh] left-[0.7vw] whitespace-nowrap rounded-full bg-forest px-[0.8vw] py-[0.7vh] text-[1.5vw] font-semibold uppercase tracking-[0.08em] text-paper">{copy('Sample encounters', 'Encuentros de ejemplo')}</span>
        </div>
        <div className="w-[50vw]">
          <h2 className="font-display text-[4.1vw] font-bold leading-[1.05] tracking-[-0.04em] text-forest">
            {copy('Why is Met different?', '¿Qué hace diferente a Met?')}
          </h2>
          <p className="mt-[5vh] max-w-[50vw] text-[2.2vw] leading-[1.42] text-text">
            {copy('Bluetooth helps nearby users discover profiles and send connection requests. Guests can meet at your venue, build connections, and find reasons to return.', 'Bluetooth permite que las personas cercanas descubran perfiles y envíen solicitudes de conexión. Así, tus visitantes pueden conocerse en tu local, crear vínculos y encontrar motivos para volver.')}
          </p>
        </div>
      </div>
    </div>
  );
}
