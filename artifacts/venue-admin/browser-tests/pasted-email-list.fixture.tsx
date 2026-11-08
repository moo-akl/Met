import { useState } from "react";
import { createRoot } from "react-dom/client";
import PastedVenueEmailDialog from "../src/components/PastedVenueEmailDialog";
import "../src/index.css";

// This development-only visual fixture must never send real email.
window.fetch = async () => { throw new Error("Live requests are disabled in the bulk email preview."); };

function Fixture() {
  const [open, setOpen] = useState(true);
  return <main className="min-h-screen bg-[#f7f5f1] p-8">
    <button onClick={() => setOpen(true)}>Open bulk email preview</button>
    <PastedVenueEmailDialog open={open} onOpenChange={setOpen} onSent={async () => {}}
      templates={[{ id: "preview", name: "Preview template", subject: "Discover Met", body: "Hello {{businessName}} team,\nDiscover Met.", format: "text", builtin: false }]} />
  </main>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
