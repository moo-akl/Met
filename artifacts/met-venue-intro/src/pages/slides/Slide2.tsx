import { useActiveVenueIntroProfile } from '@/data/venueIntroProfiles';
import { copy } from '@/data/language';

const base = import.meta.env.BASE_URL;

export default function Slide2() {
  const activeVenueIntroProfile = useActiveVenueIntroProfile();

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-paper text-text">
      <div className="absolute left-0 top-0 h-[100vh] w-[7vw] bg-soft-green" />
      <div className="relative z-10 flex h-full items-center gap-[3vw] px-[7vw] py-[8vh]">
        <div className="w-[37vw]">
          {(activeVenueIntroProfile?.venueCategory || activeVenueIntroProfile?.venueLocation) && (
            <p className="mb-[2.5vh] max-w-[36vw] text-[1.2vw] font-semibold uppercase tracking-[0.08em] text-primary">
              {[activeVenueIntroProfile.venueCategory, activeVenueIntroProfile.venueLocation]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <h2 className="font-display text-[4.1vw] font-bold leading-[1.05] tracking-[-0.04em] text-forest">
            {copy('Let users discover your venue on Met’s world map.', 'Haz que descubran tu local en el mapa mundial de Met.')}
          </h2>
          <p className="mt-[5vh] max-w-[36vw] text-[2.2vw] leading-[1.42]">
            {copy('They can save your venue and revisit it later.', 'Pueden guardar tu local y volver a visitarlo más adelante.')}
          </p>
        </div>
        <div className="ml-auto flex h-[82vh] w-[42vw] items-center justify-center gap-[1.5vw]">
          <div className="flex h-[77vh] w-[19vw] flex-col items-center rounded-[1.8vw] border-[0.4vw] border-white bg-white p-[0.35vw] shadow-[0_2vw_5vw_rgba(18,59,45,0.16)]">
            <img
              src={`${base}media/met-home-discovery-preview.jpg`}
              crossOrigin="anonymous"
              className="h-[70vh] w-full rounded-[1.3vw] object-contain"
              alt="Illustrative current Met Home screen featuring The Sunroom Café"
            />
            <p className="mt-[1vh] text-[1.5vw] font-semibold uppercase tracking-[0.08em] text-forest">{copy('Home', 'Inicio')}</p>
          </div>
          <div className="flex h-[77vh] w-[19vw] flex-col items-center rounded-[1.8vw] border-[0.4vw] border-white bg-white p-[0.35vw] shadow-[0_2vw_5vw_rgba(18,59,45,0.16)]">
            <img
              src={`${base}media/met-saved-places-preview.jpg`}
              crossOrigin="anonymous"
              className="h-[70vh] w-full rounded-[1.3vw] object-contain"
              alt="Illustrative Saved Places screen featuring The Sunroom Café"
            />
            <p className="mt-[1vh] text-[1.5vw] font-semibold uppercase tracking-[0.08em] text-forest">{copy('Saved', 'Guardados')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
