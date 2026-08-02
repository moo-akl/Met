import React, { useState } from "react";

type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "resubmitted"
  | "rejected"
  | "approved";

type StatusResult = {
  placeName: string;
  status: ApplicationStatus;
  statusLabel: string;
  submittedAt: string | null;
};

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { icon: string; bg: string; border: string; heading: string; body: string }
> = {
  submitted: {
    icon: "⏳",
    bg: "bg-blue-50",
    border: "border-blue-200",
    heading: "Application received",
    body: "Your application is in our queue. We review every submission carefully — usually within a few business days.",
  },
  under_review: {
    icon: "🔍",
    bg: "bg-blue-50",
    border: "border-blue-200",
    heading: "Under review",
    body: "Our team is actively reviewing your application. We'll be in touch soon.",
  },
  changes_requested: {
    icon: "📋",
    bg: "bg-amber-50",
    border: "border-amber-200",
    heading: "Changes requested",
    body: "We've reached out by email with some questions or changes needed before we can proceed. Please check your inbox.",
  },
  resubmitted: {
    icon: "🔄",
    bg: "bg-blue-50",
    border: "border-blue-200",
    heading: "Resubmitted — under review",
    body: "We received your updated application and are reviewing it now.",
  },
  rejected: {
    icon: "✕",
    bg: "bg-red-50",
    border: "border-red-200",
    heading: "Not approved",
    body: "Unfortunately we weren't able to approve this application. If you believe this is an error, please contact us.",
  },
  approved: {
    icon: "✓",
    bg: "bg-green-50",
    border: "border-green-200",
    heading: "Approved!",
    body: "Congratulations — your venue application was approved. Check your email for your registration link.",
  },
};

export default function VenueApplyStatus() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StatusResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/venue-owner/apply/status?email=${encodeURIComponent(trimmed)}`,
      );
      if (res.status === 404) {
        setError("No application found for that email address. Double-check the address you used when applying.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setError(body.message ?? "Something went wrong. Please try again.");
        return;
      }
      const data = (await res.json()) as StatusResult;
      setResult(data);
    } catch {
      setError("Unable to reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const config = result ? STATUS_CONFIG[result.status] ?? null : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/70 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-lg mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="text-lg font-black tracking-tighter text-gray-900">MET</a>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Application Status</span>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-2">
          Check your application
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Enter the email address you used when applying to see the current status of your venue application.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-semibold text-gray-700 mb-1.5">
              Email address
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setResult(null);
                setError(null);
              }}
              placeholder="you@yourvenue.com"
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
          </label>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-3 rounded-full bg-gray-900 text-white text-sm font-bold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Checking…" : "Check status"}
          </button>
        </form>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-2xl px-4 py-3 text-sm font-medium bg-red-50 border border-red-200 text-red-700"
          >
            {error}
          </div>
        )}

        {result && config && (
          <div className={`mt-6 rounded-2xl border px-5 py-5 ${config.bg} ${config.border}`}>
            <div className="flex items-start gap-4">
              <span className="text-2xl leading-none mt-0.5" aria-hidden="true">
                {config.icon}
              </span>
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-base mb-1">{config.heading}</p>
                <p className="text-sm text-gray-700 mb-3">{config.body}</p>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>
                    <span className="font-semibold">Venue:</span>{" "}
                    {result.placeName}
                  </p>
                  {result.submittedAt && (
                    <p>
                      <span className="font-semibold">Submitted:</span>{" "}
                      {new Date(result.submittedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-gray-400">
          Want to apply?{" "}
          <a href="/apply" className="text-green-600 font-semibold hover:underline">
            Submit an application →
          </a>
        </p>
      </div>
    </div>
  );
}
