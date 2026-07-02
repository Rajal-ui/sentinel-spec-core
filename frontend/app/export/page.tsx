'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Download, Eye, Copy, Check, ChevronLeft, ChevronRight, Key, RefreshCw } from 'lucide-react'
import ShaderBackground from '@/components/shared/ShaderBackground'
import CodeBlock from '@/components/shared/CodeBlock'
import LoginModal from '@/components/layout/LoginModal'
import { useAuthStore } from '@/lib/store/auth'

// ── Data constants ───────────────────────────────────────────────────────────

const OPENAPI_JSON = `{
  "openapi": "3.1.0",
  "info": {
    "title": "Sentinel Spec",
    "version": "1.2.0",
    "description": "Autonomous architecture compliance reviewer for IBM Bob IDE"
  },
  "servers": [{"url": "https://api.sentinel-spec.ibm.com/v1"}],
  "paths": {
    "/analyze": {
      "post": {
        "operationId": "analyzeCode",
        "summary": "Analyze code diff for policy violations",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "diff": {"type": "string"},
                  "repo": {"type": "string"},
                  "actor": {"type": "string"},
                  "trigger": {"type": "string", "enum": ["ide_time", "ci_time"]}
                }
              }
            }
          }
        }
      }
    }
  }
}`

const MCP_TOOLS_JSON = `{
  "mcpVersion": "1.0",
  "tools": [
    {
      "name": "analyzeCode",
      "description": "Analyze code diff for policy violations",
      "inputSchema": {
        "type": "object",
        "properties": {
          "diff": {"type": "string", "description": "The unified diff to analyze"},
          "repo": {"type": "string", "description": "Repository identifier"},
          "actor": {"type": "string", "description": "Developer initiating the analysis"},
          "trigger": {
            "type": "string",
            "enum": ["ide_time", "ci_time"],
            "description": "Analysis trigger context"
          }
        },
        "required": ["diff", "repo"]
      }
    }
  ]
}`

const ORCHESTRATE_JSON = `{
  "orchestrate_version": "2.0",
  "skill_catalog": {
    "sentinel_spec": {
      "display_name": "Sentinel Spec Compliance",
      "description": "Autonomous architecture compliance reviewer",
      "version": "1.2.0",
      "endpoint": "https://api.sentinel-spec.ibm.com/v1/analyze",
      "auth": "bearer",
      "skills": [
        {
          "id": "analyze_code",
          "name": "Analyze Code for Policy Violations",
          "input_schema": {
            "diff": {"type": "string", "required": true},
            "repo": {"type": "string", "required": true}
          },
          "output_schema": {
            "findings": {"type": "array"},
            "governance_record_id": {"type": "string"}
          }
        }
      ]
    }
  }
}`

const ORCHESTRATE_YAML = `name: sentinel_spec
description: Autonomous architecture compliance reviewer
version: 1.2.0
skills:
  - name: analyze_code
    description: Analyze code for policy violations
    input_schema:
      diff: string
      repo: string
    output_schema:
      findings: array
      governance_record_id: string`

const BOB_STEPS = [
  {
    n: '01',
    title: 'Open MCP Tools Panel',
    description:
      'In IBM Bob IDE, open the left sidebar and click the MCP Tools panel icon. This is where all registered Model Context Protocol skills are managed and discoverable.',
  },
  {
    n: '02',
    title: 'Register the Skill',
    description:
      'Drag the downloaded sentinel_spec_openapi.json file into the MCP registration drop zone, or paste the hosted spec URL directly into the MCP registration input field.',
  },
  {
    n: '03',
    title: 'Tool Appears',
    description:
      'Sentinel Spec now appears in Bob\'s tool list with its icon and version badge. The skill is immediately active and ready to analyze any file you open.',
  },
  {
    n: '04',
    title: 'Inline Detection',
    description:
      'As you type code, Bob triggers the analyzeCode tool in the background. Policy violations are highlighted inline with a subtle underline — no context switch required.',
  },
  {
    n: '05',
    title: 'Findings Panel',
    description:
      'Bob\'s Findings panel surfaces each violation as a structured card: rule reference, severity, diff context, and a one-click remediation suggestion linked to the governing ADR.',
  },
]

