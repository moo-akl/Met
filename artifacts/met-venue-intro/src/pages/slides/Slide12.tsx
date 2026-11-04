import { copy } from '@/data/language';

export default function Slide12() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-paper text-text">
      <div className="absolute inset-y-0 right-0 w-[48vw] bg-soft-green" />
      <div className="absolute bottom-0 left-0 h-full w-[5vw] bg-primary" />
      <div className="relative z-10 flex h-full flex-col px-[8vw] py-[8vh]">
        <p className="text-[1.6vw] font-semibold uppercase tracking-[0.1em] text-primary">
          {copy('FAQ for venue owners', 'Preguntas frecuentes para propietarios de locales')}
        </p>
        <h2 className="mt-[2vh] max-w-[75vw] font-display text-[4.2vw] font-bold leading-[1.05] tracking-[-0.04em] text-forest">
          {copy('From QR check-in to a reason to return.', 'Del registro con QR a un motivo para volver.')}
        </h2>
        <div className="mt-[8vh] grid flex-1 grid-cols-2 gap-[4vw]">
          <section className="border-t-[0.35vw] border-primary pt-[2.5vh]">
            <h3 className="max-w-[34vw] text-[2.4vw] font-bold leading-[1.2] text-forest">
              {copy('How do guests join your visitor list?', '¿Cómo se unen los visitantes a tu lista?')}
            </h3>
            <p className="mt-[2.5vh] max-w-[35vw] text-[2.1vw] leading-[1.45]">
              {copy('Guests scan your venue’s QR code, open or download Met, check in on-site, earn points, and join your list.', 'Escanean el código QR de tu local, abren o descargan Met, registran su visita al llegar, ganan puntos y se unen a tu lista.')}
            </p>
          </section>
          <section className="border-t-[0.35vw] border-forest/50 pt-[2.5vh]">
            <h3 className="max-w-[34vw] text-[2.4vw] font-bold leading-[1.2] text-forest">
              {copy('Why come back?', '¿Por qué volver?')}
            </h3>
            <p className="mt-[2.5vh] max-w-[35vw] text-[2.1vw] leading-[1.45]">
              {copy('Rewards, venue updates, and shared memories give guests a reason to return.', 'Las recompensas, las novedades del local y los recuerdos compartidos les dan motivos para volver.')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
