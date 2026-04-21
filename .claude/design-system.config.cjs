/**
 * design-system.config.js — SSOT for HisaabPro design rules
 *
 * Single source of truth for:
 *   - Token namespaces (what CSS vars are valid)
 *   - Component registry (what UI elements must use which import)
 *   - Banned patterns (what can never appear in frontend code)
 *   - /hp-design skill session-gate config
 *
 * Consumers:
 *   - /hp-design skill (.claude/skills/hp-design/SKILL.md) — reads Phase 0
 *   - ~/.claude/hooks/pre-tool-gate.sh → .claude/hooks/check-design-gate.js
 *
 * CommonJS on purpose — hooks and scripts/enforce.js both use CJS.
 */

'use strict';

/** @type {Array<{name:string,pattern:RegExp|string,enforcedBy:string,severity:'error'|'warn'|'info',msg?:string,applyTo?:object,exclude?:RegExp}>} */
const BANNED_PATTERNS = [
  // ── Color system ────────────────────────────────────────────────────────
  {
    name: 'hex-in-inline-style',
    pattern: /style=\{[^}]*#[0-9a-f]{3,8}/i,
    enforcedBy: 'scripts/enforce.js',
    severity: 'error',
    msg: 'Hex color in inline style — use var(--color-*) from tokens-colors.css',
    exclude: /enforce-ignore/,
  },
  {
    name: 'rgb-in-inline-style',
    pattern: /style=\{[^}]*rgba?\s*\(/,
    enforcedBy: 'scripts/enforce.js',
    severity: 'error',
    msg: 'rgb()/rgba() in inline style — use var(--color-*)',
    exclude: /enforce-ignore/,
  },
  {
    name: 'tailwind-color-class',
    pattern: /className=["'][^"']*\b(bg|text|border)-(red|green|blue|yellow|gray|pink|cyan|amber|orange|purple|indigo|rose|emerald|teal|sky|violet|fuchsia|lime)-\d/,
    enforcedBy: 'scripts/enforce.js',
    severity: 'warn',
    msg: 'Tailwind color class — use CSS variable var(--color-*) for token compliance',
    applyTo: { frontendOnly: true, excludeTests: true },
    exclude: /enforce-ignore/,
  },

  // ── Typography ──────────────────────────────────────────────────────────
  {
    name: 'px-font-size-inline',
    pattern: /fontSize:\s*['"]?\d+px/,
    enforcedBy: 'scripts/enforce.js',
    severity: 'error',
    msg: 'px fontSize — use var(--fs-*) token (rem-based)',
  },
  {
    name: 'px-font-size-tailwind',
    pattern: /className=["'][^"']*text-\[\d+px\]/,
    enforcedBy: 'scripts/enforce.js',
    severity: 'error',
    msg: 'text-[Npx] — use text-[var(--fs-*)] instead',
  },

  // ── Z-index & timing (must use config SSOT) ─────────────────────────────
  {
    name: 'hardcoded-z-index-style',
    pattern: /zIndex\s*:\s*\d{2,}/,
    enforcedBy: 'scripts/enforce.js',
    severity: 'warn',
    msg: 'Hardcoded z-index — use Z from src/config/zIndexes.ts or var(--z-*)',
    applyTo: { frontendOnly: true, excludeTests: true },
    exclude: /Z|zIndexes|--z-|enforce-ignore/,
  },
  {
    name: 'hardcoded-setTimeout-numeric',
    pattern: /setTimeout\s*\([^,]+,\s*\d{4,}\s*\)/,
    enforcedBy: 'scripts/enforce.js',
    severity: 'warn',
    msg: 'Hardcoded timeout ms — use TIMINGS from src/config/timings.ts',
    applyTo: { frontendOnly: true, excludeTests: true },
    exclude: /TIMINGS|timings|enforce-ignore/,
  },

  // ── Raw HTML (must use UI components) ───────────────────────────────────
  {
    name: 'raw-button-in-pages',
    pattern: /<button[\s>]/,
    enforcedBy: 'scripts/enforce.js',
    severity: 'warn',
    msg: 'Raw <button> — use <Button> from @/components/ui/Button',
    applyTo: { frontendOnly: true, excludeTests: true },
    exclude: /enforce-ignore|components\/ui\//,
  },
  {
    name: 'raw-input-in-pages',
    pattern: /<input[\s>]/,
    enforcedBy: 'scripts/enforce.js',
    severity: 'warn',
    msg: 'Raw <input> — use <Input> from @/components/ui/Input',
    applyTo: { frontendOnly: true, excludeTests: true },
    exclude: /enforce-ignore|components\/ui\/|type=["']hidden/,
  },
  {
    name: 'window-confirm',
    pattern: /window\.confirm\s*\(/,
    enforcedBy: 'scripts/enforce.js',
    severity: 'error',
    msg: 'window.confirm() — use <ConfirmDialog> from @/components/ui/ConfirmDialog',
    applyTo: {
      excludeFilePatterns: [/components\/ui\/ConfirmDialog\.tsx$/],
    },
    exclude: /eslint-disable|enforce-ignore|^\s*\*|^\s*\/\//,
  },
  {
    name: 'alert-call',
    pattern: /(?<![a-zA-Z.])alert\s*\(/,
    enforcedBy: 'scripts/enforce.js',
    severity: 'error',
    msg: 'alert() — use useToast() for user notifications',
    applyTo: {
      excludeFilePatterns: [
        /utils\/sanitize(\.test)?\.ts$/,
        /__tests__\//,
      ],
    },
    exclude: /eslint-disable|enforce-ignore|window\.alert|\.alert\(|^\s*\*|^\s*\/\//,
  },

  // ── i18n ────────────────────────────────────────────────────────────────
  {
    name: 'hardcoded-string-in-jsx',
    pattern: /(placeholder|title|label|alt|aria-label)=["'][A-Z]\w{2,}/,
    enforcedBy: 'scripts/enforce.js',
    severity: 'warn',
    msg: 'Hardcoded string in JSX — use t.keyName via useLanguage() (src/context/LanguageContext.tsx)',
  },
];

/** Token namespaces — any CSS var outside these is suspect. */
const TOKEN_NAMESPACES = {
  cssVarPrefixes: [
    '--color-',
    '--text-',
    '--bg-',
    '--border-',
    '--fs-',
    '--lh-',
    '--ls-',
    '--radius-',
    '--shadow-',
    '--gradient-',
    '--duration-',
    '--ease-',
    '--z-',
    '--bottom-nav-',
    '--header-',
    '--side-padding',
    '--font-',
  ],
  configFiles: {
    zIndexes: 'src/config/zIndexes.ts (import { Z })',
    timings: 'src/config/timings.ts (import { TIMINGS })',
    routes: 'src/config/routes.config.ts (import { ROUTES })',
    app: 'src/config/app.config.ts',
    translations: 'src/lib/translations.ts (+ .en/.hi variants); hook: src/context/LanguageContext.tsx → useLanguage()',
  },
  tokensSource: [
    'src/styles/tokens-core.css',
    'src/styles/tokens-colors.css',
    'src/styles/tokens-dark.css',
  ],
};

/** Component registry — what every visual element should use. */
const COMPONENTS = {
  Button: {
    import: '@/components/ui/Button',
    variants: ['primary', 'secondary', 'outline', 'text', 'ghost', 'danger'],
    sizes: ['sm', 'md', 'lg'],
  },
  Input: { import: '@/components/ui/Input' },
  Card: { import: '@/components/ui/Card' },
  Badge: { import: '@/components/ui/Badge', variants: ['success', 'error', 'warning', 'info', 'default'] },
  Drawer: { import: '@/components/ui/Drawer' },
  Modal: { import: '@/components/ui/Modal' },
  ConfirmDialog: { import: '@/components/ui/ConfirmDialog' },
  PartyAvatar: { import: '@/components/ui/PartyAvatar' },
  BarcodeScanner: { import: '@/components/ui/BarcodeScanner' },
  BulkActionBar: { import: '@/components/ui/BulkActionBar' },
};

/** Architectural rules. */
const ARCHITECTURE = {
  maxLinesPerFile: 250,
  featureStructure: ['types', 'constants', 'utils', 'hook', 'components', 'Page'],
  utilsMustBePure: true,
};

/** Gold-standard references — mimic these. Update when better ones land. */
const GOLD_STANDARD = {
  uiButton: 'src/components/ui/Button.tsx',
  uiInput: 'src/components/ui/Input.tsx',
  uiCard: 'src/components/ui/Card.tsx',
  uiConfirmDialog: 'src/components/ui/ConfirmDialog.tsx',
};

/**
 * /hp-design skill session gate. pre-tool-gate.sh → check-design-gate.js read
 * this to decide if a Write/Edit to a UI file is allowed this session.
 */
const SESSION_GATE = {
  // Paths that require /hp-design to have been invoked this session
  gatedPathPatterns: [
    /^src\/features\/[^/]+\/.*\.(tsx|css)$/,
    /^src\/components\/ui\/.*\.(tsx|css)$/,
    /^src\/components\/layout\/.*\.(tsx|css)$/,
    /^src\/components\/feedback\/.*\.(tsx|css)$/,
    /^src\/pages\/.*\.(tsx|css)$/,
    /^src\/styles\/.*\.css$/,
  ],
  // Path exceptions (never gated, even if they match above)
  exemptPathPatterns: [
    /\.test\.tsx?$/,
    /\.stories\.tsx?$/,
    /__tests__\//,
    /\/config\//,
    // Landing/marketing components are visual-only, not app UI — exempt for now.
    /^src\/components\/ui\/(accordion|bento-grid|cta-section|feature|hero-|testimonial|pricing-|footer-|social-proof|invoice-templates|saa-s-template|scaled-mockup|section-with-mockup|sticky-mobile-cta|cybernetic|database-rest-api|radial-orbital|carousel|gallery-section|before-after|separator|magicui)/,
  ],
  markerFile: '.claude/design-session-active',
  ttlMinutes: 240,

  planFile: '.claude/design-plan-active.md',
  requiredPlanStatus: 'approved',
  planTtlMinutes: 240,
};

/** Frozen paths — require explicit approval to modify. */
const FROZEN = {
  source: '.claude/frozen-files.json',
};

module.exports = {
  BANNED_PATTERNS,
  TOKEN_NAMESPACES,
  COMPONENTS,
  ARCHITECTURE,
  GOLD_STANDARD,
  SESSION_GATE,
  FROZEN,
};
