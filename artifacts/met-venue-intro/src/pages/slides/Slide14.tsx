import { copy } from '@/data/language';

export default function Slide14() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-paper text-text">
      <div className="absolute inset-y-0 left-0 w-[43vw] bg-forest" />
      <div className="relative z-10 flex h-full">
        <section className="flex w-[43vw] shrink-0 flex-col px-[7vw] py-[8vh] text-paper">
          <p className="text-[1.6vw] font-semibold uppercase tracking-[0.1em] text-accent">
            {copy('Data protection', 'Protección de datos')}
          </p>
          <h2 className="mt-[3vh] font-display text-[4.25vw] font-bold leading-[1.04] tracking-[-0.04em]">
            {copy('Questions about security?', '¿Tienes dudas sobre la seguridad?')}
          </h2>
          <p className="mt-[4vh] max-w-[30vw] text-[2.05vw] leading-[1.4] text-paper/85">
            {copy('No system can guarantee absolute security. Met uses safeguards designed to protect information.', 'Ningún sistema puede garantizar una seguridad absoluta. Met aplica medidas diseñadas para proteger la información.')}
          </p>
          <div className="mt-auto flex items-center gap-[1.5vw]">
            <div className="flex h-[8.5vw] w-[8.5vw] items-center justify-center rounded-full bg-accent text-forest">
              <svg aria-hidden="true" viewBox="0 0 64 64" className="h-[4.2vw] w-[4.2vw]" fill="none">
                <rect x="14" y="28" width="36" height="27" rx="5" stroke="currentColor" strokeWidth="4" />
                <path d="M22 28v-8a10 10 0 0 1 20 0v8M32 38v8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col gap-[0.8vh]">
              <p className="text-[2.4vw] font-bold leading-none">HTTPS</p>
              <p className="whitespace-nowrap text-[1.5vw] font-semibold uppercase tracking-[0.08em] text-paper/75">
                · {copy('Encrypted storage', 'Almacenamiento cifrado')}
              </p>
            </div>
          </div>
        </section>
        <section className="flex flex-1 flex-col justify-center gap-[4vh] px-[5vw] py-[8vh]">
          <div className="border-t-[0.3vw] border-forest/35 pt-[2vh]">
            <p className="text-[1.5vw] font-semibold uppercase tracking-[0.1em] text-primary">
              {copy('In storage', 'Almacenamiento')}
            </p>
            <h3 className="mt-[1vh] text-[2.4vw] font-bold leading-[1.15] text-forest">
              {copy('Encrypted data', 'Datos cifrados')}
            </h3>
            <p className="mt-[1vh] max-w-[45vw] text-[2vw] leading-[1.35]">
              {copy('Our service providers store data in encrypted form.', 'Nuestros proveedores de servicios almacenan los datos cifrados.')}
            </p>
          </div>
          <div className="border-t-[0.3vw] border-forest/35 pt-[2vh]">
            <p className="max-w-[45vw] text-[2vw] leading-[1.35]">
              {copy('Apple App Store and Google Play review submissions against platform requirements.', 'Apple App Store y Google Play revisan las aplicaciones según los requisitos de sus plataformas.')}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
