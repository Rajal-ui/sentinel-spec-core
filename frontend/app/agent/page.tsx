'use client'

import { useEffect, useRef, useState, useCallback, type DragEvent, type KeyboardEvent } from 'react'
import AppShell from '@/components/layout/AppShell'
import ThinkingDrawer from '@/components/layout/ThinkingDrawer'
import FindingCard from '@/components/shared/FindingCard'
import { StatusLabel } from '@/components/shared/StatusBadge'
import { useAuthStore } from '@/lib/store/auth'
import { useSessionStore } from '@/lib/store/session'
import type { Finding } from '@/lib/types'
import {
  Shield, Plus, Upload, GitBranch, Code, ArrowRight,
  BrainCircuit, Trash2, FileText, X,
} from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

// ── Types ─────────────────────────────────────────────────────────────────────

type IngestionTab = 'file' | 'github' | 'paste'

interface StagedFile {
  id: string
  name: string
  size: number
  content?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  'Review this diff for ADR violations',
  'Check if this service respects the billing abstraction layer',
  'Scan for PII handling issues in the auth module',
]

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: 8,
  fontFamily: 'IBM Plex Mono, monospace',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Blinking streaming cursor */
function StreamingCursor() {
  return (
    <motion.span
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        display: 'inline-block',
        width: 2,
        height: 14,
        background: 'var(--primary)',
        borderRadius: 1,
        verticalAlign: 'middle',
        marginLeft: 4,
      }}
    />
  )
}

/** Tab bar used in multiple places */
function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; icon?: React.ReactNode }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        background: 'var(--surface-muted)',
        borderRadius: 6,
        padding: 3,
        border: '1px solid var(--border)',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 11,
            fontWeight: 500,
            transition: 'background 0.15s, color 0.15s',
            background: active === tab.id ? 'var(--surface-raised)' : 'transparent',
            color: active === tab.id ? 'var(--text)' : 'var(--text-muted)',
          }}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ── Left Panel ─────────────────────────────────────────────────────────────────

