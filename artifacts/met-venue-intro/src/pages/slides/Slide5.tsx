import { copy } from '@/data/language';

const base = import.meta.env.BASE_URL;

export default function Slide5() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-paper text-text">
      <div className="absolute left-0 top-0 h-full w-[5vw] bg-primary" />
      <div className="relative flex h-full items-center gap-[4vw] px-[8vw] py-[8vh]">
        <div className="w-[42vw]">
          <h2 className="font-display text-[4.15vw] font-bold leading-[1.05] tracking-[-0.04em] text-forest">
            {copy('Give guests reasons to come back.', 'Dales a tus visitantes motivos para volver.')}
          </h2>
          <p className="mt-[5vh] max-w-[40vw] text-[2.2vw] leading-[1.42]">
            {copy('Check-ins can count toward rewards; monthly standings create friendly competition; trophies celebrate achievements.', 'Las visitas registradas suman para obtener recompensas; las clasificaciones mensuales animan la competencia amistosa y los trofeos celebran los logros.')}
          </p>
        </div>
        <div className="relative flex h-[76vh] flex-1 items-center justify-center">
          <img
            src={`${base}media/met-venue-leaderboard-preview.jpg`}
            crossOrigin="anonymous"
            className="absolute left-[1vw] top-[6vh] h-[64vh] w-[25vw] rotate-[-4deg] rounded-[1.5vw] border-[0.4vw] border-white object-cover object-top shadow-[0_2vw_4vw_rgba(18,59,45,0.16)]"
            alt="Illustrative monthly venue visitor standings"
          />
          <img
            src={`${base}media/met-trophies-collection-preview.jpg`}
            crossOrigin="anonymous"
            className="absolute right-[1vw] top-[1vh] h-[72vh] w-[24vw] rotate-[3deg] rounded-[1.5vw] border-[0.4vw] border-white object-cover object-top shadow-[0_2vw_4vw_rgba(18,59,45,0.18)]"
            alt="Illustrative monthly trophy collection"
          />
          <span className="absolute bottom-[0.5vh] right-[2vw] rounded-full bg-forest px-[1vw] py-[0.7vh] text-[1.5vw] font-semibold uppercase tracking-[0.08em] text-paper">{copy('Illustrative samples', 'Ejemplos ilustrativos')}</span>
        </div>
      </div>
    </div>
  );
}
