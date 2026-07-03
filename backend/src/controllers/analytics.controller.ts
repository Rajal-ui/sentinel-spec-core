import type { Response, NextFunction } from 'express'
import { prisma } from '../config/database.js'
import type { AuthenticatedRequest } from '../types/index.js'

// ── GET /api/v1/analytics/summary ─────────────────────────────────────

export async function getSummary(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const allFindings = await prisma.finding.findMany({
      include: { overrides: true },
    })

    const total = allFindings.length

    // ── KPI computations ──────────────────────────────────────────
    const blockingOrWarning = allFindings.filter(
      (f) => f.tier === 'blocking' || f.tier === 'warning',
    )
    const violationsBlockedPct =
      total > 0
        ? Math.round((blockingOrWarning.length / total) * 1000) / 10
        : 0

    const withOverrides = allFindings.filter((f) => f.overrides.length > 0)
    const overrideRatePct =
      total > 0
        ? Math.round((withOverrides.length / total) * 1000) / 10
        : 0

    const resolved = allFindings.filter((f) => f.status === 'RESOLVED')
    const resolutionRatePct =
      total > 0
        ? Math.round((resolved.length / total) * 1000) / 10
        : 0

    const avgConfidence =
      total > 0
        ? Math.round(
            (allFindings.reduce((s, f) => s + f.confidence, 0) / total) * 100,
          ) / 100
        : 0

    // ── Trend: violations over time (grouped by date) ──────────────
    const trendMap = new Map<string, { blocking: number; warning: number }>()
    for (const f of allFindings) {
      const date = f.timestamp
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!trendMap.has(date)) {
        trendMap.set(date, { blocking: 0, warning: 0 })
      }
      const entry = trendMap.get(date)!
      if (f.tier === 'blocking') entry.blocking++
      else if (f.tier === 'warning') entry.warning++
    }
    const trendData = Array.from(trendMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))

    // ── Domain breakdown ──────────────────────────────────────────
    const domainMap = new Map<string, number>()
    for (const f of allFindings) {
      const domain = f.policyDomain ?? 'unknown'
      domainMap.set(domain, (domainMap.get(domain) ?? 0) + 1)
    }
    const domainData = Array.from(domainMap.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)

    // ── Override rate trend (by month) ────────────────────────────
    const monthOverrideMap = new Map<string, { total: number; overridden: number }>()
    for (const f of allFindings) {
      const month = f.timestamp.toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      })
      if (!monthOverrideMap.has(month)) {
        monthOverrideMap.set(month, { total: 0, overridden: 0 })
      }
      const entry = monthOverrideMap.get(month)!
      entry.total++
      if (f.overrides.length > 0) entry.overridden++
    }
    const overrideTrend = Array.from(monthOverrideMap.entries())
      .map(([month, data]) => ({
        week: month,
        rate:
          data.total > 0
            ? Math.round((data.overridden / data.total) * 100 * 10) / 10
            : 0,
      }))

    // ── Team / Repo leaderboard ───────────────────────────────────
    const repoMap = new Map<
      string,
      { violations: number; overrideCount: number; domains: Set<string> }
    >()
    for (const f of allFindings) {
      if (!repoMap.has(f.repo)) {
        repoMap.set(f.repo, {
          violations: 0,
          overrideCount: 0,
          domains: new Set(),
        })
      }
      const entry = repoMap.get(f.repo)!
      entry.violations++
      if (f.overrides.length > 0) entry.overrideCount++
      if (f.policyDomain) entry.domains.add(f.policyDomain)
    }
    const leaderboard = Array.from(repoMap.entries())
      .map(([repo, data]) => ({
        repo,
        team: repo.split('-')[0] ?? repo,
        violations: data.violations,
        override_rate:
          data.violations > 0
            ? Math.round((data.overrideCount / data.violations) * 100 * 10) / 10
            : 0,
        capture_rate: 0,
        top_domain:
          Array.from(data.domains).sort((a, b) => a.localeCompare(b))[0] ?? 'unknown',
      }))
      .sort((a, b) => b.violations - a.violations)

    res.json({
      total_analyses: total,
      violations_blocked_pct: violationsBlockedPct,
      override_rate_pct: overrideRatePct,
      resolution_rate_pct: resolutionRatePct,
      avg_confidence: avgConfidence,
      trend_data: trendData,
      domain_data: domainData,
      override_trend: overrideTrend,
      leaderboard,
    })
  } catch (err) {
    next(err)
  }
}
