import React, { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";

type PlaceResult = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type FormData = {
  contactEmail: string;
  contactName: string;
  place: PlaceResult | null;
  tagline: string;
  description: string;
  verificationDocUrl: string;
  registrationNotes: string;
};

const STEPS = [
  "Your contact details",
  "Find your venue",
  "About your venue",
  "Proof of ownership",
  "Review & submit",
];

export default function VenueApply() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({
    contactEmail: "",
    contactName: "",
    place: null,
    tagline: "",
    description: "",
    verificationDocUrl: "",
    registrationNotes: "",
  });
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<{ message: string; isPending: boolean } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/venue-owner/places-public/search?query=${encodeURIComponent(search)}`,
        );
        if (res.ok) {
          const json = (await res.json()) as { places: PlaceResult[] };
          setResults(json.places);
        }
      } catch {
        /* ignore search errors */
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/venue-owner/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactEmail: form.contactEmail,
          contactName: form.contactName,
          placeId: form.place!.placeId,
          placeName: form.place!.name,
          businessName: form.place!.name,
          lat: form.place!.lat,
          lng: form.place!.lng,
          tagline: form.tagline || null,
          description: form.description || null,
          verificationDocUrl: form.verificationDocUrl,
          registrationNotes: form.registrationNotes || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        const isPending = res.status === 409;
        throw Object.assign(
          new Error(body.message ?? "Submission failed. Please try again."),
          { status: res.status, isPending },
        );
      }
    },
    onSuccess: () => {
      setError(null);
      setSubmitted(true);
    },
    onError: (e: unknown) => {
      const err = e as Error & { status?: number; isPending?: boolean };
      setError({
        message: err.message || "Submission failed. Please try again.",
        isPending: err.isPending ?? false,
      });
    },
  });

  if (submitted) {
    return (
      <Page>
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Application received.</h1>
          <p className="text-gray-600 mb-2">
            We review every application carefully — usually within a few business days.
          </p>
          <p className="text-gray-600">
            When approved, you'll receive your registration link at{" "}
            <strong className="text-gray-900">{form.contactEmail}</strong>.
          </p>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/70 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-lg mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="text-lg font-black tracking-tighter text-gray-900">MET</a>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Venue Application</span>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-6 max-w-lg mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center gap-1 mb-3">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i + 1 < step
                    ? "bg-green-500"
                    : i + 1 === step
                    ? "bg-green-400"
                    : "bg-gray-100"
                }`}
              />
            ))}
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Step {step} of {STEPS.length} — {STEPS[step - 1]}
          </p>
        </div>

        <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-1">List your venue on Met.</h1>
        <p className="text-gray-500 text-sm mb-8">
          Reach guests who are already at your door. Apply to become a Met partner venue.
        </p>

        {/* Step 1 — Contact details */}
        {step === 1 && (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setForm((d) => ({
                ...d,
                contactName: String(f.get("name")).trim(),
                contactEmail: String(f.get("email")).trim(),
              }));
              setError(null);
              setStep(2);
            }}
          >
            <Field label="Your full name">
              <input
                required
                name="name"
                autoComplete="name"
                defaultValue={form.contactName}
                placeholder="Sarah Johnson"
                className={inputClass}
              />
            </Field>
            <Field label="Your email address">
              <input
                required
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={form.contactEmail}
                placeholder="you@yourvenue.com"
                className={inputClass}
              />
            </Field>
            <Actions onBack={null} submitLabel="Next →" />
          </form>
        )}

        {/* Step 2 — Find venue */}
        {step === 2 && (
          <div className="space-y-5">
            <Field label="Search for your venue">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (form.place) setForm((d) => ({ ...d, place: null }));
                }}
                placeholder="Type your venue name or address"
                className={inputClass}
                autoFocus
              />
            </Field>
            {searching && (
              <p className="text-sm text-gray-400">Searching…</p>
            )}
            {results.length > 0 && !form.place && (
              <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
                {results.map((p) => (
                  <button
                    key={p.placeId}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors"
                    onClick={() => {
                      setForm((d) => ({ ...d, place: p }));
                      setSearch(p.name);
                      setResults([]);
                    }}
                  >
                    <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.address}</p>
                  </button>
                ))}
              </div>
            )}
            {form.place && (
              <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                <p className="text-sm font-semibold text-green-800">✓ {form.place.name}</p>
                <p className="text-xs text-green-600">{form.place.address}</p>
              </div>
            )}
            <Actions onBack={() => setStep(1)} disabled={!form.place} submitLabel="Next →" onSubmit={() => { setError(null); setStep(3); }} />
          </div>
        )}

        {/* Step 3 — About venue */}
        {step === 3 && (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setForm((d) => ({
                ...d,
                tagline: String(f.get("tagline") ?? "").trim(),
                description: String(f.get("description") ?? "").trim(),
              }));
              setStep(4);
            }}
          >
            <Field label="Tagline" optional>
              <input
                name="tagline"
                maxLength={160}
                defaultValue={form.tagline}
                placeholder="The rooftop bar where the city meets the sky."
                className={inputClass}
              />
            </Field>
            <Field label="Description" optional>
              <textarea
                name="description"
                rows={4}
                maxLength={1000}
                defaultValue={form.description}
                placeholder="Tell potential guests about the vibe, what you offer, what to expect…"
                className={`${inputClass} resize-none`}
              />
            </Field>
            <Actions onBack={() => setStep(2)} submitLabel="Next →" />
          </form>
        )}

        {/* Step 4 — Proof of ownership */}
        {step === 4 && (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setForm((d) => ({
                ...d,
                verificationDocUrl: String(f.get("docUrl")).trim(),
                registrationNotes: String(f.get("notes") ?? "").trim(),
              }));
              setError(null);
              setStep(5);
            }}
          >
            <p className="text-sm text-gray-500">
              Upload your proof of ownership to Google Drive, Dropbox, or similar and paste the link below.
              Accepted: business licence, lease agreement, utility bill addressed to the venue.
            </p>
            <Field label="Document link">
              <input
                required
                name="docUrl"
                type="url"
                defaultValue={form.verificationDocUrl}
                placeholder="https://drive.google.com/…"
                className={inputClass}
              />
            </Field>
            <Field label="Additional notes" optional>
              <textarea
                name="notes"
                rows={3}
                maxLength={500}
                defaultValue={form.registrationNotes}
                placeholder="Anything else you'd like us to know…"
                className={`${inputClass} resize-none`}
              />
            </Field>
            <Actions onBack={() => setStep(3)} submitLabel="Review →" />
          </form>
        )}

        {/* Step 5 — Review & submit */}
        {step === 5 && (
          <div className="space-y-5">
            {/* Inline error — shown for all errors including 409 */}
            {error && (
              <div
                role="alert"
                className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                  error.isPending
                    ? "bg-amber-50 border border-amber-200 text-amber-800"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {error.isPending ? (
                  <>
                    <span className="font-bold">Already submitted — </span>
                    {error.message}
                  </>
                ) : (
                  error.message
                )}
              </div>
            )}

            <div className="border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
              <ReviewRow label="Name" value={form.contactName} />
              <ReviewRow label="Email" value={form.contactEmail} />
              <ReviewRow label="Venue" value={form.place?.name ?? ""} />
              {form.tagline && <ReviewRow label="Tagline" value={form.tagline} />}
              <div className="px-4 py-3 flex items-start gap-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-0.5 w-20 shrink-0">Doc</span>
                <a
                  href={form.verificationDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-600 font-medium hover:underline break-all"
                >
                  View document
                </a>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex-1 py-3 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={submit.isPending}
                onClick={() => {
                  setError(null);
                  submit.mutate();
                }}
                className="flex-1 py-3 rounded-full bg-gray-900 text-white text-sm font-bold hover:bg-green-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submit.isPending ? "Submitting…" : "Submit application"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}

/* ---- helpers ---- */

const inputClass =
  "w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition";

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
        {optional && (
          <span className="ml-1.5 text-xs font-normal text-gray-400">optional</span>
        )}
      </span>
      {children}
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-0.5 w-20 shrink-0">
        {label}
      </span>
      <span className="text-sm font-semibold text-gray-900 break-words min-w-0">{value}</span>
    </div>
  );
}

function Actions({
  onBack,
  submitLabel,
  disabled,
  onSubmit,
}: {
  onBack: (() => void) | null;
  submitLabel: string;
  disabled?: boolean;
  onSubmit?: () => void;
}) {
  return (
    <div className="flex gap-3 pt-2">
      {onBack ? (
        <button
          type={onSubmit ? "button" : "button"}
          onClick={onBack}
          className="flex-1 py-3 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ← Back
        </button>
      ) : (
        <div className="flex-1" />
      )}
      <button
        type={onSubmit ? "button" : "submit"}
        disabled={disabled}
        onClick={onSubmit}
        className="flex-1 py-3 rounded-full bg-gray-900 text-white text-sm font-bold hover:bg-green-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitLabel}
      </button>
    </div>
  );
}