function LeftPanel() {
  const { createSession, deleteSession, setActiveSession, sessions, activeSessionId, sendMessage } = useSessionStore()
  const prefersReducedMotion = useReducedMotion()

  // Ingestion state
  const [ingestionTab, setIngestionTab] = useState<IngestionTab>('file')
  const [isDragOver, setIsDragOver] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [githubUrl, setGithubUrl] = useState('')
  const [pasteCode, setPasteCode] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    const newFiles: StagedFile[] = []
    for (const f of arr) {
      let content = ''
      try {
        content = await f.text()
      } catch {
        content = ''
      }
      newFiles.push({ id: `file-${Date.now()}-${f.name}`, name: f.name, size: f.size, content })
    }
    setStagedFiles((prev) => [...prev, ...newFiles])
  }, [])

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const removeFile = (id: string) => setStagedFiles((prev) => prev.filter((f) => f.id !== id))

  const ingestionTabs = [
    { id: 'file', label: 'File Upload', icon: <Upload size={11} /> },
    { id: 'github', label: 'GitHub URL', icon: <GitBranch size={11} /> },
    { id: 'paste', label: 'Paste Code', icon: <Code size={11} /> },
  ]

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        height: '100%',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--surface-muted)',
      }}
    >
      {/* New Analysis button */}
      <div style={{ padding: '16px 14px 12px' }}>
        <button
          onClick={() => createSession()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            width: '100%',
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '9px 14px',
            fontFamily: 'Archivo, sans-serif',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--primary-hover)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--primary)')}
        >
          <Plus size={15} />
          New Analysis
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px' }}>

        {/* ── INGESTION HUB ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={SECTION_LABEL_STYLE}>Ingestion</div>

          {/* Drop zone */}
          <motion.div
            animate={
              isDragOver && !prefersReducedMotion
                ? { scale: 1.02 }
                : { scale: 1 }
            }
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `1px dashed ${isDragOver ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 8,
              padding: '14px 12px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragOver ? 'rgba(27,108,168,0.07)' : 'transparent',
              transition: 'border-color 0.15s, background 0.15s',
              marginBottom: 10,
            }}
          >
            <Upload size={18} style={{ color: isDragOver ? 'var(--primary)' : 'var(--text-muted)', marginBottom: 6 }} />
            <div
              className="font-mono-product"
              style={{ fontSize: 12, color: isDragOver ? 'var(--primary)' : 'var(--text-muted)', lineHeight: 1.5 }}
            >
              Drop files, folders, or paste a GitHub URL
            </div>
          </motion.div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />

          {/* Input tabs */}
          <div style={{ marginBottom: 10 }}>
            <TabBar
              tabs={ingestionTabs}
              active={ingestionTab}
              onChange={(id) => setIngestionTab(id as IngestionTab)}
            />
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            {ingestionTab === 'github' && (
              <motion.div
                key="github"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                style={{ display: 'flex', gap: 6 }}
              >
                <input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/org/repo/pull/42"
                  className="font-mono-product"
                  style={{
                    flex: 1,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '7px 10px',
                    fontSize: 11,
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
                <button
                  style={{
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '7px 12px',
                    fontSize: 11,
                    fontFamily: 'IBM Plex Mono, monospace',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Fetch Diff
                </button>
              </motion.div>
            )}

            {ingestionTab === 'paste' && (
              <motion.div
                key="paste"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <textarea
                  value={pasteCode}
                  onChange={(e) => setPasteCode(e.target.value)}
                  placeholder="Paste code here..."
                  className="font-mono-product"
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 11,
                    color: 'var(--text)',
                    resize: 'vertical',
                    minHeight: 80,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </motion.div>
            )}

            {ingestionTab === 'file' && stagedFiles.length === 0 && (
              <motion.div
                key="file-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <div
                  className="font-mono-product"
                  style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0' }}
                >
                  No files staged
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* File list */}
          {stagedFiles.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {stagedFiles.map((file) => (
                <div
                  key={file.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '5px 8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                  }}
                >
                  <FileText size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span
                    className="font-mono-product"
                    style={{ fontSize: 11, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {file.name}
                  </span>
                  <span className="font-mono-product" style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {formatBytes(file.size)}
                  </span>
                  <button
                    onClick={() => removeFile(file.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0 }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add to Chat button */}
          {(stagedFiles.length > 0 || pasteCode.trim() || githubUrl.trim()) && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: 12 }}
            >
              <button
                onClick={async () => {
                  if (!activeSessionId) createSession()
                  let content = ''
                  if (stagedFiles.length > 0) {
                    const fileParts = stagedFiles.map(f => {
                      const header = `# File: ${f.name} (${formatBytes(f.size)})`
                      const body = f.content ? `\n${f.content}` : ''
                      return `${header}${body}`
                    })
                    content = fileParts.join('\n\n')
                  } else if (pasteCode.trim()) {
                    content = pasteCode
                  } else if (githubUrl.trim()) {
                    content = `Review this PR: ${githubUrl}`
                  }
                  if (content) {
                    await sendMessage(content, 'text')
                    setStagedFiles([])
                    setPasteCode('')
                    setGithubUrl('')
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  width: '100%',
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary-hover)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary)'
                }}
              >
                <ArrowRight size={13} />
                Add to Chat & Analyze
              </button>
            </motion.div>
          )}
        </div>

        {/* ── AUDIT HISTORY ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={SECTION_LABEL_STYLE}>History</div>

          {sessions.length === 0 ? (
            <div
              className="font-mono-product"
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '20px 12px',
                border: '1px dashed var(--border)',
                borderRadius: 8,
                lineHeight: 1.6,
              }}
            >
              No analyses yet.{'\n'}Drop some code.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <AnimatePresence initial={false}>
                {sessions.map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
                  >
                    <div
                      onClick={() => setActiveSession(session.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        padding: '8px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        border: `1px solid ${activeSessionId === session.id ? 'rgba(27,108,168,0.4)' : 'var(--border)'}`,
                        background: activeSessionId === session.id ? 'rgba(27,108,168,0.08)' : 'var(--surface)',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (activeSessionId !== session.id)
                          (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-raised)'
                      }}
                      onMouseLeave={(e) => {
                        if (activeSessionId !== session.id)
                          (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 500,
                            color: 'var(--text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {session.name}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteSession(session.id) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0 }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {formatDate(session.created_at)}
                        </span>
                        <StatusLabel
                          status={
                            session.status === 'PASSED'
                              ? 'PASSED'
                              : session.status === 'VIOLATIONS'
                              ? 'BLOCKING'
                              : 'PENDING'
                          }
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Chat Canvas ────────────────────────────────────────────────────────────────

function ChatCanvas({ onOpenThinking }: { onOpenThinking: () => void }) {
  const { messages, isStreaming, activeSessionId, sendMessage, createSession } = useSessionStore()
  const prefersReducedMotion = useReducedMotion()
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [inputValue, setInputValue] = useState('')

  // Auto-scroll on new messages
  useEffect(() => {
    if (!prefersReducedMotion) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else {
      bottomRef.current?.scrollIntoView()
    }
  }, [messages, isStreaming, prefersReducedMotion])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [inputValue])

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return
    if (!activeSessionId) createSession()
    const content = inputValue.trim()
    setInputValue('')
    await sendMessage(content, 'text')
  }, [inputValue, isStreaming, activeSessionId, sendMessage, createSession])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePromptChip = async (prompt: string) => {
    if (!activeSessionId) createSession()
    await sendMessage(prompt, 'text')
  }

  const handleApplyFix = useCallback((findingId: string) => {
    alert(`Fix applied to finding ${findingId}. Review the changes in your IDE.`)
  }, [])

  const handleOverride = useCallback((findingId: string) => {
    alert(`Override submitted for finding ${findingId}. Awaiting compliance officer review.`)
  }, [])

  const isEmpty = messages.length === 0 && !isStreaming

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
        position: 'relative',
      }}
    >
      {/* Message area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {isEmpty ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: 'easeOut' }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '60vh',
              gap: 16,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                border: '1px solid var(--border)',
                background: 'rgba(27,108,168,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield size={36} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2
                className="font-display"
                style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 8 }}
              >
                What should I review?
              </h2>
              <p
                className="font-mono-product"
                style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}
              >
                Drop code, paste a diff, or type a question.
              </p>
            </div>
            {/* Example prompt chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 540 }}>
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handlePromptChip(prompt)}
                  className="font-mono-product"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 20,
                    padding: '7px 14px',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.borderColor = 'var(--primary)'
                    el.style.color = 'var(--text)'
                    el.style.background = 'rgba(27,108,168,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.borderColor = 'var(--border)'
                    el.style.color = 'var(--text-secondary)'
                    el.style.background = 'var(--surface)'
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          /* Conversation */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820, margin: '0 auto', width: '100%' }}>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {msg.role === 'user' ? (
                    /* User bubble */
                    <div
                      className="glass"
                      style={{
                        maxWidth: '68%',
                        padding: '11px 15px',
                        borderRadius: 12,
                        borderBottomRightRadius: 3,
                        fontSize: 15,
                        fontFamily: 'Inter, sans-serif',
                        color: 'var(--text)',
                        lineHeight: 1.6,
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.content}
                    </div>
                  ) : (
                    /* Agent response */
                    <div style={{ flex: 1, maxWidth: '92%', minWidth: 0 }}>
                      {/* Meta line */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
                      >
                        <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {formatTime(msg.timestamp)}
                        </span>
                        {msg.model_badge && (
                          <span
                            className="font-mono-product badge"
                            style={{
                              fontSize: 10,
                              background: 'rgba(27,108,168,0.12)',
                              color: 'var(--primary)',
                              borderColor: 'rgba(27,108,168,0.3)',
                              padding: '1px 7px',
                            }}
                          >
                            {msg.model_badge}
                          </span>
                        )}
                        {msg.tokens && (
                          <span className="font-mono-product" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {msg.tokens} tokens · {msg.duration_ms}ms
                          </span>
                        )}
                      </div>

                      {/* Message text */}
                      <div
                        style={{
                          fontSize: 15,
                          fontFamily: 'Inter, sans-serif',
                          color: 'var(--text)',
                          lineHeight: 1.65,
                          marginBottom: msg.findings && msg.findings.length > 0 ? 14 : 0,
                        }}
                      >
                        {msg.content}
                        {msg.is_streaming && <StreamingCursor />}
                      </div>

                      {/* Finding cards */}
                      {msg.findings && msg.findings.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                          {msg.findings.map((finding: Finding) => (
                            <FindingCard
                              key={finding.id}
                              finding={finding}
                              onApplyFix={handleApplyFix}
                              onOverride={handleOverride}
                              onViewReasoning={() => onOpenThinking()}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Streaming indicator */}
            <AnimatePresence>
              {isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0, 0.15, 0.3].map((delay) => (
                      <motion.span
                        key={delay}
                        animate={prefersReducedMotion ? {} : { opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay, ease: 'easeInOut' }}
                        style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }}
                      />
                    ))}
                  </div>
                  <span className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Analyzing...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input area ── */}
      <div
        className="glass"
        style={{
          borderTop: '1px solid var(--border)',
          padding: '12px 16px 14px',
          flexShrink: 0,
        }}
      >
        {/* Textarea + send row */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={'Ask a question or describe what to review...'}
            disabled={isStreaming}
            style={{
              flex: 1,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              color: 'var(--text)',
              resize: 'none',
              minHeight: 42,
              maxHeight: 200,
              outline: 'none',
              lineHeight: 1.55,
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--primary)' }}
            onBlur={(e) => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--border)' }}
            rows={1}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isStreaming}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 42,
              height: 42,
              borderRadius: 8,
              border: 'none',
              background:
                !inputValue.trim() || isStreaming ? 'var(--surface-raised)' : 'var(--primary)',
              color: !inputValue.trim() || isStreaming ? 'var(--text-muted)' : '#fff',
              cursor: !inputValue.trim() || isStreaming ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, color 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (inputValue.trim() && !isStreaming)
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary-hover)'
            }}
            onMouseLeave={(e) => {
              if (inputValue.trim() && !isStreaming)
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary)'
            }}
          >
            {isStreaming ? (
              <motion.div
                animate={prefersReducedMotion ? {} : { rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: 16,
                  height: 16,
                  border: '2px solid transparent',
                  borderTopColor: 'var(--text-muted)',
                  borderRadius: '50%',
                }}
              />
            ) : (
              <ArrowRight size={17} />
            )}
          </button>
        </div>

        {/* Bottom bar: char count */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {inputValue.length} chars{inputValue.length > 0 ? ' · Enter ↵ to send' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgentWorkspacePage() {
  const { isAuthenticated, openLoginModal } = useAuthStore()
  const { thinkingStepsVisible, setThinkingVisible } = useSessionStore()
  const prefersReducedMotion = useReducedMotion()

  // Auth gate — open login modal if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      openLoginModal('/agent')
    }
  }, [isAuthenticated, openLoginModal])

  if (!isAuthenticated) {
    return (
      <AppShell title="Agent Workspace" breadcrumb="sentinel-spec / agent">
        <div
          style={{
            display: 'flex',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <Shield size={36} style={{ color: 'var(--text-muted)' }} />
          <p className="font-mono-product" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Authentication required. Opening login…
          </p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Agent Workspace" breadcrumb="sentinel-spec / agent">
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* ── Left content panel: 280px ── */}
        <LeftPanel />

        {/* ── Center chat canvas: flex-1 ── */}
        <ChatCanvas onOpenThinking={() => setThinkingVisible(true)} />

        {/* ── Thinking Drawer: slides from right ── */}
        <ThinkingDrawer
          open={thinkingStepsVisible}
          onClose={() => setThinkingVisible(false)}
        />
      </div>

      {/* ── View AI Reasoning ghost button ── */}
      <AnimatePresence>
        {!thinkingStepsVisible && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            onClick={() => setThinkingVisible(true)}
            className="font-mono-product"
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s, background 0.15s',
              backdropFilter: 'blur(12px)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.borderColor = 'var(--primary)'
              el.style.color = 'var(--text)'
              el.style.background = 'rgba(27,108,168,0.08)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.borderColor = 'var(--border)'
              el.style.color = 'var(--text-secondary)'
              el.style.background = 'var(--surface)'
            }}
          >
            <BrainCircuit size={13} />
            View AI Reasoning
          </motion.button>
        )}
      </AnimatePresence>
    </AppShell>
  )
}
