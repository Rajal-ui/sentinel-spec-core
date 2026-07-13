'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, ChevronDown, ChevronRight, ExternalLink, LogOut, User, Settings, Sun, Moon } from 'lucide-react'
import { SentinelLogoMark } from '@/components/brand/SentinelLogoMark'

import LoginModal from '@/components/layout/LoginModal'
import { useAuthStore } from '@/lib/store/auth'
import { useThemeStore } from '@/lib/store/theme'

// ── TOC section definitions ──────────────────────────────────────────────────
const TOC_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'ibm-services', label: 'IBM Services' },
  { id: 'tech-stack', label: 'Tech Stack' },
  { id: 'pipeline', label: 'Pipeline' },
]

// ── Capability data ───────────────────────────────────────────────────────────
interface Capability {
  id: string
  icon: string
  title: string
  summary: string
  prose: string
  schema: string
}

const CAPABILITIES: Capability[] = [
  {
    id: 'rag',
    icon: '⬡',
    title: 'RAG Policy Retrieval',
    summary: 'Milvus-lite vector store, cosine similarity, top-k=6 chunks retrieved per analysis.',
    prose:
      'At analysis time the policy retriever embeds the incoming code diff using the same encoder used at ingestion time. A cosine-similarity ANN query runs against the Milvus-lite collection scoped to the requesting tenant. The top-k=6 chunks are returned with their source ADR identifiers and scores. These chunks form the grounding context injected into every downstream Granite prompt, ensuring classifications always cite specific policy text rather than hallucinating rules.',
    schema:
      `// PolicyChunk schema
{
  "chunk_id": "adr-42-para-3",
  "team_scope": "payments",
  "embedding": [0.014, -0.223, ...],  // 1024-dim
  "text": "All payment handlers MUST ...",
  "source_adr": "ADR-0042",
  "version": "2026-01-15"
}`,
  },
  {
    id: 'granite',
    icon: '⬡',
    title: 'Violation Classification (Granite)',
    summary: 'Granite 4 Haiku Small via watsonx.ai, structured JSON output, confidence scoring.',
    prose:
      'The classification agent sends the retrieved policy chunks plus the diff to Granite 4 Haiku Small running inside the caller\'s IBM Cloud tenancy via the watsonx.ai inference endpoint. The prompt template enforces structured JSON output using a response_format schema. Each finding carries a rule_id (mapped to the source ADR), a severity (blocking / warning / logged_only), a confidence float in [0.0, 1.0], a plain-language rationale, and a remediation suggestion. Temperature is set to 0 for deterministic output.',
    schema:
      `// Classification response (Granite 4 Haiku Small structured output)
{
  "findings": [
    {
      "rule_id": "ADR-0042",
      "severity": "blocking",
      "confidence": 0.94,
      "rationale": "Direct Stripe SDK call bypasses...",
      "remediation": "Use PaymentGatewayPort instead of..."
    }
  ],
  "model": "granite-4-h-small",
  "latency_ms": 312
}`,
  },
  {
    id: 'critic',
    icon: '⬡',
    title: 'Adversarial Compliance Critic',
    summary: 'Second Granite 4 Haiku Small pass, validates classification, reduces false positives by 60%.',
    prose:
      'After the primary classification the critic agent runs a second Granite 4 Haiku Small inference with an adversarial prompt: it is explicitly instructed to find reasons the primary classification might be wrong. If the critic disagrees with a finding\'s severity the confidence is down-weighted and the discrepancy is logged. Empirically this two-pass pattern reduces false positives by ~60% compared to single-pass classification. The critic output is merged into the final finding list before routing.',
    schema:
      `// Critic prompt pattern (IBM Plex Mono)
SYSTEM: You are an adversarial compliance critic.
        Find reasons the following findings are WRONG.

INPUT:
  findings: {{ primary_findings | json }}
  diff:     {{ diff_text }}
  policy:   {{ policy_chunks }}

OUTPUT FORMAT: { "overrides": [...], "rationale": "..." }`,
  },
  {
    id: 'routing',
    icon: '⬡',
    title: 'Confidence Banding & Routing',
    summary: 'blocking ≥85%, warning 50-84%, logged_only <50% — maps to CI enforcement.',
    prose:
      'Post-critique confidence scores drive the routing decision that determines pipeline behaviour. A finding with confidence ≥ 0.85 is promoted to BLOCKING, which causes the CI gate to fail and returns exit code 1 to the pipeline runner. Scores in [0.50, 0.85) become WARNINGS: they appear in the IBM Bob inline panel and are written to the governance lineage store but do not block the build. Scores below 0.50 are downgraded to LOGGED_ONLY — silently recorded for trend analysis without surfacing noise to the developer.',
    schema:
      `// Routing table
confidence >= 0.85  → severity: "blocking"  → CI exit 1
confidence 0.50-0.84 → severity: "warning"  → logged, no block
confidence < 0.50   → severity: "logged_only" → silent record

// CI integration (GitHub Actions / Tekton)
- exit_code: 1   → step fails, PR cannot merge
- exit_code: 0   → step passes, warnings in annotations`,
  },
  {
    id: 'lineage',
    icon: '⬡',
    title: 'Immutable Governance Lineage',
    summary: 'watsonx.governance lineage records, append-only, approver-attributed overrides.',
    prose:
      'Every finding, suppression, and human override is written as an append-only record to watsonx.governance. Records include the finding content, the Granite 4 Haiku Small model version, the policy chunk IDs used, a timestamp, and the identity of any human who approved an exception. Records are cryptographically signed and cannot be edited — only new records can supersede previous ones. This produces an auditor-ready decision trail that satisfies SOC 2, ISO 27001, and financial-services regulatory requirements without any additional tooling.',
    schema:
      `// LineageRecord (watsonx.governance schema)
{
  "record_id": "lr-uuid-v4",
  "type": "finding" | "override" | "suppression",
  "finding_id": "f-abc123",
  "actor": "system" | "user@company.com",
  "approved_by": null | "manager@company.com",
  "timestamp": "2026-01-15T14:22:33Z",
  "immutable": true,
  "signature": "sha256:..."
}`,
  },
  {
    id: 'multitenancy',
    icon: '⬡',
    title: 'Multi-tenant Policy Isolation',
    summary: 'team_scope field on PolicyChunk, per-tenant vector partitioning.',
    prose:
      'Every PolicyChunk carries a team_scope string that is enforced at both ingestion and query time. Vector partitioning in Milvus ensures a query from the payments team never reaches the data-platform team\'s policy corpus. Tenants ingest their own ADRs through the policy management API; the ingestion pipeline validates the calling identity against IBM Cloud IAM before writing. Platform-wide rules (e.g. global security baseline) are written into a shared partition that is always merged into every tenant\'s retrieval context.',
    schema:
      `// Ingestion call (policy management API)
POST /api/policies/ingest
Authorization: Bearer <IAM token>

{
  "source_adr": "ADR-0101",
  "team_scope": "payments",    // ← tenant isolation key
  "chunks": [
    { "text": "...", "paragraph": 1 },
    ...
  ]
}`,
  },
]

