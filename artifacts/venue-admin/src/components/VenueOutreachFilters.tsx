import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_WORKLIST_FILTERS, type WorklistFilters, type WorklistSort } from "./venue-outreach-worklist";

export function emailTemplateLabel(value: string): string {
  const labels: Record<string, string> = {
    latest_updates_prospect: "Latest updates — contacted venues",
    latest_updates: "Latest updates — venue managers",
    preapproval_video_application: "Video introduction & application",
    registration_with_video: "Registration link with video",
    registration: "Registration link",
    met_launch_with_links: "Met launch with download links",
    met_launch_without_links: "Met launch without download links",
  };
  return labels[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type Props = {
  filters: WorklistFilters;
  onChange: (filters: WorklistFilters) => void;
  sort: WorklistSort;
  onSortChange: (sort: WorklistSort) => void;
  templates: string[];
  templateLabels?: Record<string, string>;
  counts: { total: number; attention: number; followup: number };
  resultCount: number;
};

export default function VenueOutreachFilters({ filters, onChange, sort, onSortChange, templates, templateLabels = {}, counts, resultCount }: Props) {
  const [expanded, setExpanded] = useState(false);
  const set = (key: keyof WorklistFilters, value: string) => onChange({ ...filters, [key]: value });
  const fields: { key: keyof WorklistFilters; title: string; options: [string, string][]; testId: string }[] = [
    { key: "lastTemplate", title: "Last email template sent", testId: "select-outreach-last-template-filter",
      options: [["all", "All templates"], ["none", "No successful email"], ...templates.map((template): [string, string] => [template, templateLabels[template] ?? emailTemplateLabel(template)])] },
    { key: "status", title: "Latest delivery status", testId: "select-outreach-status-filter",
      options: [["all", "All delivery states"], ["sent", "Sent"], ["sending", "Sending"], ["delivery_uncertain", "Check Gmail Sent"], ["failed", "Failed"]] },
    { key: "application", title: "Application", testId: "select-outreach-application-filter",
      options: [["all", "All applications"], ["linked", "Has an application"], ["unlinked", "No application"], ["approved", "Approved"]] },
    { key: "agent", title: "Assigned agent", testId: "select-outreach-agent-filter",
      options: [["all", "All agents"], ["assigned", "Assigned"], ["unassigned", "Unassigned"]] },
    { key: "followUp", title: "Follow-up plan", testId: "select-outreach-follow-up-filter",
      options: [["all", "All follow-ups"], ["scheduled", "Plan recorded"], ["unscheduled", "No plan"]] },
    { key: "link", title: "Most recent invitation link", testId: "select-outreach-link-filter",
      options: [["all", "All link states"], ["none", "No link"], ["active", "Active"], ["expired", "Expired"], ["used", "Used"], ["superseded", "Superseded"], ["unknown", "Unknown"]] },
    { key: "kind", title: "Email history includes", testId: "select-outreach-kind-filter",
      options: [["all", "All email types"], ["new_venue_outreach", "Venue outreach"], ["contact_request", "Contact request"], ["registration_invite", "Registration invitation"], ["manager_announcement", "Announcement"]] },
  ];
  const activeFields = fields.filter((field) => filters[field.key] !== "all");
  const views = [
    { value: "all" as const, label: "All invited venues", count: counts.total },
    { value: "followup" as const, label: "Follow-ups due", count: counts.followup },
    { value: "attention" as const, label: "Email problems", count: counts.attention },
  ];
  return (
    <div className="border-b border-slate-300/80 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Venue views">
        {views.map((view) => (
          <Button key={view.value} type="button" variant={filters.view === view.value ? "default" : "outline"}
            aria-pressed={filters.view === view.value} data-testid={`button-outreach-view-${view.value}`}
            onClick={() => set("view", view.value)}
            className={filters.view === view.value ? "bg-[#25324a] text-white" : "border-slate-300 bg-white text-slate-700"}>
            {view.label} <span className="ml-2 opacity-75">{view.count}</span>
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 text-xs font-medium text-slate-600">
          Search venue or email
          <span className="relative mt-1.5 block">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input type="search" value={filters.search} onChange={(event) => set("search", event.target.value)}
              data-testid="input-search-outreach-history" placeholder="Venue name or email address"
              className="h-10 border-slate-300 bg-white pl-10" />
          </span>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Sort by
          <select value={sort} onChange={(event) => onSortChange(event.target.value as WorklistSort)}
            data-testid="select-outreach-sort" className="mt-1.5 block h-10 max-w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700">
            <option value="recent">Last emailed — newest first</option>
            <option value="venue">Venue name — A to Z</option>
            <option value="followup">Follow-up date — soonest first</option>
          </select>
        </label>
        <Button type="button" variant="outline" aria-expanded={expanded} aria-controls="outreach-more-filters"
          onClick={() => setExpanded(!expanded)} data-testid="button-outreach-more-filters" className="h-10 gap-2 border-slate-300 bg-white">
          <SlidersHorizontal className="h-4 w-4" /> More filters{activeFields.length > 0 ? ` (${activeFields.length})` : ""}
        </Button>
      </div>
      {expanded && (
        <div id="outreach-more-filters" className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {fields.map((field) => (
              <label key={field.key} className="min-w-0 text-xs font-medium text-slate-600">
                {field.title}
                <select value={filters[field.key]} onChange={(event) => set(field.key, event.target.value)}
                  data-testid={field.testId} className="mt-1.5 block h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700">
                  {field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Last email template sent uses the latest successful send. Failed, sending, and uncertain attempts do not replace it.</p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span role="status">{resultCount} of {counts.total} venues</span>
        {activeFields.map((field) => (
          <button type="button" key={field.key} onClick={() => set(field.key, "all")} aria-label={`Remove ${field.title} filter`}
            className="flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1">
            {field.title}: {field.options.find(([value]) => value === filters[field.key])?.[1] ?? filters[field.key]}
            <X className="h-3 w-3" />
          </button>
        ))}
        {(activeFields.length > 0 || filters.search || filters.view !== "all") && (
          <button type="button" onClick={() => onChange({ ...DEFAULT_WORKLIST_FILTERS })}
            data-testid="button-clear-outreach-filters" className="font-semibold underline underline-offset-2">Clear filters</button>
        )}
      </div>
    </div>
  );
}
