import { useState } from "react";
import { ArrowLeft, Bookmark, MapPin, Navigation, ScanLine } from "lucide-react";
import "./_group.css";

type VenueTab = "Today" | "Gather" | "Guestbook";

export function VenueMedia() {
  const [activeTab, setActiveTab] = useState<VenueTab>("Guestbook");

  return (
    <main className="met-preview" aria-label="Met public venue guestbook sample">
      <div className="met-status">
        <span>9:41</span><i className="met-status-island" aria-hidden="true" />
        <span className="met-status-right"><i className="met-signal" /><i className="met-battery" /></span>
      </div>
      <header className="met-venue-hero">
        <img src="/__mockup/images/coffee-shop.png" alt="Sample café interior" />
        <div className="met-venue-hero-shade" />
        <div className="met-venue-hero-controls">
          <span aria-label="Back"><ArrowLeft size={20} /></span>
          <span aria-label="Save venue"><Bookmark size={17} /></span>
        </div>
        <div className="met-venue-title">
          <span className="met-sample-place">SAMPLE PLACE</span>
          <div className="met-venue-title-category">COFFEE · BAKERY · NEIGHBORHOOD TABLE</div>
          <h1>Mira House Coffee</h1>
        </div>
      </header>
      <div className="met-venue-actions" aria-label="Venue actions">
        <div className="met-venue-checkin"><ScanLine size={16} />Check in here</div>
        <div className="met-venue-directions"><Navigation size={16} />Directions</div>
      </div>
      <nav className="met-venue-tabs" role="tablist" aria-label="Venue details">
        {(["Today", "Gather", "Guestbook"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`met-venue-tab${activeTab === tab ? " selected" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      {activeTab === "Guestbook" ? (
        <section className="met-guestbook-content">
          <header className="met-gb-header">
            <div>
              <div className="met-gb-kicker">GUESTBOOK</div>
              <h2 className="met-gb-title">Left behind at Mira House Coffee</h2>
              <p className="met-gb-subtitle">Notes and photos from people who were here. Kept for good.</p>
            </div>
          </header>
          <div className="met-gb-sample-banner">SAMPLE CONTENT FOR PREVIEW ONLY. These are not real visitor posts.</div>
          <article className="met-gb-note">
            <span className="met-gb-margin" aria-hidden="true" />
            <div className="met-gb-sample-tag">SAMPLE MEMORY</div>
            <figure className="met-print" aria-label="Sample visit photo print">
              <span className="met-print-tape" aria-hidden="true" />
              <img src="/__mockup/images/coffee-shop.png" alt="Sample café visit scene" />
            </figure>
            <p className="met-gb-note-copy">Rainy Tuesday, warm room. I’ll be back on Saturday for the records.</p>
            <footer className="met-gb-sign">
              <span className="met-gb-avatar" aria-hidden="true">SV</span>
              <span><span className="met-gb-sign-name">— Sample visitor</span><br /><span className="met-gb-sign-date">June 14, 2025</span></span>
            </footer>
          </article>
        </section>
      ) : (
        <section className="met-venue-tab-content">
          {activeTab === "Today" ? (
            <div className="met-venue-today"><MapPin size={16} /><span>A place in your community</span></div>
          ) : (
            <div className="met-venue-gather"><strong>No gatherings announced yet</strong><span>Check back for events from this venue.</span></div>
          )}
        </section>
      )}
      <span className="met-home-indicator" aria-hidden="true" />
    </main>
  );
}
