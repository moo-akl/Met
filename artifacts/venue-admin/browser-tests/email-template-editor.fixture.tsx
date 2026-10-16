import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { listVenueEmailTemplates, type VenueEmailTemplate } from "@workspace/api-client-react";
import VenueEmailTemplateManager from "../src/components/VenueEmailTemplateManager";
import "../src/index.css";

function EmailTemplateEditorFixture() {
  const [open, setOpen] = useState(true);
  const [templates, setTemplates] = useState<VenueEmailTemplate[]>([]);

  useEffect(() => {
    void listVenueEmailTemplates().then(setTemplates);
  }, []);

  return (
    <main className="min-h-screen bg-white p-8">
      <button type="button" onClick={() => setOpen(true)}>Open template manager</button>
      <VenueEmailTemplateManager
        open={open}
        onOpenChange={setOpen}
        templates={templates}
        onChanged={async () => {
          const latest = await listVenueEmailTemplates();
          setTemplates(latest);
        }}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<EmailTemplateEditorFixture />);
