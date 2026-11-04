import { useActiveVenueIntroProfile } from '@/data/venueIntroProfiles';
import { copy } from '@/data/language';

export default function Slide8() {
  const activeVenueIntroProfile = useActiveVenueIntroProfile();

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg text-text">
      <div className="absolute left-0 top-0 h-[100vh] w-[100vw] bg-[radial-gradient(ellipse_at_88%_8%,rgba(64,191,98,0.17),transparent_34%)]" />
      <div className="relative z-10 flex h-full flex-col px-[8vw] py-[8vh]">
        {activeVenueIntroProfile?.activationMode ? (
          <>
            <h2 className="max-w-[70vw] font-display text-[4.2vw] font-bold leading-[1.05] tracking-[-0.04em] text-forest">
              {copy('Your venue is approved. Finish account activation.', 'Tu local está aprobado. Completa la activación de tu cuenta.')}
            </h2>
            <div className="mt-[8vh] grid flex-1 grid-cols-3 gap-[2vw]">
              <div className="flex flex-col justify-between rounded-[1.6vw] bg-soft-green p-[2.2vw]">
                <span className="font-display text-[6vw] font-bold leading-none text-primary">01</span>
                <p className="text-[2vw] leading-[1.35]">{copy('Reply to the person who shared this deck to request a fresh, one-time registration link.', 'Responde a quien te envió esta presentación para solicitar un nuevo enlace de registro de un solo uso.')}</p>
              </div>
              <div className="flex flex-col justify-between rounded-[1.6vw] bg-forest p-[2.2vw] text-paper">
                <span className="font-display text-[6vw] font-bold leading-none text-accent">02</span>
                <p className="text-[2vw] leading-[1.35]">{copy('Use the invited email address to create your Venue Manager account.', 'Usa el correo electrónico de la invitación para crear tu cuenta de Venue Manager.')}</p>
              </div>
              <div className="flex flex-col justify-between rounded-[1.6vw] bg-primary p-[2.2vw] text-paper">
                <span className="font-display text-[6vw] font-bold leading-none text-paper/75">03</span>
                <p className="text-[2vw] leading-[1.35]">{copy('Sign in to manage your approved venue, prepare a QR poster, and welcome guests.', 'Inicia sesión para gestionar tu local aprobado, preparar un cartel con código QR y recibir visitantes.')}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="max-w-[70vw] font-display text-[4.2vw] font-bold leading-[1.05] tracking-[-0.04em] text-forest">
              {copy('Apply and verify your venue.', 'Solicita el registro y verifica tu local.')}
            </h2>
            <div className="mt-[8vh] grid flex-1 grid-cols-3 gap-[2vw]">
              <div className="flex flex-col justify-between rounded-[1.6vw] bg-soft-green p-[2.2vw]">
                <span className="font-display text-[6vw] font-bold leading-none text-primary">01</span>
                <p className="text-[2vw] leading-[1.35]">{copy('In the app, open Settings and select “Register your venue.”', 'En la app, abre Ajustes y selecciona «Registrar tu local».')}</p>
              </div>
              <div className="flex flex-col justify-between rounded-[1.6vw] bg-forest p-[2.2vw] text-paper">
                <span className="font-display text-[6vw] font-bold leading-none text-accent">02</span>
                <p className="text-[2vw] leading-[1.35]">{copy('Examples of proof include a business license, lease, or utility bill addressed to the venue.', 'Como comprobante, puedes presentar una licencia comercial, un contrato de arrendamiento o una factura de servicios a nombre del local.')}</p>
              </div>
              <div className="flex flex-col justify-between rounded-[1.6vw] bg-primary p-[2.2vw] text-paper">
                <span className="font-display text-[6vw] font-bold leading-none text-paper/75">03</span>
                <p className="text-[2vw] leading-[1.35]">{copy('Finish account registration through the emailed link after approval.', 'Cuando se apruebe la solicitud, completa el registro desde el enlace que recibirás por correo.')}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
