'use client'
import { motion, useReducedMotion } from 'framer-motion'
import { FileCode2, Check, AlertTriangle } from 'lucide-react'
import type { FileQueueItem } from '@/lib/types'

interface FileAnalysisQueueProps {
  files: FileQueueItem[]
  selectedFile: string | null
  onSelectFile: (filename: string | null) => void
}

function QueueRow({
  item,
  index,
  reducedMotion,
  isSelected,
  onSelect,
}: {
  item: FileQueueItem
  index: number
  reducedMotion: boolean
  isSelected: boolean
  onSelect: () => void
}) {
  const isAnalysing = item.status === 'analysing'
  const isComplete = item.status === 'passed' || item.status === 'violations'
  const clickable = isComplete

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion ? 0 : 0.2,
        delay: reducedMotion ? 0 : index * 0.04,
        ease: 'easeOut',
      }}
      className={isAnalysing ? 'queue-row-analysing' : ''}
      onClick={clickable ? onSelect : undefined}
      style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 12px',
        background: isSelected
          ? 'rgba(255, 92, 0, 0.08)'
          : 'var(--surface)',
        borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
        borderRadius: 8,
        position: 'relative',
        overflow: 'hidden',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background 0.15s',
        boxShadow: isSelected ? '0 0 12px rgba(255,92,0,0.10)' : undefined,
      }}
    >
      {isAnalysing && (
        <div className="queue-shimmer" />
      )}

      <FileCode2
        size={16}
        style={{
          color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1,
        }}
      />

      <span
        className="font-mono-product"
        style={{
          fontSize: 13,
          color: isSelected ? 'var(--primary)' : 'var(--text)',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          position: 'relative',
          zIndex: 1,
          fontWeight: isSelected ? 600 : 400,
        }}
      >
        {item.filename}
      </span>

      <span
        className="font-mono-product"
        style={{
          fontSize: 12,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {item.status === 'queued' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--text-muted)',
                opacity: 0.5,
              }}
            />
            Queued
          </span>
        )}

        {item.status === 'analysing' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--primary)' }}>
            <motion.span
              animate={reducedMotion ? {} : { opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--primary)',
              }}
            />
            Analysing
          </span>
        )}

        {item.status === 'passed' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--success)' }}>
            <Check size={13} strokeWidth={2.5} />
            Clean
          </span>
        )}

        {item.status === 'violations' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--amber)' }}>
            <AlertTriangle size={13} />
            {item.violationCount ?? 0} violation{(item.violationCount ?? 0) !== 1 ? 's' : ''}
          </span>
        )}
      </span>

      <style>{`
        .queue-row-analysing {
          border-color: rgba(255, 92, 0, 0.2) !important;
        }
        .queue-shimmer {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: linear-gradient(
            90deg,
            var(--surface) 0%,
            var(--surface-raised) 50%,
            var(--surface) 100%
          );
          background-size: 200% 100%;
          animation: queue-shimmer 1.4s ease-in-out infinite;
          opacity: 0.5;
        }
        @keyframes queue-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </motion.div>
  )
}

export default function FileAnalysisQueue({ files, selectedFile, onSelectFile }: FileAnalysisQueueProps) {
  const prefersReducedMotion = useReducedMotion() ?? false

  if (files.length === 0) return null

  return (
    <div
      className="prism-glass-card"
      style={{
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        border: '1px solid var(--glass-border)',
        background: 'var(--glass-bg)',
        borderRadius: 10,
      }}
    >
      <div
        className="font-mono-product"
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          marginBottom: 2,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {selectedFile
          ? `Showing violations in ${selectedFile}`
          : `Analysing ${files.length} file${files.length !== 1 ? 's' : ''}`}
        {selectedFile && (
          <span
            onClick={() => onSelectFile(null)}
            style={{
              marginLeft: 8,
              color: 'var(--primary)',
              cursor: 'pointer',
              textTransform: 'none',
              letterSpacing: 'normal',
            }}
          >
            Show all
          </span>
        )}
      </div>

      {files.map((item, idx) => (
        <QueueRow
          key={item.filename}
          item={item}
          index={idx}
          reducedMotion={prefersReducedMotion}
          isSelected={selectedFile === item.filename}
          onSelect={() => onSelectFile(selectedFile === item.filename ? null : item.filename)}
        />
      ))}
    </div>
  )
}