const YAML_FIELD_DOCS = [
  {
    field: 'name',
    value: 'sentinel_spec',
    desc: 'Unique skill identifier used by watsonx Orchestrate to reference this skill in workflows and automation chains.',
  },
  {
    field: 'description',
    value: 'string',
    desc: 'Human-readable description surfaced in the Orchestrate skill catalog and shown to end-users when the skill is invoked.',
  },
  {
    field: 'version',
    value: '1.2.0',
    desc: 'Semantic version of the skill definition. Bump the minor version for new fields; bump major for breaking schema changes.',
  },
  {
    field: 'skills[].name',
    value: 'analyze_code',
    desc: 'The callable skill name. Orchestrate will map this to the corresponding OpenAPI operationId on the backend.',
  },
  {
    field: 'input_schema',
    value: 'diff · repo',
    desc: 'Defines the required and optional inputs. Both diff and repo are required. Orchestrate validates inputs before dispatching the request.',
  },
  {
    field: 'output_schema',
    value: 'findings · governance_record_id',
    desc: 'Describes the response shape. findings is an array of structured violation objects; governance_record_id links to the immutable audit record.',
  },
]

// ── Subcomponents ────────────────────────────────────────────────────────────

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 24 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 20 : 7,
            height: 7,
            borderRadius: 4,
            background: i === current ? 'var(--primary)' : 'var(--border)',
            transition: 'all 0.25s ease',
          }}
        />
      ))}
    </div>
  )
}