// ── IBM Services table data ───────────────────────────────────────────────────
const IBM_SERVICES = [
  { component: 'LLM', service: 'IBM Granite 4 Haiku Small via watsonx.ai', purpose: 'Violation classification and adversarial critique', href: 'https://www.ibm.com/docs/watsonx' },
  { component: 'Vector Store', service: 'Milvus via watsonx.data', purpose: 'Policy chunk storage and retrieval', href: 'https://www.ibm.com/docs/milvus' },
  { component: 'Governance', service: 'watsonx.governance', purpose: 'Immutable lineage records for all decisions', href: 'https://www.ibm.com/docs/governance' },
  { component: 'Orchestration', service: 'watsonx Orchestrate', purpose: 'Agent pipeline coordination', href: 'https://www.ibm.com/docs/orchestrate' },
  { component: 'IDE', service: 'IBM Bob', purpose: 'Native MCP tool registration and finding display', href: 'https://ibm.com/bob' },
  { component: 'Auth', service: 'IBM Cloud IAM', purpose: 'Service-to-service authentication', href: 'https://cloud.ibm.com/iam' },
  { component: 'Monitoring', service: 'IBM Cloud Monitor', purpose: 'Agent performance and SLA tracking', href: 'https://cloud.ibm.com/monitor' },
  { component: 'Secrets', service: 'IBM Secrets Manager', purpose: 'API key and credential management', href: 'https://cloud.ibm.com/secrets' },
]

// ── Tech stack badges ─────────────────────────────────────────────────────────
const TECH_BADGES = [
  'Next.js 15', 'TypeScript', 'Tailwind v4', 'Framer Motion',
  'Zustand', 'React Hook Form', 'Zod', 'Recharts',
  'Lucide React', 'Milvus-lite', 'IBM Granite 4', 'watsonx.governance',
]

// ── Pipeline step data ────────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  {
    n: '01',
    title: 'Retrieve',
    desc: 'RAG lookup against the policy corpus. ADRs, architecture decisions, and compliance rules are embedded and queried via cosine similarity.',
    annotation: '// top-k=6 chunks · cosine · Milvus-lite',
  },
  {
    n: '02',
    title: 'Classify',
    desc: 'Granite 4 Haiku Small classifies the diff against retrieved policy chunks. Structured JSON output enforces schema compliance with confidence scoring.',
    annotation: '// granite-4-h-small · temp=0 · JSON mode',
  },
  {
    n: '03',
    title: 'Critique',
    desc: 'Adversarial critic validates the classification, instructed to find reasons findings are wrong. Reduces false positives by 60%.',
    annotation: '// second pass · adversarial prompt',
  },
  {
    n: '04',
    title: 'Surface',
    desc: 'Findings rendered inline in IBM Bob with diff context and remediation. Every decision written to watsonx.governance lineage.',
    annotation: '// MCP tool · immutable record',
  },
]

