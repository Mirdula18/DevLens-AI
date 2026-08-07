/**
 * icons.jsx – shared SVG icon set.
 *
 * Feather-style stroke icons (24×24 viewBox, 1.5 stroke width) that inherit
 * the current text colour via `stroke="currentColor"`.
 *
 * Usage: <Icon.Book className="h-4 w-4" />
 */

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

const Svg = ({ children, className }) => (
  <svg {...base} className={className}>
    {children}
  </svg>
)

export const Icon = {
  // Brand / navigation
  Logo: ({ className }) => (
    <Svg className={className}>
      <path d="M13 3 L4 14h6l-1 7 9-11h-6l1-7Z" />
    </Svg>
  ),
  Search: ({ className }) => (
    <Svg className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  ),
  Folder: ({ className }) => (
    <Svg className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </Svg>
  ),
  File: ({ className }) => (
    <Svg className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
    </Svg>
  ),
  Chevron: ({ className }) => (
    <Svg className={className}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  ),

  // AI / actions
  Sparkles: ({ className }) => (
    <Svg className={className}>
      <path d="M12 3l1.8 4.7L18 9l-4.2 1.3L12 15l-1.8-4.7L6 9l4.2-1.3L12 3Z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
    </Svg>
  ),
  Message: ({ className }) => (
    <Svg className={className}>
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" />
    </Svg>
  ),
  Book: ({ className }) => (
    <Svg className={className}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </Svg>
  ),
  Eye: ({ className }) => (
    <Svg className={className}>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  Shield: ({ className }) => (
    <Svg className={className}>
      <path d="M12 3 5 6v5c0 4.5 3 7.8 7 10 4-2.2 7-5.5 7-10V6l-7-3Z" />
    </Svg>
  ),
  Zap: ({ className }) => (
    <Svg className={className}>
      <path d="M13 2 4.5 13.5H11L9.5 22 19 10.5h-6.5L13 2Z" />
    </Svg>
  ),
  Target: ({ className }) => (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </Svg>
  ),
  Clipboard: ({ className }) => (
    <Svg className={className}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4a3 3 0 0 1 6 0" />
      <path d="M9 12h6M9 16h6" />
    </Svg>
  ),
  Send: ({ className }) => (
    <Svg className={className}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </Svg>
  ),

  // UI feedback
  Check: ({ className }) => (
    <Svg className={className}>
      <path d="m4 12.5 5 5L20 6.5" />
    </Svg>
  ),
  Alert: ({ className }) => (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5" />
      <path d="M12 16h.01" />
    </Svg>
  ),
  Info: ({ className }) => (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Svg>
  ),
  Close: ({ className }) => (
    <Svg className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  ),
}

export default Icon
