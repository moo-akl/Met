import { useActiveVenueIntroProfile } from '@/data/venueIntroProfiles';
import { copy } from '@/data/language';

const base = import.meta.env.BASE_URL;

export default function Slide3() {
  const activeVenueIntroProfile = useActiveVenueIntroProfile();

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg text-text">
      <div className="absolute inset-y-0 right-0 w-[36vw] bg-soft-green" />
      <div className="relative z-10 flex h-full items-center justify-between gap-[6vw] px-[8vw] py-[8vh]">
        <div className="w-[52vw]">
          <h2 className="font-display text-[3.7vw] font-bold leading-[1.05] tracking-[-0.04em] text-forest">
            {copy('Reach the customers who visit your venue.', 'Llega a los clientes que visitan tu local.')}
          </h2>
          <p className="mt-[4vh] max-w-[49vw] text-[2.1vw] leading-[1.42]">
            {copy('Post timely announcements, promote upcoming events, and offer rewards to customers who visit your venue.', 'Publica novedades, promociona próximos eventos y ofrece recompensas a quienes visitan tu local.')}
          </p>
          {activeVenueIntroProfile?.activationMode ? (
            <p className="mt-[2.5vh] inline-flex max-w-[49vw] rounded-full bg-forest px-[1.5vw] py-[0.8vh] text-[1.5vw] font-semibold text-paper">
              {copy('Need a fresh invite? Reply to the person who shared this presentation.', '¿Necesitas una nueva invitación? Responde a la persona que te envió esta presentación.')}
            </p>
          ) : (
            <a
              href="https://met-app.org/venue-manager/apply"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-[2.5vh] inline-flex rounded-full bg-forest px-[1.5vw] py-[0.8vh] text-[1.5vw] font-semibold text-paper underline-offset-4 hover:underline"
            >
              {copy('Register your venue · met-app.org/venue-manager/apply', 'Registra tu local · met-app.org/venue-manager/apply')}
            </a>
          )}
        </div>
        <div className="relative ml-auto w-[16vw]">
          <img
            src={`${base}media/met-venue-visitors-preview.jpg`}
            crossOrigin="anonymous"
            className="h-[82vh] w-full rounded-[1.8vw] border-[0.45vw] border-white object-contain shadow-[0_2vw_5vw_rgba(18,59,45,0.16)]"
            alt="Illustrative venue page showing announcements, active rewards, and upcoming events"
          />
        </div>
      </div>
    </div>
  );
}