// ── Hexagonal Architecture SVG ────────────────────────────────────────────────
function ArchitectureDiagram() {
  return (
    <svg
      viewBox="-8 0 616 400"
      width="100%"
      height="auto"
      style={{ maxWidth: 616, display: 'block', margin: '0 auto' }}
      aria-label="Hexagonal architecture diagram showing Domain Core surrounded by ports and IBM services"
    >
      {/* ── background ── */}
      <rect width="600" height="400" fill="#0A0C0F" rx="8" />

      {/* ── connecting lines ── */}
      {/* center → LLMPort */}
      <line x1="300" y1="175" x2="200" y2="100" stroke="#FF5C00" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
      {/* center → VectorStorePort */}
      <line x1="300" y1="175" x2="400" y2="100" stroke="#FF5C00" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
      {/* center → GovernancePort */}
      <line x1="300" y1="225" x2="200" y2="300" stroke="#FF5C00" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
      {/* center → OrchestrationPort */}
      <line x1="300" y1="225" x2="400" y2="300" stroke="#FF5C00" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />

      {/* IBM side connector lines (port → service) */}
      <line x1="155" y1="88" x2="68" y2="88" stroke="#FF5C00" strokeWidth="1" opacity="0.4" />
      <line x1="155" y1="88" x2="68" y2="136" stroke="#FF5C00" strokeWidth="1" opacity="0.4" />
      <line x1="155" y1="288" x2="68" y2="248" stroke="#FF5C00" strokeWidth="1" opacity="0.4" />
      <line x1="155" y1="288" x2="68" y2="296" stroke="#FF5C00" strokeWidth="1" opacity="0.4" />

      {/* Fallback side connector lines (port → fallback) */}
      <line x1="445" y1="88" x2="532" y2="88" stroke="#4A5568" strokeWidth="1" opacity="0.4" />
      <line x1="445" y1="88" x2="532" y2="136" stroke="#4A5568" strokeWidth="1" opacity="0.4" />
      <line x1="445" y1="288" x2="532" y2="248" stroke="#4A5568" strokeWidth="1" opacity="0.4" />
      <line x1="445" y1="288" x2="532" y2="296" stroke="#4A5568" strokeWidth="1" opacity="0.4" />

      {/* ── Domain Core (center) ── */}
      <rect x="230" y="155" width="140" height="90" rx="6" fill="#1A1A23" stroke="#FF5C00" strokeWidth="2" />
      <text x="300" y="192" textAnchor="middle" fill="#E8EAED" fontFamily="IBM Plex Mono, monospace" fontSize="13" fontWeight="600">Domain Core</text>
      <text x="300" y="210" textAnchor="middle" fill="#8B95A8" fontFamily="IBM Plex Mono, monospace" fontSize="9">ComplianceAnalyser</text>
      <text x="300" y="225" textAnchor="middle" fill="#8B95A8" fontFamily="IBM Plex Mono, monospace" fontSize="9">PolicyRetriever</text>

      {/* ── Port boxes ── */}
      {/* LLMPort — top left */}
      <rect x="120" y="65" width="110" height="46" rx="4" fill="#111116" stroke="#FF5C00" strokeWidth="1.5" />
      <text x="175" y="83" textAnchor="middle" fill="#A8C4E8" fontFamily="IBM Plex Mono, monospace" fontSize="10" fontWeight="500">LLMPort</text>
      <text x="175" y="99" textAnchor="middle" fill="#4A5568" fontFamily="IBM Plex Mono, monospace" fontSize="8">classify · critique</text>

      {/* VectorStorePort — top right */}
      <rect x="370" y="65" width="130" height="46" rx="4" fill="#111116" stroke="#FF5C00" strokeWidth="1.5" />
      <text x="435" y="83" textAnchor="middle" fill="#A8C4E8" fontFamily="IBM Plex Mono, monospace" fontSize="10" fontWeight="500">VectorStorePort</text>
      <text x="435" y="99" textAnchor="middle" fill="#4A5568" fontFamily="IBM Plex Mono, monospace" fontSize="8">upsert · query</text>

      {/* GovernancePort — bottom left */}
      <rect x="110" y="265" width="130" height="46" rx="4" fill="#111116" stroke="#FF5C00" strokeWidth="1.5" />
      <text x="175" y="283" textAnchor="middle" fill="#A8C4E8" fontFamily="IBM Plex Mono, monospace" fontSize="10" fontWeight="500">GovernancePort</text>
      <text x="175" y="299" textAnchor="middle" fill="#4A5568" fontFamily="IBM Plex Mono, monospace" fontSize="8">record · lineage</text>

      {/* OrchestrationPort — bottom right */}
      <rect x="360" y="265" width="140" height="46" rx="4" fill="#111116" stroke="#FF5C00" strokeWidth="1.5" />
      <text x="430" y="283" textAnchor="middle" fill="#A8C4E8" fontFamily="IBM Plex Mono, monospace" fontSize="10" fontWeight="500">OrchestrationPort</text>
      <text x="430" y="299" textAnchor="middle" fill="#4A5568" fontFamily="IBM Plex Mono, monospace" fontSize="8">pipeline · dispatch</text>

      {/* ── Left column header: IBM Services ── */}
      <text x="8" y="40" fill="#FF5C00" fontFamily="IBM Plex Mono, monospace" fontSize="9" fontWeight="600" letterSpacing="0.08em">IBM SERVICES</text>

      {/* IBM service labels */}
      <rect x="4" y="72" width="56" height="22" rx="3" fill="rgba(255,92,0,0.15)" stroke="#FF5C00" strokeWidth="1" />
      <text x="32" y="87" textAnchor="middle" fill="#FF5C00" fontFamily="IBM Plex Mono, monospace" fontSize="8">watsonx.ai</text>

      <rect x="4" y="120" width="83" height="22" rx="3" fill="rgba(255,92,0,0.15)" stroke="#FF5C00" strokeWidth="1" />
      <text x="45" y="135" textAnchor="middle" fill="#FF5C00" fontFamily="IBM Plex Mono, monospace" fontSize="8">Milvus / wx.data</text>

      <rect x="3" y="232" width="70" height="22" rx="3" fill="rgba(255,92,0,0.15)" stroke="#FF5C00" strokeWidth="1" />
      <text x="37" y="247" textAnchor="middle" fill="#FF5C00" fontFamily="IBM Plex Mono, monospace" fontSize="8">wx.governance</text>

      <rect x="3" y="280" width="74" height="22" rx="3" fill="rgba(255,92,0,0.15)" stroke="#FF5C00" strokeWidth="1"></rect>
      <text x="40" y="295" textAnchor="middle" fill="#FF5C00" fontFamily="IBM Plex Mono, monospace" fontSize="8">wx Orchestrate</text>

      {/* ── Right column header: Local Fallbacks ── */}
      <text x="540" y="40" fill="#4A5568" fontFamily="IBM Plex Mono, monospace" fontSize="9" fontWeight="600" letterSpacing="0.06em" textAnchor="end">LOCAL FALLBACKS</text>

      {/* Fallback labels */}
      <rect x="540" y="72" width="56" height="22" rx="3" fill="rgba(74,85,104,0.12)" stroke="#4A5568" strokeWidth="1" />
      <text x="568" y="87" textAnchor="middle" fill="#4A5568" fontFamily="IBM Plex Mono, monospace" fontSize="8">Ollama</text>

      <rect x="538" y="120" width="60" height="22" rx="3" fill="rgba(74,85,104,0.12)" stroke="#4A5568" strokeWidth="1" />
      <text x="568" y="135" textAnchor="middle" fill="#4A5568" fontFamily="IBM Plex Mono, monospace" fontSize="8">Milvus-lite</text>

      <rect x="538" y="232" width="60" height="22" rx="3" fill="rgba(74,85,104,0.12)" stroke="#4A5568" strokeWidth="1" />
      <text x="570" y="247" textAnchor="middle" fill="#4A5568" fontFamily="IBM Plex Mono, monospace" fontSize="8">JSON store</text>

      <rect x="530" y="280" width="65" height="22" rx="3" fill="rgba(74,85,104,0.12)" stroke="#4A5568" strokeWidth="1" />
      <text x="563" y="295" textAnchor="middle" fill="#4A5568" fontFamily="IBM Plex Mono, monospace" fontSize="8">Direct agents</text>

      {/* ── MOCK_MODE pill ── */}
      <rect x="234" y="355" width="132" height="24" rx="12" fill="rgba(74,85,104,0.2)" stroke="#4A5568" strokeWidth="1" />
      <text x="300" y="372" textAnchor="middle" fill="#8B95A8" fontFamily="IBM Plex Mono, monospace" fontSize="10" fontWeight="500">MOCK_MODE</text>
    </svg>
  )
}

