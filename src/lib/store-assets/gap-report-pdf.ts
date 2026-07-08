// PDF export for gap reports using jsPDF.
import jsPDF from "jspdf";

interface Listing {
  id: string;
  name: string | null;
  developer: string | null;
  cws_url: string;
  rating: number | null;
  rating_count: number | null;
  user_count: string | null;
  version: string | null;
  update_cadence: { daysSinceUpdate?: number; freshness?: string } | null;
}

interface GapReport {
  id: string;
  extension_name: string | null;
  category: string | null;
  competitor_ids: string[];
  summary: string | null;
  missing_features: { feature: string; presentIn?: string[]; impact?: string; effort?: string }[];
  differentiators: { feature: string; why: string }[];
  opportunities: { title: string; rationale: string; action: string; priority: string }[];
  threats: { title: string; detail: string; mitigation: string }[];
  keywords: { keyword: string; usedByCompetitors?: number; recommend?: boolean }[];
  overall_score: number | null;
  created_at: string;
}

export function exportGapReportPdf(r: GapReport, listings: Listing[]): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const heading = (text: string, size = 16) => {
    ensureSpace(size + 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(20, 20, 20);
    doc.text(text, margin, y);
    y += size + 6;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 10;
  };

  const body = (text: string, opts: { bold?: boolean; size?: number; color?: [number, number, number] } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 10);
    doc.setTextColor(...(opts.color ?? [40, 40, 40]));
    const lines = doc.splitTextToSize(text, contentW);
    for (const line of lines) {
      ensureSpace(14);
      doc.text(line, margin, y);
      y += 13;
    }
  };

  const bullet = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, contentW - 14);
    ensureSpace(14);
    doc.text("•", margin, y);
    doc.text(lines, margin + 14, y);
    y += 13 * lines.length + 2;
  };

  // Cover
  doc.setFillColor(20, 30, 50);
  doc.rect(0, 0, pageW, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Competitive Gap Report", margin, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(r.extension_name ?? "Extension", margin, 62);
  doc.setFontSize(9);
  doc.setTextColor(200, 210, 220);
  doc.text(
    `Generated ${new Date(r.created_at).toLocaleString()}${r.category ? ` · ${r.category}` : ""}`,
    margin,
    78,
  );
  y = 110;

  if (typeof r.overall_score === "number") {
    heading("Competitive Score", 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(30, 80, 200);
    doc.text(`${r.overall_score}/100`, margin, y + 12);
    y += 40;
  }

  if (r.summary) {
    heading("Executive Summary", 14);
    body(r.summary);
    y += 6;
  }

  const comps = listings.filter(l => r.competitor_ids.includes(l.id));
  if (comps.length) {
    heading(`Competitors Analysed (${comps.length})`, 14);
    for (const c of comps) {
      const stats = [
        c.rating ? `${c.rating}★${c.rating_count ? ` (${c.rating_count.toLocaleString()})` : ""}` : null,
        c.user_count ? `${c.user_count} users` : null,
        c.version ? `v${c.version}` : null,
        c.update_cadence?.freshness ? `${c.update_cadence.freshness}` : null,
      ].filter(Boolean).join(" · ");
      bullet(`${c.name ?? "unknown"}${c.developer ? ` — ${c.developer}` : ""}${stats ? `  [${stats}]` : ""}`);
    }
    y += 4;
  }

  if (r.missing_features?.length) {
    heading("Missing Features", 14);
    for (const f of r.missing_features) {
      bullet(`${f.feature}${f.impact ? `  (impact: ${f.impact}${f.effort ? `, effort: ${f.effort}` : ""})` : ""}${f.presentIn?.length ? `\n   Seen in: ${f.presentIn.join(", ")}` : ""}`);
    }
    y += 4;
  }

  if (r.differentiators?.length) {
    heading("Your Differentiators", 14);
    for (const d of r.differentiators) bullet(`${d.feature} — ${d.why}`);
    y += 4;
  }

  if (r.opportunities?.length) {
    heading("Opportunities", 14);
    for (const o of r.opportunities) {
      bullet(`[${o.priority}] ${o.title}\n   Why: ${o.rationale}\n   Action: ${o.action}`);
    }
    y += 4;
  }

  if (r.threats?.length) {
    heading("Threats", 14);
    for (const t of r.threats) {
      bullet(`${t.title}\n   ${t.detail}\n   Mitigation: ${t.mitigation}`);
    }
    y += 4;
  }

  if (r.keywords?.length) {
    heading("Keyword Gaps", 14);
    const kwLine = r.keywords
      .map(k => `${k.recommend ? "★ " : ""}${k.keyword}${typeof k.usedByCompetitors === "number" ? ` (${k.usedByCompetitors})` : ""}`)
      .join(", ");
    body(kwLine);
  }

  // Footer on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Page ${i} / ${total}`, pageW - margin, pageH - 20, { align: "right" });
    doc.text("Extension Forge AI · Competitive Intelligence", margin, pageH - 20);
  }

  doc.save(`gap-report-${(r.extension_name ?? "extension").replace(/\s+/g, "-").toLowerCase()}-${r.id.slice(0, 8)}.pdf`);
}
