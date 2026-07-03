'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface Props {
  code: string
  language?: string
  showLineNumbers?: boolean
  maxLines?: number
  className?: string
}

function tokenize(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const keywordRe = /\b(def|class|import|from|return|if|else|elif|for|while|in|and|or|not|True|False|None|async|await|with|as|try|except|raise|yield|lambda|const|let|var|function|=>|interface|type|export|default|extends|implements)\b/g
  const stringRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g
  const commentRe = /(#.+$|\/\/.+$)/m

  let lastIdx = 0
  const allMatches: { idx: number; len: number; kind: 'keyword' | 'string' | 'comment' }[] = []

  let m
  const kre = new RegExp(keywordRe.source, 'g')
  while ((m = kre.exec(line)) !== null) {
    allMatches.push({ idx: m.index, len: m[0].length, kind: 'keyword' })
  }
  const sre = new RegExp(stringRe.source, 'g')
  while ((m = sre.exec(line)) !== null) {
    allMatches.push({ idx: m.index, len: m[0].length, kind: 'string' })
  }
  const cre = new RegExp(commentRe.source, 'm')
  const cm = cre.exec(line)
  if (cm) allMatches.push({ idx: cm.index, len: cm[0].length, kind: 'comment' })

  allMatches.sort((a, b) => a.idx - b.idx)

  for (const match of allMatches) {
    if (match.idx < lastIdx) continue
    if (match.idx > lastIdx) {
      parts.push(line.slice(lastIdx, match.idx))
    }
    const text = line.slice(match.idx, match.idx + match.len)
    const color =
      match.kind === 'keyword'
        ? '#A8C4E8'
        : match.kind === 'string'
        ? '#2ECC71'
        : '#4A5568'
    parts.push(
      <span key={match.idx} style={{ color }}>
        {text}
      </span>
    )
    lastIdx = match.idx + match.len
  }
  if (lastIdx < line.length) parts.push(line.slice(lastIdx))
  return parts
}

export default function CodeBlock({ code, language = 'python', showLineNumbers = true, maxLines, className }: Props) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const allLines = code.split('\n')
  const lines = maxLines && !expanded ? allLines.slice(0, maxLines) : allLines
  const truncated = maxLines ? allLines.length > maxLines : false

  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={`code-block ${className ?? ''}`} style={{ overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          borderBottom: '1px solid var(--border)',
          background: '#0D0F12',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span
            className="font-mono-product"
            style={{
              fontSize: 11,
              color: 'var(--primary)',
              background: 'rgba(255,0,122,0.15)',
              padding: '2px 7px',
              borderRadius: 3,
              border: '1px solid rgba(255,0,122,0.3)',
            }}
          >
            {language}
          </span>
          <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {allLines.length} lines
          </span>
        </div>
        <button
          onClick={copy}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: copied ? 'var(--success)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontFamily: 'IBM Plex Mono, monospace',
            padding: '2px 6px',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div style={{ overflowX: 'auto', padding: '10px 0' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                {showLineNumbers && (
                  <td
                    className="font-mono-product"
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      textAlign: 'right',
                      padding: '0 14px 0 10px',
                      userSelect: 'none',
                      minWidth: 36,
                      verticalAlign: 'top',
                      lineHeight: 1.6,
                    }}
                  >
                    {i + 1}
                  </td>
                )}
                <td
                  className="font-mono-product"
                  style={{
                    fontSize: 13,
                    color: 'var(--text)',
                    padding: '0 16px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre',
                  }}
                >
                  {tokenize(line)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {truncated && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '8px 14px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setExpanded(!expanded)}
            className="font-mono-product"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {expanded ? '▲ Show Less' : `▼ Show Full Spec (${allLines.length - maxLines!} more lines)`}
          </button>
        </div>
      )}
    </div>
  )
}
