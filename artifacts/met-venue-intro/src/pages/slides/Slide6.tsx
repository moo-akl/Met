import { copy } from '@/data/language';

const base = import.meta.env.BASE_URL;

export default function Slide6() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg text-text">
      <div className="absolute right-0 top-0 h-full w-[23vw] bg-soft-green" />
      <div className="relative z-10 flex h-full flex-col px-[8vw] py-[8vh]">
        <div className="w-full">
          <h2 className="max-w-[68vw] font-display text-[4.1vw] font-bold leading-[1.05] tracking-[-0.04em] text-forest">
            {copy('See your visitors. Stay connected.', 'Conoce a tus visitantes. Mantén el contacto.')}
          </h2>
        </div>
        <div className="mt-[6vh] grid flex-1 grid-cols-[1fr_1fr_1.2fr] gap-[2.5vw] pr-[24vw]">
          <p className="border-t-[0.35vw] border-primary pt-[2vh] text-[2vw] leading-[1.4]">
            {copy('See who visits your venue and check who visits most often.', 'Consulta quiénes visitan tu local y quiénes lo hacen con mayor frecuencia.')}
          </p>
          <p className="border-t-[0.35vw] border-primary pt-[2vh] text-[2vw] leading-[1.4]">
            {copy('Send a personal connection request, then message guests in Met when they accept.', 'Envía una solicitud para conectar y, cuando la acepten, escríbeles por Met.')}
          </p>
          <p className="border-t-[0.35vw] border-primary pt-[2vh] text-[2vw] leading-[1.4]">
            {copy('Build lasting connections and invite your regulars to major events.', 'Crea vínculos duraderos e invita a tus clientes habituales a los eventos importantes.')}
          </p>
        </div>
        <div className="absolute right-[5vw] top-[14vh] w-[19vw]">
          <img
            src={`${base}media/met-venue-leaderboard-preview.jpg`}
            crossOrigin="anonymous"
            className="h-[68vh] w-[19vw] rounded-[1.5vw] border-[0.4vw] border-white object-cover object-top shadow-[0_2vw_5vw_rgba(18,59,45,0.16)]"
            alt="Illustrative Met visitors list with sample guests and visit counts"
          />
          <span className="absolute bottom-[1.2vh] left-[0.5vw] whitespace-nowrap rounded-full bg-forest px-[0.8vw] py-[0.7vh] text-[1.5vw] font-semibold uppercase tracking-[0.08em] text-paper">{copy('Sample visitors', 'Visitantes de ejemplo')}</span>
        </div>
      </div>
    </div>
  );
}
