'use client'
import React from 'react'

// ── Lightweight markdown-to-JSX renderer ──────────────────────────────────────
// Handles: **bold**, `inline code`, fenced code blocks, unordered/ordered lists,
// paragraph breaks via \n\n, and horizontal rules.

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Split on **bold**, `code`, and plain segments
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let lastIdx = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    // Plain text before this match
    if (match.index > lastIdx) {
      nodes.push(text.slice(lastIdx, match.index))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={match.index} style={{ fontWeight: 600, color: 'var(--text)' }}>
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={match.index}
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '0.88em',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '1px 5px',
            color: 'var(--primary)',
          }}
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      nodes.push(token)
    }
    lastIdx = match.index + token.length
  }
  if (lastIdx < text.length) {
    nodes.push(text.slice(lastIdx))
  }
  return nodes
}

interface MdBlock {
  type: 'paragraph' | 'ul' | 'ol' | 'code'
  items?: string[]
  text?: string
  lang?: string
}

function parseBlocks(raw: string): MdBlock[] {
  const blocks: MdBlock[] = []
  const lines = raw.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({ type: 'code', text: codeLines.join('\n'), lang })
      i++ // skip closing fence
      continue
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // Blank line — skip
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph — collect consecutive non-blank, non-list, non-fence lines
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join('\n') })
    }
  }

  return blocks
}

/** Renders a markdown string as React elements. */
export function Markdown({ content, style }: { content: string; style?: React.CSSProperties }) {
  const blocks = parseBlocks(content)

  return (
    <div style={{ lineHeight: 1.65, ...style }}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'paragraph':
            return (
              <p key={idx} style={{ margin: '0 0 10px' }}>
                {renderInline(block.text!)}
              </p>
            )
          case 'ul':
            return (
              <ul
                key={idx}
                style={{
                  margin: '4px 0 10px',
                  paddingLeft: 20,
                  listStyleType: 'disc',
                }}
              >
                {block.items!.map((item, li) => (
                  <li key={li} style={{ marginBottom: 4 }}>
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol
                key={idx}
                style={{ margin: '4px 0 10px', paddingLeft: 20 }}
              >
                {block.items!.map((item, li) => (
                  <li key={li} style={{ marginBottom: 4 }}>
                    {renderInline(item)}
                  </li>
                ))}
              </ol>
            )
          case 'code':
            return (
              <pre
                key={idx}
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 12,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '10px 12px',
                  overflowX: 'auto',
                  margin: '4px 0 10px',
                  lineHeight: 1.5,
                }}
              >
                <code>{block.text}</code>
              </pre>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
