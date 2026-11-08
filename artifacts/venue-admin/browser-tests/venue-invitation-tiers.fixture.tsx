import { createRoot } from "react-dom/client";
import {
  type VenueEmailTemplate,
  type VenueOutreachHistoryEntry,
} from "@workspace/api-client-react";
import GlobalVenueProspectsDialog from "../src/components/GlobalVenueProspectsDialog";
import "../src/index.css";

const template = {
  id: "global_venue_prospect",
  name: "Personalized venue invitation",
  subject: "A note for {{businessName}}",
  body: "Hello {{businessName}} team,\n\n{{venueFitReason}}",
  format: "text",
  builtin: true,
} as VenueEmailTemplate;
const spanishTemplate = {
  id: "global_venue_prospect_es",
  name: "Invitación personalizada en español",
  subject: "Una nota para {{businessName}}",
  body: "Hola, equipo de {{businessName}}:\n\nMe llamó la atención {{businessName}} por un motivo concreto:\n\n{{venueFitReason}}",
  format: "text",
  builtin: true,
} as VenueEmailTemplate;

const history = [
  {
    businessName: "G Hotel Amman",
    recipientEmail: "info@ghotelamman.com",
    deliveryStatus: "sent",
  },
] as unknown as VenueOutreachHistoryEntry[];

function VenueInvitationTiersFixture() {
  return (
    <main className="min-h-screen bg-white p-8">
      <GlobalVenueProspectsDialog
        open
        onOpenChange={() => undefined}
        templates={[template, spanishTemplate]}
        history={history}
        suppressedEmails={["info@camla.org"]}
        onSent={async () => undefined}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<VenueInvitationTiersFixture />);
