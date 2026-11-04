import { copy } from '@/data/language';

export default function Slide13() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-paper text-text">
      <div className="absolute inset-y-0 right-0 w-[43vw] bg-soft-green" />
      <div className="absolute bottom-0 left-0 h-full w-[0.8vw] bg-primary" />
      <div className="relative z-10 flex h-full flex-col px-[8vw] py-[7vh]">
        <p className="text-[1.6vw] font-semibold uppercase tracking-[0.1em] text-primary">
          {copy('Guest privacy', 'Privacidad de los visitantes')}
        </p>
        <h2 className="mt-[1.5vh] max-w-[76vw] font-display text-[4.2vw] font-bold leading-[1.05] tracking-[-0.04em] text-forest">
          {copy('What about guest privacy?', '¿Y la privacidad de los visitantes?')}
        </h2>
        <div className="mt-[5vh] grid flex-1 grid-cols-2 grid-rows-2 gap-[1.8vw]">
          <section className="flex flex-col justify-between rounded-[1.3vw] bg-forest p-[2vw] text-paper">
            <div className="flex items-center justify-between gap-[1vw]">
              <h3 className="text-[2.15vw] font-bold leading-[1.15]">
                {copy('Your visibility, your choice', 'Tú eliges tu visibilidad')}
              </h3>
              <div className="flex shrink-0 gap-[0.4vw] rounded-full bg-white/10 p-[0.35vw] text-[1.5vw] font-semibold uppercase tracking-[0.06em]">
                <span className="rounded-full px-[0.7vw] py-[0.55vh] text-paper/70">{copy('Hidden', 'Oculto')}</span>
                <span className="rounded-full bg-accent px-[0.7vw] py-[0.55vh] text-forest">{copy('Visible', 'Visible')}</span>
              </div>
            </div>
            <p className="mt-[2vh] text-[2vw] leading-[1.35]">
              {copy('Choose Visible or Hidden. Hidden stops nearby discovery.', 'Elige Visible u Oculto. El modo Oculto detiene los descubrimientos cercanos.')}
            </p>
          </section>
          <section className="flex flex-col justify-between rounded-[1.3vw] bg-white/80 p-[2vw] shadow-[0_1.5vw_3vw_rgba(18,59,45,0.08)]">
            <h3 className="text-[2.15vw] font-bold leading-[1.15] text-forest">
              {copy('Location details', 'Tu ubicación')}
            </h3>
            <p className="mt-[2vh] text-[2vw] leading-[1.35]">
              {copy('Nearby users cannot see your GPS coordinates, Met does not keep a continuous location history.', 'Las personas cercanas no pueden ver tus coordenadas GPS; Met no conserva un historial continuo de ubicación.')}
            </p>
          </section>
          <section className="flex flex-col justify-between rounded-[1.3vw] bg-soft-green p-[2vw]">
            <h3 className="text-[2.15vw] font-bold leading-[1.15] text-forest">
              {copy('Consent before chat', 'Consentimiento antes del chat')}
            </h3>
            <p className="mt-[2vh] text-[2vw] leading-[1.35]">
              {copy('social media and profile info and Chat begins only after your reveal request is accepted.', 'redes sociales e información del perfil, y el chat comienza solo después de que se acepte tu solicitud de revelación.')}
            </p>
          </section>
          <section className="flex flex-col justify-between rounded-[1.3vw] border border-forest/10 bg-paper p-[2vw]">
            <h3 className="text-[2.15vw] font-bold leading-[1.15] text-forest">
              {copy('Community safeguards', 'Protecciones de la comunidad')}
            </h3>
            <p className="mt-[2vh] text-[2vw] leading-[1.35]">
              {copy('anti spamming with one message per turn. Users Trust Score system to Keep the app to high standards.', 'medidas antispam con un mensaje por turno. El sistema Trust Score de los usuarios ayuda a mantener la aplicación con estándares altos.')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