function CopyButton({ text, label = 'Copy YAML' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '6px 12px',
        color: copied ? 'var(--success)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 12,
        fontFamily: 'IBM Plex Mono, monospace',
        transition: 'color 0.15s',
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ExportPage() {
  const { isAuthenticated, openLoginModal } = useAuthStore()

  // Hero strip state
  const [downloaded, setDownloaded] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'full' | 'mcp' | 'orchestrate'>('full')

  // Bob walkthrough state
  const [stepIdx, setStepIdx] = useState(0)

  // API key state
  const [keyVisible, setKeyVisible] = useState(false)
  const [keyRegenerated, setKeyRegenerated] = useState(false)
  const [keyCopied, setKeyCopied] = useState(false)

  const MOCK_KEY = 'sk-sentinel-AQ.Ab8RN6JXDFEzd8fqUHly...'
  const MOCK_KEY_FULL = 'sk-sentinel-AQ.Ab8RN6JXDFEzd8fqUHly_x9mZpKc2vN4TwBsJYdE7qROgFL1hi3uD'

  const handleDownload = () => {
    if (!isAuthenticated) {
      openLoginModal()
      return
    }
    // Simulate download
    const blob = new Blob([OPENAPI_JSON], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sentinel_spec_openapi.json'
    a.click()
    URL.revokeObjectURL(url)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 3000)
  }

  const handleRegen = () => {
    setKeyRegenerated(true)
    setTimeout(() => setKeyRegenerated(false), 2000)
  }

  const handleCopyKey = () => {
    navigator.clipboard.writeText(MOCK_KEY_FULL)
    setKeyCopied(true)
    setTimeout(() => setKeyCopied(false), 1500)
  }

  const tabData: Record<'full' | 'mcp' | 'orchestrate', { code: string; lang: string }> = {
    full: { code: OPENAPI_JSON, lang: 'json' },
    mcp: { code: MCP_TOOLS_JSON, lang: 'json' },
    orchestrate: { code: ORCHESTRATE_JSON, lang: 'json' },
  }

  const currentStep = BOB_STEPS[stepIdx]

  return (
    <>
      <ShaderBackground variant="landing" />
      <LoginModal />

      {/* ── TOP NAV ── */}
      <nav
        className="glass"
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          borderRadius: 12,
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 40,
          width: 'calc(100% - 64px)',
          maxWidth: 1100,
        }}
      >
        {/* Brand */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <Shield size={18} style={{ color: 'var(--primary)' }} />
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
            flexWrap: 'wrap',
          }}
        >
          {[
            ['How it Works', '/#how-it-works'],
            ['IBM Integration', '/#ibm-integration'],
            ['Docs', '/docs'],
            ['Export', '/export'],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              style={{
                fontSize: 13,
                color: label === 'Export' ? 'var(--text)' : 'var(--text-secondary)',
                textDecoration: 'none',
                fontFamily: 'Inter, sans-serif',
                fontWeight: label === 'Export' ? 500 : 400,
                borderBottom: label === 'Export' ? '1px solid var(--primary)' : 'none',
                paddingBottom: label === 'Export' ? 1 : 0,
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Auth buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {isAuthenticated ? (
            <Link href="/dashboard"
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
              Dashboard
            </Link>
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

      {/* ── MAIN CONTENT ── */}
      <main style={{ paddingTop: 88 }}>

        {/* ── HERO STRIP ── */}
        <section style={{ padding: '72px 32px 56px', maxWidth: 900, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div
              className="font-mono-product"
              style={{
                fontSize: 11,
                color: 'var(--primary)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginBottom: 16,
              }}
            >
              Export Hub · v1.2.0
            </div>
            <h1
              className="font-display"
              style={{
                fontSize: 40,
                fontWeight: 700,
                color: 'var(--text)',
                lineHeight: 1.15,
                letterSpacing: '-0.01em',
                marginBottom: 12,
              }}
            >
              Deploy as an IDE Skill in one step.
            </h1>
            <p
              className="font-mono-product"
              style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32 }}
            >
              sentinel_spec_openapi.json · v1.2.0 · MCP-compatible
            </p>

            {/* CTA buttons */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <motion.button
                onClick={handleDownload}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: downloaded ? 'rgba(46,204,113,0.12)' : 'var(--primary)',
                  border: downloaded ? '1px solid var(--success)' : 'none',
                  borderRadius: 6,
                  padding: '10px 20px',
                  color: downloaded ? 'var(--success)' : '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontFamily: 'Archivo, sans-serif',
                  fontWeight: 700,
                  transition: 'all 0.2s',
                }}
              >
                {downloaded ? <Check size={15} /> : <Download size={15} />}
                {downloaded ? 'Downloaded' : 'Download OpenAPI Spec'}
              </motion.button>

              <motion.button
                onClick={() => setPreviewOpen((v) => !v)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '10px 20px',
                  color: previewOpen ? 'var(--text)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.2s',
                }}
              >
                <Eye size={15} />
                {previewOpen ? 'Hide Preview' : 'Preview JSON'}
              </motion.button>
            </div>
          </motion.div>
        </section>

        {/* ── OPENAPI PREVIEW PANEL ── */}
        <AnimatePresence>
          {previewOpen && (
            <motion.section
              key="preview-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '0 32px 56px', maxWidth: 900, margin: '0 auto' }}>
                {/* Always-dark panel */}
                <div
                  style={{
                    background: '#0A0C0F',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    overflow: 'hidden',
                  }}
                >
                  {/* Tab bar */}
                  <div
                    style={{
                      display: 'flex',
                      borderBottom: '1px solid var(--border)',
                      background: '#0D0F12',
                    }}
                  >
                    {(
                      [
                        { key: 'full', label: 'Full Spec' },
                        { key: 'mcp', label: 'MCP Tools Only' },
                        { key: 'orchestrate', label: 'Orchestrate Format' },
                      ] as const
                    ).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className="font-mono-product"
                        style={{
                          padding: '10px 20px',
                          background: 'none',
                          border: 'none',
                          borderBottom: activeTab === key ? '2px solid var(--primary)' : '2px solid transparent',
                          color: activeTab === key ? 'var(--text)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: 12,
                          letterSpacing: '0.03em',
                          transition: 'color 0.15s',
                          marginBottom: -1,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Code content */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                    >
                      <CodeBlock
                        code={tabData[activeTab].code}
                        language={tabData[activeTab].lang}
                        showLineNumbers
                        maxLines={60}
                        className=""
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── HOW IT WORKS IN IBM BOB ── */}
        <section
          style={{
            padding: '80px 32px',
            background: 'rgba(17,17,22,0.45)',
          }}
        >
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10% 0px' }}
              transition={{ duration: 0.2 }}
            >
              <h2
                className="font-display"
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: 'var(--text)',
                  letterSpacing: '-0.01em',
                  textAlign: 'center',
                  marginBottom: 8,
                }}
              >
                How Sentinel Spec registers in Bob
              </h2>
              <p
                style={{
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 15,
                  marginBottom: 48,
                }}
              >
                Five steps from download to inline detection.
              </p>
            </motion.div>

            {/* Step card */}
            <div
              className="glass-raised"
              style={{
                borderRadius: 12,
                padding: '40px 48px',
                minHeight: 220,
                position: 'relative',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={stepIdx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28 }}>
                    {/* Step number */}
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: 'rgba(27,108,168,0.12)',
                        border: '2px solid var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        className="font-mono-product"
                        style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)' }}
                      >
                        {currentStep.n}
                      </span>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, paddingTop: 4 }}>
                      <h3
                        className="font-display"
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color: 'var(--text)',
                          marginBottom: 12,
                        }}
                      >
                        {currentStep.title}
                      </h3>
                      <p
                        style={{
                          fontSize: 15,
                          color: 'var(--text-secondary)',
                          fontFamily: 'Inter, sans-serif',
                          lineHeight: 1.7,
                          maxWidth: 560,
                        }}
                      >
                        {currentStep.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                marginTop: 24,
              }}
            >
              <button
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                disabled={stepIdx === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 16px',
                  color: stepIdx === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                  cursor: stepIdx === 0 ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontFamily: 'Inter, sans-serif',
                  opacity: stepIdx === 0 ? 0.4 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <ChevronLeft size={14} />
                Previous
              </button>

              <StepDots total={BOB_STEPS.length} current={stepIdx} />

              <button
                onClick={() => setStepIdx((i) => Math.min(BOB_STEPS.length - 1, i + 1))}
                disabled={stepIdx === BOB_STEPS.length - 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 16px',
                  color:
                    stepIdx === BOB_STEPS.length - 1
                      ? 'var(--text-muted)'
                      : 'var(--text-secondary)',
                  cursor:
                    stepIdx === BOB_STEPS.length - 1 ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontFamily: 'Inter, sans-serif',
                  opacity: stepIdx === BOB_STEPS.length - 1 ? 0.4 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>

        {/* ── WATSONX ORCHESTRATE INTEGRATION ── */}
        <section style={{ padding: '80px 32px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10% 0px' }}
              transition={{ duration: 0.2 }}
              style={{ marginBottom: 40 }}
            >
              <div
                className="font-mono-product"
                style={{
                  fontSize: 11,
                  color: 'var(--primary)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                watsonx Orchestrate
              </div>
              <h2
                className="font-display"
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: 'var(--text)',
                  letterSpacing: '-0.01em',
                  marginBottom: 0,
                }}
              >
                Skill definition for Orchestrate
              </h2>
            </motion.div>

            {/* Two-column layout */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 32,
                alignItems: 'start',
              }}
            >
              {/* Left — YAML with copy button */}
              <div>
                <div
                  style={{
                    background: '#0A0C0F',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    overflow: 'hidden',
                  }}
                >
                  {/* YAML header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border)',
                      background: '#0D0F12',
                    }}
                  >
                    <span
                      className="font-mono-product"
                      style={{
                        fontSize: 11,
                        color: 'var(--primary)',
                        background: 'rgba(27,108,168,0.15)',
                        padding: '2px 7px',
                        borderRadius: 3,
                        border: '1px solid rgba(27,108,168,0.3)',
                      }}
                    >
                      yaml
                    </span>
                    <CopyButton text={ORCHESTRATE_YAML} label="Copy YAML" />
                  </div>
                  {/* YAML body */}
                  <pre
                    className="font-mono-product"
                    style={{
                      fontSize: 12,
                      lineHeight: 1.7,
                      color: 'var(--text)',
                      margin: 0,
                      padding: '20px 20px',
                      overflowX: 'auto',
                    }}
                  >
                    {ORCHESTRATE_YAML.split('\n').map((line, i) => {
                      // Simple YAML key colouring: keys in blue, values in default
                      const keyMatch = line.match(/^(\s*)([\w_-]+)(:)(.*)$/)
                      if (keyMatch) {
                        const [, indent, key, colon, rest] = keyMatch
                        return (
                          <span key={i} style={{ display: 'block' }}>
                            {indent}
                            <span style={{ color: '#A8C4E8' }}>{key}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{colon}</span>
                            <span style={{ color: '#2ECC71' }}>{rest}</span>
                          </span>
                        )
                      }
                      return (
                        <span key={i} style={{ display: 'block' }}>
                          {line}
                        </span>
                      )
                    })}
                  </pre>
                </div>
              </div>

              {/* Right — field docs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {YAML_FIELD_DOCS.map((item, i) => (
                  <motion.div
                    key={item.field}
                    initial={{ opacity: 0, x: 12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.16, delay: i * 0.05 }}
                    style={{
                      padding: '14px 16px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      borderLeft: '3px solid var(--primary)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 10,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        className="font-mono-product"
                        style={{ fontSize: 12, color: 'var(--primary)' }}
                      >
                        {item.field}
                      </span>
                      <span
                        className="font-mono-product"
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          background: 'var(--surface-raised)',
                          padding: '1px 6px',
                          borderRadius: 3,
                        }}
                      >
                        {item.value}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        fontFamily: 'Inter, sans-serif',
                        lineHeight: 1.6,
                      }}
                    >
                      {item.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── API KEY SECTION ── */}
        <section
          style={{
            padding: '80px 32px',
            background: 'rgba(17,17,22,0.45)',
          }}
        >
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10% 0px' }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="font-mono-product"
                style={{
                  fontSize: 11,
                  color: 'var(--primary)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                API Access
              </div>
              <h2
                className="font-display"
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: 'var(--text)',
                  letterSpacing: '-0.01em',
                  marginBottom: 32,
                }}
              >
                {isAuthenticated ? 'Your API Key' : 'API Key'}
              </h2>
            </motion.div>

            {/* Auth-gated content */}
            {!isAuthenticated ? (
              <div
                className="glass"
                style={{
                  borderRadius: 10,
                  padding: '40px 32px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'rgba(27,108,168,0.1)',
                    border: '1px solid rgba(27,108,168,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Key size={20} style={{ color: 'var(--primary)' }} />
                </div>
                <p
                  style={{
                    fontSize: 16,
                    color: 'var(--text-secondary)',
                    fontFamily: 'Inter, sans-serif',
                    margin: 0,
                  }}
                >
                  Sign in to view your API key
                </p>
                <button
                  onClick={() => openLoginModal()}
                  style={{
                    background: 'var(--primary)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '10px 24px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontFamily: 'Archivo, sans-serif',
                    fontWeight: 700,
                  }}
                >
                  Sign In
                </button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="glass-raised"
                style={{ borderRadius: 10, padding: '28px 28px', overflow: 'hidden' }}
              >
                {/* Key display row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 20,
                    padding: '12px 14px',
                    background: '#0A0C0F',
                    border: '1px solid var(--border)',
                    borderRadius: 7,
                  }}
                >
                  <span
                    className="font-mono-product"
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: 'var(--text)',
                      letterSpacing: keyVisible ? '0.02em' : '0.12em',
                      userSelect: keyVisible ? 'text' : 'none',
                      filter: keyVisible ? 'none' : 'blur(5px)',
                      transition: 'filter 0.2s',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {keyVisible ? MOCK_KEY_FULL : MOCK_KEY}
                  </span>

                  {/* Reveal toggle */}
                  <button
                    onClick={() => setKeyVisible((v) => !v)}
                    title={keyVisible ? 'Hide key' : 'Reveal key'}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: keyVisible ? 'var(--text)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 4,
                      transition: 'color 0.15s',
                      flexShrink: 0,
                    }}
                  >
                    <Eye size={15} />
                  </button>
                </div>

                {/* Action buttons */}
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    marginBottom: 20,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    onClick={handleCopyKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '7px 14px',
                      color: keyCopied ? 'var(--success)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: 'IBM Plex Mono, monospace',
                      transition: 'color 0.15s',
                    }}
                  >
                    {keyCopied ? <Check size={13} /> : <Copy size={13} />}
                    {keyCopied ? 'Copied' : 'Copy'}
                  </button>

                  <button
                    onClick={handleRegen}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'none',
                      border: `1px solid ${keyRegenerated ? 'var(--danger)' : 'rgba(232,93,74,0.35)'}`,
                      borderRadius: 6,
                      padding: '7px 14px',
                      color: keyRegenerated ? 'var(--danger)' : 'rgba(232,93,74,0.7)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: 'IBM Plex Mono, monospace',
                      transition: 'all 0.15s',
                    }}
                  >
                    <RefreshCw size={13} style={{ animation: keyRegenerated ? 'spin 0.6s linear' : 'none' }} />
                    {keyRegenerated ? 'Regenerated' : 'Regenerate Key'}
                  </button>
                </div>

                {/* Usage stats */}
                <div
                  className="font-mono-product"
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    borderTop: '1px solid var(--border)',
                    paddingTop: 16,
                  }}
                >
                  1,247 requests this month · 3,753 remaining
                </div>
              </motion.div>
            )}
          </div>
        </section>
      </main>

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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={14} style={{ color: 'var(--primary)' }} />
          <span className="font-display" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            Sentinel Spec
          </span>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            ['Docs', '/docs'],
            ['Architecture', '/docs'],
            ['Export', '/export'],
            ['Privacy', '#'],
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
        <div className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          IBM Granite · watsonx.governance · IBM Bob · 2026
        </div>
      </footer>
    </>
  )
}
