import { useState } from "react";
import { ArrowLeft, Edit2, HelpCircle, MapPin, X } from "lucide-react";
import "./_group.css";

const questions = [
  {
    prompt: "Can I choose when people nearby can discover me?",
    answer: "When your beacon is off, it is invisible to everyone.",
  },
  {
    prompt: "What can I do after visiting a venue?",
    answer: "Scan the venue QR for a verified check-in, then leave a note or photo in that venue’s Guestbook.",
  },
];

type NetworkTab = "Feed" | "Members" | "Info";

export function Questionnaire() {
  const [activeTab, setActiveTab] = useState<NetworkTab>("Feed");
  const [answerOpen, setAnswerOpen] = useState(false);
  const [draft, setDraft] = useState<Record<number, string>>({
    0: questions[0].answer,
    1: questions[1].answer,
  });
  const isComplete = questions.every((_, index) => (draft[index] ?? "").trim().length > 0);

  return (
    <main className="met-preview" aria-label="Met network questionnaire sample">
      <div className="met-status">
        <span>9:41</span><i className="met-status-island" aria-hidden="true" />
        <span className="met-status-right"><i className="met-signal" /><i className="met-battery" /></span>
      </div>
      <section className="met-network-hero">
        <div className="met-network-back"><ArrowLeft size={20} /><span>Networks</span></div>
        <div className="met-network-avatar"><MapPin size={29} strokeWidth={1.8} /></div>
        <div className="met-network-sample">SAMPLE NETWORK</div>
        <h1 className="met-network-name">River District</h1>
      </section>
      <nav className="met-network-tabs" role="tablist" aria-label="Network sections">
        {(["Feed", "Members", "Info"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`met-network-tab${activeTab === tab ? " selected" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      <section className="met-network-feed">
        {activeTab === "Feed" ? (
          <>
            <article className="met-feed-card">
              <div className="met-feed-head">
                <div className="met-feed-kind"><span className="met-type-icon"><HelpCircle size={14} /></span><strong>Questionnaire</strong></div>
                <span className="met-feed-time">SAMPLE</span>
              </div>
              <div className="met-author"><span className="met-author-avatar">SM</span>Sample member</div>
              <p className="met-feed-copy">Community questions for network members.</p>
              <div className="met-qa-list">
                {questions.map((question, index) => (
                  <div className="met-qa-row" key={question.prompt}>
                    <HelpCircle className="met-qa-help" size={13} />
                    <div>
                      <div className="met-qa-prompt">{index + 1}. {question.prompt}</div>
                      <p className="met-qa-answer">→ {draft[index] || question.answer}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="met-answer-btn answered" type="button" onClick={() => setAnswerOpen(true)}>
                <Edit2 size={13} /> Answered
              </button>
            </article>
            <p className="met-sample-note">Sample network questionnaire — not a venue FAQ. Venue managers do not create these questionnaires.</p>
          </>
        ) : activeTab === "Members" ? (
          <div className="met-tab-sample">Member names are omitted from this sample.</div>
        ) : (
          <div className="met-tab-sample">A sample neighborhood network on Met.</div>
        )}
      </section>
      {answerOpen && (
        <div className="met-modal-backdrop" role="presentation" onClick={() => setAnswerOpen(false)}>
          <section className="met-modal" role="dialog" aria-modal="true" aria-labelledby="met-questionnaire-modal-title" onClick={(event) => event.stopPropagation()}>
            <header className="met-modal-header">
              <button type="button" onClick={() => setAnswerOpen(false)}>Cancel</button>
              <strong id="met-questionnaire-modal-title">Answer questions</strong>
              <button type="button" aria-label="Close" onClick={() => setAnswerOpen(false)}><X size={17} /></button>
            </header>
            {questions.map((question, index) => (
              <div key={question.prompt}>
                <p className="met-modal-question">{index + 1}. {question.prompt}</p>
                <textarea
                  className="met-modal-answer"
                  value={draft[index] ?? ""}
                  onChange={(event) => setDraft((current) => ({ ...current, [index]: event.target.value }))}
                  placeholder="Your answer…"
                />
              </div>
            ))}
            <button className="met-modal-submit" type="button" disabled={!isComplete} onClick={() => setAnswerOpen(false)}>
              Submit
            </button>
          </section>
        </div>
      )}
      <span className="met-home-indicator" aria-hidden="true" />
    </main>
  );
}
