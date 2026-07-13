import React from 'react'

interface SentinelLogoMarkProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Single source of truth for the Sentinel brand mark.
 * Used in: Sidebar nav header, login modal header, favicon (app/icon.svg mirrors this geometry).
 */
export function SentinelLogoMark({ size = 20, className, style }: SentinelLogoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      style={style}
      aria-label="Sentinel Spec logo"
    >
      {/* Outer shield */}
      <path
        d="M16 2L3.5 7.5V15c0 8.2 5.5 15.4 12.5 17C23 30.4 28.5 23.2 28.5 15V7.5L16 2z"
        fill="var(--primary, #FF5C00)"
      />
      {/* Inner depth highlight */}
      <path
        d="M16 4.8L6 9.6V15c0 7 4.5 13.2 10 14.8V4.8z"
        fill="var(--primary-hover, #FF7A2E)"
        opacity="0.55"
      />
      {/* Checkmark */}
      <path
        d="M11.5 16.5l3 3 6-6"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export default SentinelLogoMark
