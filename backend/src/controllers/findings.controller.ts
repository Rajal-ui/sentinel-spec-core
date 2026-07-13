import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database.js'
import { NotFoundError, ValidationError } from '../utils/errors.js'

// ── Validation schemas ────────────────────────────────────────────────

export const listQuerySchema = z.object({
  status: z.string().optional(),
  tier: z.string().optional(),
  policyDomain: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  override: z.enum(['all', 'overridden', 'not_overridden']).optional(),
  confidenceMin: z.coerce.number().min(0).max(100).optional(),
  confidenceMax: z.coerce.number().min(0).max(100).optional(),
})

export const resolveBodySchema = z.object({
  patchDiff: z.string().optional(),
})

// ── Transform: Prisma Finding → GovernanceRecord shape ──────────────

function toGovernanceRecord(finding: {
  id: string
  recordId: string
  tier: string
  confidence: number
  title: string
  description: string
  citedAdr: string
  citedText: string
  sourceDocument: string
  diffOld: string
  diffNew: string
  traceId: string
  timestamp: Date
  actor: string
  repo: string
  filename: string | null
  trigger: string
  diffId: string
  violatesPolicy: boolean
  criticEntailed: boolean | null
  criticReasoning: string | null
  status: string
  resolvedAt: Date | null
  patchDiff: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overrides: any[]
}) {
  return {
    record_id: finding.recordId,
    timestamp: finding.timestamp.toISOString(),
    trigger: finding.trigger,
    actor: finding.actor,
    repo: finding.repo,
    filename: finding.filename ?? undefined,
    diff_id: finding.diffId,
    classification: {
      violates_policy: finding.violatesPolicy,
      confidence: finding.confidence,
      cited_chunk_ids: [] as string[],
    },
    critic_verdict: {
      entailed: finding.criticEntailed ?? false,
      reasoning: finding.criticReasoning ?? '',
    },
    finding_tier: finding.tier,
    status: finding.status as 'OPEN' | 'RESOLVED',
    resolved_at: finding.resolvedAt?.toISOString() ?? null,
    override: {
      occurred: finding.overrides.length > 0,
      actor: finding.overrides[0]?.actor ?? null,
      justification: finding.overrides[0]?.justification ?? null,
    },
  }
}

// ── GET /api/v1/findings ──────────────────────────────────────────────

export async function listFindings(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      )
    }
    const query = parsed.data

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (query.status) {
      where.status = query.status.toUpperCase()
    }
    if (query.tier) {
      const tiers = query.tier.split(',').map((t) => t.trim().toLowerCase())
      where.tier = { in: tiers }
    }
    if (query.policyDomain) {
      where.policyDomain = query.policyDomain
    }
    if (query.dateFrom || query.dateTo) {
      where.timestamp = {}
      if (query.dateFrom) {
        where.timestamp.gte = new Date(query.dateFrom)
      }
      if (query.dateTo) {
        where.timestamp.lte = new Date(query.dateTo + 'T23:59:59.999Z')
      }
    }
    if (query.confidenceMin !== undefined || query.confidenceMax !== undefined) {
      where.confidence = {}
      if (query.confidenceMin !== undefined) {
        where.confidence.gte = query.confidenceMin / 100
      }
      if (query.confidenceMax !== undefined) {
        where.confidence.lte = query.confidenceMax / 100
      }
    }
    if (query.override === 'overridden') {
      where.overrides = { some: {} }
    } else if (query.override === 'not_overridden') {
      where.overrides = { none: {} }
    }

    const findings = await prisma.finding.findMany({
      where,
      include: { overrides: true },
      orderBy: { timestamp: 'desc' },
    })

    const records = findings.map(toGovernanceRecord)

    res.json({ findings: records, total: records.length })
  } catch (err) {
    next(err)
  }
}

// ── POST /api/v1/findings/bulk ───────────────────────────────────────

export const bulkCreateSchema = z.object({
  repo: z.string().min(1),
  actor: z.string().min(1),
  trigger: z.string().min(1),
  diff_id: z.string().min(1),
  findings: z.array(
    z.object({
      id: z.string().min(1),
      tier: z.string().min(1),
      confidence: z.number().min(0).max(1),
      title: z.string().min(1),
      description: z.string().min(1),
      cited_adr: z.string(),
      cited_text: z.string(),
      source_document: z.string(),
      diff_old: z.string(),
      diff_new: z.string(),
      trace_id: z.string(),
      timestamp: z.string(),
      record_id: z.string(),
      filename: z.string().optional(),
    }),
  ),
})

function derivePolicyDomain(citedAdr: string): string {
  const adr = citedAdr.toLowerCase()
  if (/secret|credential|sec-|key|access/i.test(adr)) return 'security'
  if (/billing|charge|payment|adr-0042/i.test(adr)) return 'api_contract'
  if (/pii|mask|log|adr-0019/i.test(adr)) return 'data_residency'
  if (/sdk|deprecat|migrat|adr-0031/i.test(adr)) return 'architecture'
  return 'unknown'
}

export async function bulkCreate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = bulkCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      )
    }

    const { repo, actor, trigger, diff_id: diffId, findings } = parsed.data

    const data = findings.map((f) => ({
      id: f.id,
      recordId: f.record_id,
      tier: f.tier,
      confidence: f.confidence,
      title: f.title,
      description: f.description,
      citedAdr: f.cited_adr,
      citedText: f.cited_text,
      sourceDocument: f.source_document,
      diffOld: f.diff_old,
      diffNew: f.diff_new,
      traceId: f.trace_id,
      timestamp: new Date(f.timestamp),
      policyDomain: derivePolicyDomain(f.cited_adr),
      actor,
      repo,
      filename: f.filename ?? null,
      trigger,
      diffId,
      violatesPolicy: f.tier === 'blocking' || f.tier === 'warning',
      criticEntailed: true,
      criticReasoning: 'Auto-detected by analysis engine.',
      status: 'OPEN',
    }))

    await prisma.finding.createMany({ data, skipDuplicates: true })

    res.status(201).json({ created: data.length, finding_ids: findings.map((f) => f.id) })
  } catch (err) {
    next(err)
  }
}

// ── PATCH /api/v1/findings/:id/resolve ────────────────────────────────

export async function resolveFinding(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params as { id: string }

    const parsed = resolveBodySchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      )
    }
    const { patchDiff } = parsed.data

    const existing = await prisma.finding.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError('Finding')

    const updated = await prisma.finding.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        patchDiff: patchDiff ?? null,
      },
    })

    res.json({
      finding: {
        id: updated.id,
        record_id: updated.recordId,
        status: updated.status,
        resolved_at: updated.resolvedAt?.toISOString() ?? null,
        patch_diff: updated.patchDiff,
      },
    })
  } catch (err) {
    next(err)
  }
}
