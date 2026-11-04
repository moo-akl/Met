import { copy } from '@/data/language';

const base = import.meta.env.BASE_URL;

export default function Slide4() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-forest text-paper">
      <div className="absolute right-0 top-0 h-full w-[43vw] bg-soft-green" />
      <div className="relative z-10 flex h-full items-center gap-[5vw] px-[8vw] py-[8vh]">
        <div className="w-[44vw]">
          <h2 className="font-display text-[4.3vw] font-bold leading-[1.05] tracking-[-0.04em]">
            {copy('Let guests leave a lasting note.', 'Permite que tus visitantes dejen un recuerdo.')}
          </h2>
          <p className="mt-[5vh] max-w-[43vw] text-[2.2vw] leading-[1.42] text-paper/90">
            {copy('After checking in, guests can leave a note or photo in your Guest Book. Their memories stay available for future visits.', 'Después de registrar su visita, pueden dejar una nota o una foto en el Libro de visitas. Sus recuerdos estarán disponibles en futuras visitas.')}
          </p>
        </div>
        <div className="relative ml-auto w-[31vw] rotate-[1deg] rounded-[1.6vw] border-[0.45vw] border-paper shadow-[0_2vw_5vw_rgba(0,0,0,0.22)]">
          <img
            src={`${base}media/met-venue-guestbook-memory-preview-proofread.jpg`}
            crossOrigin="anonymous"
            className="h-[79vh] w-full rounded-[1.2vw] object-cover object-center"
            alt="Guest Book sample memory with a guest photo and note"
          />
        </div>
      </div>
    </div>
  );
}
