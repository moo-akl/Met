import { copy } from '@/data/language';

const base = import.meta.env.BASE_URL;

export default function Slide10() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-primary text-paper">
      <div className="absolute right-0 top-0 h-full w-[58vw] bg-forest" />
      <div className="relative z-10 flex h-full items-center justify-between gap-[3vw] px-[5vw] py-[8vh]">
        <div className="w-[35vw] shrink-0">
          <h2 className="font-display text-[4.3vw] font-bold leading-[1.05] tracking-[-0.04em]">
            {copy('Print your poster. Welcome guests. Grow your community.', 'Imprime tu cartel. Recibe visitantes. Haz crecer tu comunidad.')}
          </h2>
          <p className="mt-[5vh] max-w-[35vw] text-[2.2vw] leading-[1.42]">
            {copy('Design your poster in Venue Manager, complete your venue page, then print and display it. Check-ins can count toward rewards, and guests can leave notes and photos in the Guest Book.', 'Diseña tu cartel en Venue Manager, completa la página de tu local y luego imprímelo y colócalo. Las visitas registradas pueden contar para obtener recompensas; además, los visitantes pueden dejar notas y fotos en el Libro de visitas.')}
          </p>
        </div>
        <div className="relative flex h-[62vh] w-[52vw] shrink-0 items-center justify-center">
          <img
            src={`${base}media/met-qr-poster-editor.jpg`}
            crossOrigin="anonymous"
            className="h-full w-full rounded-[1.2vw] border-[0.4vw] border-paper object-contain shadow-[0_2vw_5vw_rgba(0,0,0,0.24)]"
            alt="Met Venue Manager custom QR poster editor with design controls and a live poster preview"
          />
          <span className="absolute bottom-[-4vh] right-[1vw] rounded-full bg-forest px-[1vw] py-[0.7vh] text-[1.5vw] font-semibold uppercase tracking-[0.08em] text-paper">{copy('Illustrative editor preview', 'Vista ilustrativa del editor')}</span>
        </div>
      </div>
    </div>
  );
}
