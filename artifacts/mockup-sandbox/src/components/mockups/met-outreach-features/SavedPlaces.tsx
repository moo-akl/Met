import { ArrowLeft, Check } from "lucide-react";
import "./_group.css";

const savedPlaces = [
  { placeId: "met-sample-mira-house", placeName: "Mira House Coffee" },
  { placeId: "met-sample-juniper-market", placeName: "Juniper Market" },
  { placeId: "met-sample-cypress-books", placeName: "Cypress Books" },
];

export function SavedPlaces() {
  return (
    <main className="met-preview" aria-label="Met saved places sample">
      <div className="met-status">
        <span>9:41</span>
        <i className="met-status-island" aria-hidden="true" />
        <span className="met-status-right"><i className="met-signal" /><i className="met-battery" /></span>
      </div>

      <header className="met-saved-header">
        <span className="met-saved-back" aria-hidden="true"><ArrowLeft size={23} strokeWidth={2} /></span>
        <h1>Saved places</h1>
      </header>
      <p className="met-saved-caption">
        Your favorite places, ready for another visit. Saving a place doesn’t check you in.
      </p>

      <div className="met-saved-disclosure">
        <span>SAMPLE</span>
        <span className="met-saved-disclosure-divider" aria-hidden="true" />
        <span>READ-ONLY</span>
      </div>

      <section className="met-saved-list" aria-label="Saved places">
        {savedPlaces.map((place) => (
          <article className="met-saved-row" key={place.placeId}>
            <div className="met-saved-place">
              <span className="met-saved-name">{place.placeName}</span>
              <span className="met-saved-view">View place</span>
            </div>
            <div className="met-saved-status" aria-label="Saved">
              <Check size={17} strokeWidth={2.3} aria-hidden="true" />
              <span>Saved</span>
            </div>
          </article>
        ))}
      </section>

      <span className="met-home-indicator" aria-hidden="true" />
      <style>{`
        .met-saved-header {
          min-height: 42px;
          padding: 0 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .met-saved-back {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          color: var(--met-ink);
        }
        .met-saved-header h1 {
          margin: 0;
          color: var(--met-ink);
          font-size: 28px;
          line-height: 34px;
          font-weight: 700;
          letter-spacing: -.55px;
        }
        .met-saved-caption {
          margin: 0;
          padding: 8px 24px 18px;
          color: var(--met-muted);
          font-size: 14px;
          line-height: 21px;
        }
        .met-saved-disclosure {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 20px 12px;
          color: #68776C;
          font-size: 9px;
          line-height: 12px;
          font-weight: 700;
          letter-spacing: .85px;
        }
        .met-saved-disclosure-divider {
          width: 1px;
          height: 10px;
          background: #B9C5B8;
        }
        .met-saved-list {
          padding: 0 20px 32px;
        }
        .met-saved-row {
          min-height: 82px;
          display: flex;
          align-items: center;
          padding: 8px;
          margin-bottom: 12px;
          border: 1px solid var(--met-border);
          border-radius: 20px;
          background: var(--met-card);
        }
        .met-saved-place {
          min-width: 0;
          min-height: 64px;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 6px;
          padding: 10px;
        }
        .met-saved-name {
          overflow: hidden;
          color: var(--met-ink);
          font-size: 17px;
          line-height: 21px;
          font-weight: 650;
          letter-spacing: -.2px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .met-saved-view {
          color: var(--met-muted);
          font-size: 14px;
          line-height: 18px;
        }
        .met-saved-status {
          min-width: 72px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          color: var(--met-ink);
          font-size: 13px;
          line-height: 17px;
          font-weight: 650;
          white-space: nowrap;
        }
        @media (max-width: 389px) {
          .met-saved-list { padding-right: 20px; padding-left: 20px; }
        }
      `}</style>
    </main>
  );
}
