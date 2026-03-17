# Mission Plan: Calculator Redesign — Full-Height Premium  |  Status: Shipped

## 1. What
Redesign the built-in calculator bottom sheet to full-height (100dvh) with premium fintech aesthetics (CRED/Jupiter level). Add visible GST rate segmented control (5%, 12%, 18%, 28%) with animated sliding indicator and inclusive/exclusive toggle.

## 2. User Flows
- **Open calculator**: Tap FAB → full-height calculator sheet slides up
- **Select GST rate**: Tap any rate (5/12/18/28%) → sliding indicator animates to selection → rate applied to calculations
- **Toggle GST mode**: Tap Excl/Incl toggle → switches between exclusive and inclusive GST calculation
- **View breakdown**: After GST calculation → base/GST/total breakdown with rupee symbols

## 3. Technical Implementation

### Files Modified
| File | Change |
|------|--------|
| `src/features/settings/components/CalculatorSheet.tsx` | Rewritten — added GST segmented control bar, animated indicator via getBoundingClientRect, rupee symbols in breakdown |
| `src/features/settings/settings.css` | Section 8 replaced — full-height layout, premium GST panel, tighter spacing, dark theme overrides for all `.calc-gst-*` classes |

### Design Decisions
- GST rate bar uses grid background with 3px padding, sliding indicator with gradient + box-shadow + cubic-bezier transition
- Rate buttons: transparent bg, z-index above indicator, active state changes text to white
- Mode toggle: bordered button, active state gets primary-50 bg
- GST breakdown: 1px gap divider pattern using background color trick
- Tighter spacing: 54px key height, 36px pct buttons, space-1-5 gaps
- Display: deeper gradient (160deg, primary-800 to primary-900), 2.5rem result font

## 4. Acceptance Criteria
- [x] Calculator sheet fills 100dvh
- [x] GST rate buttons (5%, 12%, 18%, 28%) visible with animated sliding indicator
- [x] Inclusive/Exclusive toggle works
- [x] GST breakdown shows rupee symbols
- [x] Dark theme overrides for all new `.calc-gst-*` classes
- [x] `tsc --noEmit` passes
- [x] Build succeeds
