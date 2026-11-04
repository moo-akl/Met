import { useActiveVenueIntroProfile } from '@/data/venueIntroProfiles';
import { copy } from '@/data/language';

const base = import.meta.env.BASE_URL;

export default function Slide1() {
  const activeVenueIntroProfile = useActiveVenueIntroProfile();

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg text-text">
      <div className="absolute inset-y-0 right-0 w-[48vw]">
        <img
          src={`${base}media/sunroom-cafe-cover.jpg`}
          crossOrigin="anonymous"
          className="h-full w-full object-cover"
          alt="Warm neighborhood cafe interior"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-forest/30 via-transparent to-forest/15" />
      </div>
      <div className="absolute left-0 top-0 h-[100vh] w-[57vw] bg-bg" />
      <div className="absolute left-0 top-0 h-[100vh] w-[5vw] bg-leaf" />
      <div className="relative z-10 flex h-full w-[58vw] flex-col justify-center pl-[9vw] pr-[5vw]">
        {activeVenueIntroProfile && (
          <p className="mb-[2vh] text-[1.6vw] font-semibold uppercase tracking-[0.1em] text-primary">
            {copy('An introduction to Met for', 'Una presentación de Met para')} {activeVenueIntroProfile.venueName}
          </p>
        )}
        <h1 className="max-w-[46vw] font-display text-[5.1vw] font-bold leading-[1.04] tracking-[-0.045em] text-forest">
          <span className="block">{copy('Connect with your', 'Conecta con tus')}</span>
          <span className="block">{copy('real visitors', 'visitantes reales')}</span>
        </h1>
        {activeVenueIntroProfile ? (
          <>
            <p className="mt-[3.5vh] max-w-[42vw] text-[2.25vw] font-semibold leading-[1.3] text-forest">
              {activeVenueIntroProfile.coverCopy}
            </p>
            <p className="mt-[2vh] max-w-[42vw] text-[1.5vw] leading-[1.45] text-muted">
              {copy('Give them reasons to return—and keep the relationships and memories going.', 'Dales motivos para volver y mantén vivas las relaciones y los recuerdos.')}
            </p>
          </>
        ) : (
          <p className="mt-[4vh] max-w-[42vw] text-[2.1vw] leading-[1.42] text-muted">
            {copy('Give them reasons to return—and keep the relationships and memories going.', 'Dales motivos para volver y mantén vivas las relaciones y los recuerdos.')}
          </p>
        )}
      </div>
      <div className="absolute bottom-[7vh] right-[5vw] z-20 w-[28vw] rotate-[2deg] rounded-[1.6vw] border-[0.45vw] border-paper shadow-[0_1.5vw_4vw_rgba(18,59,45,0.22)]">
        <img
          src={`${base}media/met-venue-guestbook-preview-proofread.jpg`}
          crossOrigin="anonymous"
          className="h-[59vh] w-full rounded-[1.2vw] object-cover object-top"
          alt="Illustrative Met Guest Book preview with a guest note and photo"
        />
        <span className="absolute bottom-[1.2vh] left-[1vw] rounded-full bg-forest px-[1vw] py-[0.7vh] text-[1.5vw] font-semibold uppercase tracking-[0.08em] text-paper">{copy('Illustrative sample', 'Ejemplo ilustrativo')}</span>
      </div>
    </div>
  );
}
