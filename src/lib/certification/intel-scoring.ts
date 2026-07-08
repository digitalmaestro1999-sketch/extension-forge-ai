// Merge competitive intel into a CertReport, adding a "Market Fit" category
// and surfacing threats / high-impact gaps as informational or warning issues.

import type { CertIssue, CategoryScore, CertReport } from "./index";

export interface IntelGapReportLike {
  overall_score: number | null;
  missing_features: Array<{ feature: string; impact?: string; effort?: string; presentIn?: string[] }>;
  threats: Array<{ title: string; detail?: string; mitigation?: string }>;
  opportunities: Array<{ title: string; priority?: string; action?: string; rationale?: string }>;
  keywords: Array<{ keyword: string; usedByCompetitors?: number; recommend?: boolean }>;
  differentiators: Array<{ feature: string; why?: string }>;
  summary: string | null;
  competitor_ids: string[];
  created_at?: string;
}

function truncId(s: string, n = 24): string {
  return s.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, n);
}

export function mergeIntel(report: CertReport, gap: IntelGapReportLike | null): CertReport {
  const extraIssues: CertIssue[] = [];
  let marketScore = 100;
  let crit = 0, warn = 0, info = 0;

  if (!gap || !gap.competitor_ids?.length) {
    extraIssues.push({
      category: "market",
      id: "intel-missing",
      severity: "info",
      file: "intel",
      message: "No competitive intel available for this extension.",
      fix: "Run Competition Intelligence → Discover competitors → Gap Analysis to enable Market Fit scoring.",
    });
    info++;
    marketScore = 70; // neutral penalty for absence of data
  } else {
    if (typeof gap.overall_score === "number") marketScore = Math.max(0, Math.min(100, gap.overall_score));

    for (const t of (gap.threats ?? []).slice(0, 5)) {
      extraIssues.push({
        category: "market",
        id: `threat-${truncId(t.title)}`,
        severity: "warning",
        file: "intel",
        message: `Competitive threat: ${t.title}${t.detail ? ` — ${t.detail}` : ""}`,
        fix: t.mitigation || "See gap report for mitigation strategy.",
      });
      warn++;
    }

    const highImpact = (gap.missing_features ?? []).filter(f => (f.impact ?? "").toLowerCase() === "high");
    for (const f of highImpact.slice(0, 5)) {
      extraIssues.push({
        category: "market",
        id: `gap-${truncId(f.feature)}`,
        severity: "warning",
        file: "intel",
        message: `Missing high-impact feature: ${f.feature}${f.presentIn?.length ? ` (present in ${f.presentIn.length} competitor${f.presentIn.length > 1 ? "s" : ""})` : ""}`,
        fix: `Implement ${f.feature}${f.effort ? ` (effort: ${f.effort})` : ""}.`,
      });
      warn++;
    }

    const highOpps = (gap.opportunities ?? []).filter(o => (o.priority ?? "").toLowerCase() === "high");
    for (const o of highOpps.slice(0, 3)) {
      extraIssues.push({
        category: "market",
        id: `opp-${truncId(o.title)}`,
        severity: "info",
        file: "intel",
        message: `Opportunity: ${o.title}${o.rationale ? ` — ${o.rationale}` : ""}`,
        fix: o.action || "Prioritise on next roadmap review.",
      });
      info++;
    }

    const recKeywords = (gap.keywords ?? []).filter(k => k.recommend).slice(0, 5);
    if (recKeywords.length) {
      extraIssues.push({
        category: "market",
        id: "kw-recommend",
        severity: "info",
        file: "intel",
        message: `Recommended CWS keywords: ${recKeywords.map(k => k.keyword).join(", ")}`,
        fix: "Weave these into store title, short description, and long description.",
      });
      info++;
    }
  }

  const marketCat: CategoryScore = {
    key: "market",
    label: "Market Fit",
    weight: 10,
    score: Math.round(marketScore),
    critical: crit,
    warning: warn,
    info,
  };

  const categories = [...report.categories, marketCat];
  const totalW = categories.reduce((a, c) => a + c.weight, 0);
  const overall = Math.round(
    categories.reduce((a, c) => a + c.score * c.weight, 0) / totalW,
  );

  const criticals = report.criticals + crit;
  const warnings = report.warnings + warn;
  const passProbability =
    criticals === 0 && overall >= 90 ? "High" :
    criticals <= 1 && overall >= 75 ? "Medium" : "Low";

  const issues = [...report.issues, ...extraIssues].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 } as const;
    return order[a.severity] - order[b.severity] || a.category.localeCompare(b.category);
  });

  return {
    ...report,
    overall,
    categories,
    criticals,
    warnings,
    passProbability,
    issues,
  };
}
