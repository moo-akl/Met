import { useActiveVenueIntroProfile } from '@/data/venueIntroProfiles';
import { copy } from '@/data/language';

export default function Slide11() {
  const activeVenueIntroProfile = useActiveVenueIntroProfile();

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-paper text-text">
      <div className="relative z-10 flex h-full items-center justify-between gap-[4vw] px-[8vw] py-[8vh]">
        <div className="w-[45vw]">
          <p className="text-[1.6vw] font-semibold uppercase tracking-[0.1em] text-primary">
            {copy('For venues joining Met now', 'Para los locales que se unen a Met ahora')}
          </p>
          <h2 className="mt-[2.5vh] font-display text-[5vw] font-bold leading-[1.02] tracking-[-0.04em] text-forest">
            {copy('Free registration', 'Registro gratuito')}
          </h2>
          <p className="mt-[4vh] max-w-[43vw] text-[2.2vw] leading-[1.42]">
            {copy('Venues that join Met now can register for free forever.', 'Los locales que se unan a Met ahora podrán registrarse gratis para siempre.')}
          </p>
          <div className="mt-[4vh]">
            <p className="text-[1.6vw] font-semibold uppercase tracking-[0.1em] text-muted">{copy('Get the app', 'Descarga la app')}</p>
            <div className="mt-[1.2vh] flex items-center gap-[2vw] text-[1.9vw] font-bold">
              <a
                href="https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-[0.35vw]"
              >
                App Store
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=app.met.founders"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-[0.35vw]"
              >
                Google Play
              </a>
            </div>
          </div>
          <div className="mt-[3vh]">
            <p className="text-[1.6vw] font-semibold uppercase tracking-[0.1em] text-muted">
              {activeVenueIntroProfile?.activationMode ? copy('Venue Manager account', 'Cuenta de Venue Manager') : copy('Visit or register', 'Visítanos o regístrate')}
            </p>
            <div className="mt-[1vh] flex flex-col gap-[0.8vh] text-[1.55vw] font-bold leading-[1.3]">
              <a
                href="https://met-app.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-[0.3vw]"
              >
                met-app.org
              </a>
              {activeVenueIntroProfile?.activationMode ? (
                <p>
                  {copy('Your first invitation link has expired. Please reply to this email to request a new registration link.', 'Tu primer enlace de invitación ha caducado. Responde a este correo para solicitar uno nuevo.')}
                </p>
              ) : (
                <a
                  href="https://met-app.org/venue-manager/apply"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-[0.3vw]"
                >
                  {copy('Register your venue · met-app.org/venue-manager/apply', 'Registra tu local · met-app.org/venue-manager/apply')}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