// ── useActiveSection hook ─────────────────────────────────────────────────────
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0])

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id)
        },
        { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
      )
      obs.observe(el)
      observers.push(obs)
    })

    return () => observers.forEach((o) => o.disconnect())
  }, [ids])

  return active
}

// ── CapabilityCard component ──────────────────────────────────────────────────
function CapabilityCard({
  cap,
  isOpen,
  onToggle,
}: {
  cap: Capability
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <motion.div
      layout
      className="glass"
      style={{
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
        borderLeft: isOpen ? '3px solid var(--primary)' : '3px solid transparent',
        transition: 'border-color 0.2s',
      }}
      onClick={onToggle}
    >
      {/* Collapsed header */}
      <div
        style={{
          padding: '20px 20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}
      >
        {/* Hex icon placeholder */}
        <div
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            background: 'rgba(255,0,122,0.12)',
            border: '1px solid rgba(255,0,122,0.3)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            color: 'var(--primary)',
          }}
        >
          {cap.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            className="font-display"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 4,
              lineHeight: 1.3,
            }}
          >
            {cap.title}
          </h3>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {cap.summary}
          </p>
        </div>
        <div style={{ flexShrink: 0, color: 'var(--text-muted)', marginTop: 2 }}>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </div>

      {/* Expanded accordion body */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '0 20px 20px',
                borderTop: '1px solid var(--border)',
                paddingTop: 16,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  fontFamily: 'Inter, sans-serif',
                  lineHeight: 1.7,
                  marginBottom: 16,
                  margin: '0 0 16px',
                }}
              >
                {cap.prose}
              </p>
              <pre
                className="code-block"
                style={{
                  padding: '14px 16px',
                  overflowX: 'auto',
                  whiteSpace: 'pre',
                  fontSize: 12,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                <code style={{ color: 'var(--text-code)' }}>{cap.schema}</code>
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DocsPage() {
  const pathname = usePathname()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const { isAuthenticated, openLoginModal } = useAuthStore()
  const [openCapId, setOpenCapId] = useState<string | null>(null)
  const [tocOpen, setTocOpen] = useState(false)
  const sectionIds = TOC_SECTIONS.map((s) => s.id)
  const activeSection = useActiveSection(sectionIds)

  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setTocOpen(false)
  }

  function toggleCap(id: string) {
    setOpenCapId((prev) => (prev === id ? null : id))
  }

  return (
    <>

      <LoginModal />

      {/* ── TOP NAV ── */}
      <nav
        className="glass"
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          borderRadius: 12,
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 40,
          width: 'calc(100% - 64px)',
          maxWidth: 1100,
        }}
      >
        {/* Wordmark */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
          }}
        >
          <SentinelLogoMark size={18} style={{ flexShrink: 0 }} />
          <span
            className="font-display"
            style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}
          >
            Sentinel Spec
          </span>
        </Link>

        {/* Center links */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            gap: 32,
          }}
        >
          {[
            ['How it Works', '/how-it-works'],
            ['IBM Integration', '/ibm-integration'],
            ['Docs', '/docs'],
            ['Export', '/export'],
          ].map(([label, href]) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={label} href={href}
                style={{
                  fontSize: 13, color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  textDecoration: 'none', fontFamily: 'Inter, sans-serif',
                  fontWeight: isActive ? 500 : 400,
                  borderBottom: isActive ? '1px solid var(--primary)' : 'none',
                  paddingBottom: isActive ? 1 : 0, transition: 'color 0.15s ease',
                } as React.CSSProperties}
              >
                {label}
              </Link>
            )
          })}
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={toggleTheme}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 6,
              padding: '6px 8px', cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', lineHeight: 0,
            }}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          {isAuthenticated ? (
            <>
              <Link href="/agent"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--primary)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 16px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'Archivo, sans-serif',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Console
              </Link>
              <UserMenu />
            </>
          ) : (
            <>
              <button
                onClick={() => openLoginModal()}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '6px 14px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Sign In
              </button>
              <button
                onClick={() => openLoginModal()}
                style={{
                  background: 'var(--primary)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 16px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'Archivo, sans-serif',
                  fontWeight: 700,
                }}
              >
                Get Access
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ── MOBILE TOC STICKY BAR ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 90,
          display: 'none',
        }}
        className="mobile-toc-bar"
      >
        <style>{`
          @media (max-width: 768px) {
            .mobile-toc-bar { display: block !important; }
            .docs-layout { flex-direction: column !important; }
            .docs-toc { display: none !important; }
          }
        `}</style>
        <button
          onClick={() => setTocOpen((o) => !o)}
          className="glass"
          style={{
            width: '100%',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text)',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 12,
          }}
        >
          <span>
            §{' '}
            {TOC_SECTIONS.find((s) => s.id === activeSection)?.label ?? 'Overview'}
          </span>
          <ChevronDown
            size={14}
            style={{
              transform: tocOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          />
        </button>
        <AnimatePresence>
          {tocOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="glass"
              style={{ overflow: 'hidden', borderTop: '1px solid var(--border)' }}
            >
              {TOC_SECTIONS.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => scrollTo(sec.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 20px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 14,
                    color:
                      activeSection === sec.id
                        ? 'var(--primary)'
                        : 'var(--text-secondary)',
                    fontWeight: activeSection === sec.id ? 500 : 400,
                  }}
                >
                  {sec.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── PAGE WRAPPER ── */}
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '96px 32px 48px',
        }}
      >
        {/* ── HEADER SECTION ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          style={{ marginBottom: 56 }}
        >
          {/* Breadcrumb */}
          <div
            className="font-mono-product"
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
              marginBottom: 16,
            }}
          >
            <Link
              href="/"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
            >
              sentinel-spec
            </Link>
            <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ color: 'var(--text-secondary)' }}>docs</span>
            <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ color: 'var(--text)' }}>blueprint</span>
          </div>

          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              marginBottom: 14,
              lineHeight: 1.1,
            }}
          >
            Architecture Blueprint &amp; Capabilities
          </h1>

          {/* Version + date badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span
              className="font-mono-product badge"
              style={{
                fontSize: 11,
                color: 'var(--primary)',
                borderColor: 'rgba(255,0,122,0.4)',
                background: 'rgba(255,0,122,0.1)',
              }}
            >
              v4.0
            </span>
            <span
              className="font-mono-product"
              style={{ fontSize: 12, color: 'var(--text-muted)' }}
            >
              Updated on 04-07-2026
            </span>
          </div>
        </motion.header>

        {/* ── TWO-COLUMN LAYOUT ── */}
        <div
          className="docs-layout"
          style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}
        >
          {/* ── STICKY TOC ── */}
          <aside
            className="docs-toc"
            style={{
              width: '25%',
              flexShrink: 0,
              position: 'sticky',
              top: 80,
              maxHeight: 'calc(100vh - 100px)',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 0',
              }}
            >
              <div
                className="font-mono-product"
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '8px 16px 12px',
                }}
              >
                On this page
              </div>
              {TOC_SECTIONS.map((sec) => {
                const isActive = activeSection === sec.id
                return (
                  <button
                    key={sec.id}
                    onClick={() => scrollTo(sec.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 16px',
                      background: 'none',
                      border: 'none',
                      borderLeft: isActive
                        ? '3px solid var(--primary)'
                        : '3px solid transparent',
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 13,
                      color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 500 : 400,
                      transition: 'color 0.15s, border-color 0.15s',
                    }}
                  >
                    {sec.label}
                  </button>
                )
              })}
            </div>
          </aside>

          {/* ── MAIN CONTENT ── */}
          <main style={{ flex: 1, minWidth: 0, paddingBottom: 96 }}>
            {/* ══ OVERVIEW ══════════════════════════════════════════════════ */}
            <section id="overview" style={{ marginBottom: 72 }}>
              <SectionHeading>Overview</SectionHeading>
              <p
                style={{
                  fontSize: 16,
                  color: 'var(--text-secondary)',
                  fontFamily: 'Inter, sans-serif',
                  lineHeight: 1.75,
                  marginBottom: 16,
                }}
              >
                Sentinel Spec is an autonomous architecture-compliance reviewer that
                runs inside IBM Bob IDE at authorship time and as a blocking gate in
                CI/CD pipelines. It uses a Retrieve → Classify → Critique → Surface
                pipeline powered by IBM Granite and watsonx services to enforce
                Architecture Decision Records (ADRs) and compliance rules before a
                pull request ever exists.
              </p>
              <p
                style={{
                  fontSize: 16,
                  color: 'var(--text-secondary)',
                  fontFamily: 'Inter, sans-serif',
                  lineHeight: 1.75,
                  marginBottom: 16,
                }}
              >
                Every finding, override, and approval is written as an immutable
                lineage record to watsonx.governance — producing an auditor-ready
                decision trail that satisfies SOC 2, ISO 27001, and financial-services
                regulatory requirements with zero additional tooling.
              </p>
              {/* Callout */}
              <div
                style={{
                  padding: '14px 18px',
                  borderLeft: '3px solid var(--primary)',
                  background: 'rgba(255,0,122,0.08)',
                  borderRadius: '0 6px 6px 0',
                  marginTop: 24,
                }}
              >
                <span
                  className="font-display"
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text)',
                    marginRight: 8,
                  }}
                >
                  Dual-trigger model.
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: 'var(--text-secondary)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Runs as an advisory panel in IBM Bob (IDE-time) and as an enforcing
                  gate in CI (CI-time). Same pipeline, same rules, different exit
                  behaviour.
                </span>
              </div>
            </section>

            {/* ══ CAPABILITIES ══════════════════════════════════════════════ */}
            <section id="capabilities" style={{ marginBottom: 72 }}>
              <SectionHeading>Capabilities</SectionHeading>
              <p
                style={{
                  fontSize: 15,
                  color: 'var(--text-secondary)',
                  fontFamily: 'Inter, sans-serif',
                  lineHeight: 1.7,
                  marginBottom: 28,
                }}
              >
                Six core capabilities compose the compliance pipeline. Click any card
                to expand the full how-it-works details and schema patterns. Only one
                expands at a time.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 14,
                }}
              >
                {CAPABILITIES.map((cap) => (
                  <CapabilityCard
                    key={cap.id}
                    cap={cap}
                    isOpen={openCapId === cap.id}
                    onToggle={() => toggleCap(cap.id)}
                  />
                ))}
              </div>
            </section>

            {/* ══ ARCHITECTURE ══════════════════════════════════════════════ */}
            <section id="architecture" style={{ marginBottom: 72 }}>
              <SectionHeading>Architecture</SectionHeading>
              <p
                style={{
                  fontSize: 15,
                  color: 'var(--text-secondary)',
                  fontFamily: 'Inter, sans-serif',
                  lineHeight: 1.7,
                  marginBottom: 28,
                }}
              >
                Sentinel Spec follows a hexagonal (ports &amp; adapters) architecture.
                The Domain Core is completely isolated from infrastructure concerns; IBM
                services and local fallbacks are interchangeable behind typed port
                interfaces. MOCK_MODE swaps every IBM adapter for a zero-cost local
                equivalent without changing any domain code.
              </p>

              {/* SVG diagram */}
              <div
                className="code-block"
                style={{
                  borderRadius: 10,
                  padding: '24px 20px',
                  marginBottom: 24,
                  overflowX: 'auto',
                }}
              >
                <ArchitectureDiagram />
              </div>

              {/* Legend */}
              <div
                style={{
                  display: 'flex',
                  gap: 24,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      background: 'rgba(255,92,0,0.2)',
                      border: '1.5px solid #FF5C00',
                    }}
                  />
                  <span
                    className="font-mono-product"
                    style={{ fontSize: 11, color: 'var(--text-secondary)' }}
                  >
                    IBM Services
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      background: 'rgba(74,85,104,0.15)',
                      border: '1.5px solid #4A5568',
                    }}
                  />
                  <span
                    className="font-mono-product"
                    style={{ fontSize: 11, color: 'var(--text-secondary)' }}
                  >
                    Local Fallbacks (MOCK_MODE)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 24,
                      height: 2,
                      background: '#FF5C00',
                      opacity: 0.5,
                    }}
                  />
                  <span
                    className="font-mono-product"
                    style={{ fontSize: 11, color: 'var(--text-secondary)' }}
                  >
                    Port interface
                  </span>
                </div>
              </div>
            </section>

            {/* ══ IBM SERVICES ══════════════════════════════════════════════ */}
            <section id="ibm-services" style={{ marginBottom: 72 }}>
              <SectionHeading>IBM Services</SectionHeading>
              <p
                style={{
                  fontSize: 15,
                  color: 'var(--text-secondary)',
                  fontFamily: 'Inter, sans-serif',
                  lineHeight: 1.7,
                  marginBottom: 28,
                }}
              >
                Sentinel Spec is built on eight IBM Cloud and watsonx services. Each
                has a local fallback that activates when{' '}
                <code
                  className="font-mono-product"
                  style={{
                    fontSize: 13,
                    color: 'var(--text-code)',
                    background: 'var(--surface-raised)',
                    padding: '1px 6px',
                    borderRadius: 3,
                    border: '1px solid var(--border)',
                  }}
                >
                  MOCK_MODE=true
                </code>
                .
              </p>

              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-raised)' }}>
                      {['Component', 'IBM Service', 'Purpose', 'Docs'].map((h) => (
                        <th
                          key={h}
                          className="font-mono-product"
                          style={{
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                            padding: '12px 16px',
                            textAlign: 'left',
                            borderBottom: '1px solid var(--border)',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {IBM_SERVICES.map((row, i) => (
                      <tr
                        key={row.component}
                        style={{
                          background:
                            i % 2 === 0
                              ? 'var(--surface)'
                              : 'var(--surface-raised)',
                        }}
                      >
                        <td
                          className="font-mono-product"
                          style={{
                            fontSize: 12,
                            color: 'var(--text-code)',
                            padding: '11px 16px',
                            borderBottom: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.component}
                        </td>
                        <td
                          className="font-mono-product"
                          style={{
                            fontSize: 12,
                            color: 'var(--primary)',
                            padding: '11px 16px',
                            borderBottom: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.service}
                        </td>
                        <td
                          style={{
                            fontSize: 13,
                            color: 'var(--text-secondary)',
                            padding: '11px 16px',
                            borderBottom: '1px solid var(--border)',
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          {row.purpose}
                        </td>
                        <td
                          style={{
                            padding: '11px 16px',
                            borderBottom: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <a
                            href={row.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12,
                              color: 'var(--primary)',
                              textDecoration: 'none',
                              fontFamily: 'IBM Plex Mono, monospace',
                            }}
                          >
                            Docs
                            <ExternalLink size={11} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ══ TECH STACK ════════════════════════════════════════════════ */}
            <section id="tech-stack" style={{ marginBottom: 72 }}>
              <SectionHeading>Tech Stack</SectionHeading>
              <p
                style={{
                  fontSize: 15,
                  color: 'var(--text-secondary)',
                  fontFamily: 'Inter, sans-serif',
                  lineHeight: 1.7,
                  marginBottom: 24,
                }}
              >
                The frontend is a Next.js 15 App Router application with TypeScript
                throughout. The backend pipeline is Python with hexagonal-architecture
                adapters for every IBM service.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TECH_BADGES.map((badge) => (
                  <span
                    key={badge}
                    className="font-mono-product"
                    style={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '3px 10px',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </section>

            {/* ══ PIPELINE ══════════════════════════════════════════════════ */}
            <section id="pipeline" style={{ marginBottom: 72 }}>
              <SectionHeading>Pipeline</SectionHeading>
              <p
                style={{
                  fontSize: 15,
                  color: 'var(--text-secondary)',
                  fontFamily: 'Inter, sans-serif',
                  lineHeight: 1.7,
                  marginBottom: 32,
                }}
              >
                The same four-agent pipeline is triggered in two modes. IDE-time runs
                in advisory mode — findings appear inline in IBM Bob without blocking
                anything. CI-time runs in enforcement mode — BLOCKING findings fail the
                pipeline and prevent the PR from merging.
              </p>

              {/* Dual trigger row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  marginBottom: 28,
                }}
              >
                {[
                  {
                    label: 'IDE-time trigger',
                    desc: 'Developer saves file in IBM Bob → MCP tool invoked → advisory findings inline',
                    color: 'var(--success)',
                    mono: '// ADVISORY · no CI block',
                  },
                  {
                    label: 'CI-time trigger',
                    desc: 'PR opened / push to branch → pipeline step → BLOCKING findings fail CI gate',
                    color: 'var(--danger)',
                    mono: '// ENFORCING · exit 1 on block',
                  },
                ].map((trigger) => (
                  <div
                    key={trigger.label}
                    className="glass"
                    style={{
                      borderRadius: 8,
                      padding: '16px 18px',
                      borderLeft: `3px solid ${trigger.color}`,
                    }}
                  >
                    <div
                      className="font-display"
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--text)',
                        marginBottom: 6,
                      }}
                    >
                      {trigger.label}
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        fontFamily: 'Inter, sans-serif',
                        lineHeight: 1.5,
                        margin: '0 0 8px',
                      }}
                    >
                      {trigger.desc}
                    </p>
                    <div
                      className="font-mono-product"
                      style={{ fontSize: 11, color: 'var(--text-muted)' }}
                    >
                      {trigger.mono}
                    </div>
                  </div>
                ))}
              </div>

              {/* Arrow divider */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 28,
                }}
              >
                <div
                  style={{
                    width: '40%',
                    height: 1,
                    background:
                      'linear-gradient(90deg, transparent, var(--primary))',
                    opacity: 0.4,
                  }}
                />
                <div
                  className="font-mono-product"
                  style={{
                    fontSize: 11,
                    color: 'var(--primary)',
                    padding: '4px 12px',
                    border: '1px solid rgba(255,0,122,0.35)',
                    borderRadius: 4,
                    background: 'rgba(255,0,122,0.08)',
                    whiteSpace: 'nowrap',
                    margin: '0 12px',
                  }}
                >
                  ↓ same pipeline ↓
                </div>
                <div
                  style={{
                    width: '40%',
                    height: 1,
                    background:
                      'linear-gradient(90deg, var(--primary), transparent)',
                    opacity: 0.4,
                  }}
                />
              </div>

              {/* Four pipeline steps */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 0,
                  position: 'relative',
                }}
              >
                {/* connector line */}
                <div
                  style={{
                    position: 'absolute',
                    top: 30,
                    left: '12.5%',
                    right: '12.5%',
                    height: 2,
                    zIndex: 0,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      background:
                        'linear-gradient(90deg, var(--primary), var(--primary))',
                      opacity: 0.25,
                    }}
                  />
                  <motion.div
                    style={{
                      position: 'absolute',
                      top: 0,
                      height: '100%',
                      width: 50,
                      background: 'var(--primary)',
                      opacity: 0.65,
                      borderRadius: 1,
                    }}
                    animate={{ left: ['-5%', '105%'] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                  />
                </div>

                {PIPELINE_STEPS.map((step, i) => (
                  <motion.div
                    key={step.n}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-10% 0px' }}
                    transition={{ delay: i * 0.08, duration: 0.2 }}
                    style={{
                      textAlign: 'center',
                      padding: '0 12px',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    {/* Step circle */}
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        background: 'var(--surface-raised)',
                        border: '2px solid var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 14px',
                      }}
                    >
                      <span
                        className="font-mono-product"
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          color: 'var(--primary)',
                        }}
                      >
                        {step.n}
                      </span>
                    </div>

                    <h3
                      className="font-display"
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: 'var(--text)',
                        marginBottom: 8,
                      }}
                    >
                      {step.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        fontFamily: 'Inter, sans-serif',
                        lineHeight: 1.55,
                        marginBottom: 10,
                      }}
                    >
                      {step.desc}
                    </p>
                    <div
                      className="font-mono-product"
                      style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        lineHeight: 1.5,
                      }}
                    >
                      {step.annotation}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* CI callout */}
              <div
                style={{
                  marginTop: 36,
                  padding: '14px 18px',
                  borderLeft: '3px solid var(--primary)',
                  background: 'rgba(255,0,122,0.08)',
                  borderRadius: '0 6px 6px 0',
                }}
              >
                <span
                  className="font-display"
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text)',
                    marginRight: 8,
                  }}
                >
                  CI Gate Enforcement
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: 'var(--text-secondary)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  BLOCKING findings (confidence ≥ 85%) fail the pipeline. WARNINGS
                  (50–84%) log to governance. Every decision is immutable,
                  timestamped, and approver-attributed via watsonx.governance.
                </span>
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '24px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
          }}
        >
          <SentinelLogoMark size={14} style={{ flexShrink: 0 }} />
          <span
            className="font-display"
            style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}
          >
            Sentinel Spec
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            ['Architecture', '/docs#architecture'],
            ['Capabilities', '/docs#capabilities'],
            ['IBM Services', '/docs#ibm-services'],
            ['Pipeline', '/docs#pipeline'],
            ['Landing', '/'],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                textDecoration: 'none',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {label}
            </Link>
          ))}
        </div>
        <div
          className="font-mono-product"
          style={{ fontSize: 12, color: 'var(--text-muted)' }}
        >
          IBM Granite 4 · watsonx.governance · IBM Bob · 2026
        </div>
      </footer>
    </>
  )
}

