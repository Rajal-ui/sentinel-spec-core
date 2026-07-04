'use client'

import { useEffect, useRef, useState, useCallback, type DragEvent, type KeyboardEvent } from 'react'
import AppShell from '@/components/layout/AppShell'
import HistoryPanel from '@/components/HistoryPanel'
import AnalysisFeed from '@/components/AnalysisFeed'
import { useAuthStore } from '@/lib/store/auth'
import { useSessionStore } from '@/lib/store/session'
import {
  Shield, Plus, Upload, Code, ArrowRight,
  FileText, X,
} from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

// ── Types ─────────────────────────────────────────────────────────────────────

type IngestionTab = 'file' | 'paste'

interface StagedFile {
  id: string
  name: string
  size: number
  content?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  'Review this diff for credentials leaked in source files',
  'Check if this service respects the billing abstraction layer',
  'Scan for PII handling issues in user logger output',
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

// ── Sub-components ─────────────────────────────────────────────────────────────

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
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
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
            color: active === tab.id ? 'var(--text)' : 'var(--text-secondary)',
            boxShadow: active === tab.id ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
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
  const { createSession, activeSessionId, sendMessage } = useSessionStore()
  const prefersReducedMotion = useReducedMotion()

  // Ingestion state
  const [ingestionTab, setIngestionTab] = useState<IngestionTab>('file')
  const [isDragOver, setIsDragOver] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
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
    { id: 'paste', label: 'Paste Code', icon: <Code size={11} /> },
  ]

  return (
    <div
      className="flex flex-col w-[280px] flex-shrink-0 h-full overflow-hidden border-l border-r border-slate-200/60 dark:border-[#1F2029]/70"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
      }}
    >
      {/* New Analysis button */}
      <div style={{ padding: '16px 14px 12px' }}>
        <button
          onClick={() => createSession()}
          className="font-display"
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
      <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: '0 14px' }}>

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
              border: `1px dashed ${isDragOver ? '#FF5C00' : 'var(--border)'}`,
              borderRadius: 8,
              padding: '14px 12px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragOver ? 'rgba(255,92,0,0.07)' : 'var(--surface)',
              transition: 'border-color 0.15s, background 0.15s',
              marginBottom: 10,
            }}
          >
            <Upload size={18} style={{ color: isDragOver ? '#FF5C00' : 'var(--text-muted)', marginBottom: 6 }} />
            <div
              className="font-mono-product"
              style={{ fontSize: 12, color: isDragOver ? '#FF5C00' : 'var(--text-muted)', lineHeight: 1.5 }}
            >
              Click to upload a file
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
                  className="font-mono-product w-full bg-white/30 dark:bg-zinc-900/30 text-slate-950 dark:text-zinc-50 border border-slate-200 dark:border-zinc-800/80 rounded-md focus:outline-none focus:ring-1 focus:ring-[#FF5C00] focus:border-[#FF5C00] placeholder-slate-400 dark:placeholder-zinc-500 transition-[border-color,box-shadow] duration-150"
                  style={{
                    padding: 8,
                    fontSize: 11,
                    fontFamily: 'IBM Plex Mono, monospace',
                    resize: 'vertical',
                    minHeight: 80,
                    boxSizing: 'border-box',
                    width: '100%',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
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
                className="flex flex-col items-center gap-2 py-1.5"
              >
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="font-mono-product bg-white/30 dark:bg-zinc-900/30 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-800/80 hover:border-[#FF5C00] hover:text-[#FF5C00] rounded-md transition-[background,border-color,color] duration-150 backdrop-blur-sm"
                  style={{
                    padding: '6px 16px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Browse Files
                </button>
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
                    gap: 6,
                    padding: 6,
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                  }}
                >
                  <FileText size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  <span
                    className="font-mono-product"
                    style={{ fontSize: 11, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {file.name}
                  </span>
                  <span className="font-mono-product" style={{ fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0 }}>
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
          {(stagedFiles.length > 0 || pasteCode.trim()) && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: 12 }}
            >
              <button
                onClick={async () => {
                  if (!activeSessionId) createSession()
                  let content = ''
                  let originalCode: string | undefined
                  let fileName: string | undefined
                  if (stagedFiles.length > 0) {
                    const fileParts = stagedFiles.map(f => {
                      const header = `# File: ${f.name} (${formatBytes(f.size)})`
                      const body = f.content ? `\n${f.content}` : ''
                      return `${header}${body}`
                    })
                    content = fileParts.join('\n\n')
                    // Use the first file's raw content as the reconstruction source
                    originalCode = stagedFiles[0].content ?? content
                    fileName = stagedFiles[0].name
                  } else if (pasteCode.trim()) {
                    content = pasteCode
                    originalCode = pasteCode
                    fileName = 'pasted_code.py'
                  }
                  if (content) {
                    await sendMessage(content, 'text', { originalCode, fileName })
                    setStagedFiles([])
                    setPasteCode('')
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
          <HistoryPanel />
        </div>
      </div>
    </div>
  )
}

// ── Chat Canvas ────────────────────────────────────────────────────────────────

function ChatCanvas() {
  const { messages, isStreaming, activeSessionId, sendMessage, createSession, resolveFinding } = useSessionStore()
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
    resolveFinding(findingId)
  }, [resolveFinding])

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
      <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: '24px 28px' }}>
        {isEmpty ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: 'easeOut' }}
            className="flex flex-col items-center justify-center text-center rounded-2xl"
            style={{
              minHeight: '60vh',
              gap: 16,
              padding: '48px 24px',
              margin: '24px 0',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'blur(12px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(12px) saturate(1.5)',
            }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 72,
                height: 72,
                background: 'var(--surface-raised)',
                border: '1px solid var(--glass-border)',
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
                style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}
              >
                Drop code, paste a diff, or type a question.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center" style={{ maxWidth: 540 }}>
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handlePromptChip(prompt)}
                  className="font-mono-product"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 9999,
                    padding: '6px 14px',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)'
                    e.currentTarget.style.color = 'var(--text)'
                    e.currentTarget.style.background = 'var(--surface-raised)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                    e.currentTarget.style.background = 'var(--surface)'
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <AnalysisFeed onApplyFix={handleApplyFix} />
        )}
      </div>

      {/* ── Input area ── */}
      <div
        className="flex-shrink-0 bg-white/40 dark:bg-[#08080A]/50 backdrop-blur-xl border-t border-slate-200/40 dark:border-zinc-800/40"
        style={{
          padding: '12px 16px 14px',
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
            className="flex-1 font-sans text-sm resize-none leading-[1.55] min-h-[42px] max-h-[200px] transition-[border-color,box-shadow] duration-150 rounded-lg outline-none bg-white/30 dark:bg-zinc-900/30 text-slate-950 dark:text-zinc-50 border border-slate-200 dark:border-zinc-800/80 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-1 focus:ring-[#FF5C00] focus:border-[#FF5C00]"
            style={{
              padding: '10px 12px',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
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
              border: '1px solid var(--border)',
              background:
                !inputValue.trim() || isStreaming ? 'var(--surface-muted)' : 'var(--primary)',
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
  const { isAuthenticated, initialized, openLoginModal } = useAuthStore()

  // Auth gate — open login modal only after initialization completes
  useEffect(() => {
    if (initialized && !isAuthenticated) {
      openLoginModal('/agent')
    }
  }, [initialized, isAuthenticated, openLoginModal])

  if (!initialized) {
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
            Verifying session…
          </p>
        </div>
      </AppShell>
    )
  }

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
      <div className="flex h-full w-full overflow-hidden" style={{ background: 'transparent' }}>
        <LeftPanel />
        <ChatCanvas />
      </div>
    </AppShell>
  )
}