// ── UserMenu (avatar + dropdown) ──────────────────────────────────────────────

function UserMenu() {
  const { user, logout } = useAuthStore()
  const [open, setOpen] = useState(false)

  if (!user) return null

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '4px 10px',
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            fontFamily: 'Archivo, sans-serif',
          }}
        >
          {user.name.charAt(0)}
        </div>
        <span style={{ fontSize: 13, fontFamily: 'Inter, sans-serif' }}>{user.name}</span>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && (
        <div
          className="glass-raised"
          style={{
            position: 'absolute',
            top: '110%',
            right: 0,
            minWidth: 180,
            borderRadius: 8,
            padding: 6,
            zIndex: 100,
          }}
        >
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>{user.name}</div>
            <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.email}</div>
          </div>

          <Link
            href="/agent"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '7px 12px',
              borderRadius: 4,
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              color: 'var(--text)',
              textDecoration: 'none',
            }}
          >
            Console
          </Link>

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '7px 12px',
              borderRadius: 4,
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              color: 'var(--text)',
              textDecoration: 'none',
            }}
          >
            <User size={13} />
            Edit Profile
          </Link>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '7px 12px',
              borderRadius: 4,
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              color: 'var(--text)',
              textDecoration: 'none',
            }}
          >
            <Settings size={13} />
            Settings
          </Link>

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          <button
            onClick={() => { logout(); setOpen(false) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--danger)',
              padding: '7px 12px',
              borderRadius: 4,
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              textAlign: 'left',
            }}
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

// ── SectionHeading helper ─────────────────────────────────────────────────────
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-display"
      style={{
        fontSize: 'clamp(22px, 3vw, 28px)',
        fontWeight: 700,
        color: 'var(--text)',
        letterSpacing: '-0.01em',
        marginBottom: 20,
        paddingBottom: 12,
        borderBottom: '1px solid var(--border)',
      }}
    >
      {children}
    </h2>
  )
}
