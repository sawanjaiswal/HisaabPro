**[02:36 PM]**

## Verdict: REVISE

The plan is directionally right, but it describes a greenfield primitive. `SearchInput` already exists, so it is really a rewrite with 10+ live consumers. The plan doesn't mention them.

### Blockers

1. **It ignores the existing `SearchInput`.** `src/components/ui/SearchInput.tsx` already has these consumers:
   - `PartySearchField`, `ProductSearchInput` and `PartySearchInput` (invoices)
   - `PartyPickerField`, `PriceListOverrideSelector`, `JobForm`, `CustomOrderForm` and `UnitsPage`
   - `DataViewShell` and `PaymentDetailsSection`
   
   Several of these are combobox pickers that pass `ariaExpanded`, `ariaHasPopup`, `ariaAutocomplete`, `onFocus` and `onKeyDown`. The new props contract extends `InputHTMLAttributes`, so those might survive. It never says so, and it never lists the consumers or their visual contract.

2. **`variant="pill"` as the default breaks the picker consumers.**
   - The existing component is 44px with `radius-md`.
   - Those 8-9 form/picker consumers would silently turn into 48px pills.
   - Make `default` the default, and make `pill` opt-in for list headers.
   - Migrate the filter bars with explicit `variant="pill"`.

3. **It doesn't remove the drift class.**
   - The old `.search-bar` CSS is also overridden in `parties.css`, `products-redesign.css`, `payment-filter.css`, `outstanding-filter.css` and `tokens-dark.css`. The plan only deletes the `components-feedback.css` rule.
   - Eight files use raw `type="search"` outside the filter bars: `PurchasesPage`, `CategoriesPage`, `StockAlertsPage`, `StockAdjustmentsPage`, `AuditLogPage`, `AuditFilterDrawer`, `StorefrontProductPicker` and the payment filter bars. `AuditLogPage` and `AuditFilterDrawer` aren't on the migration list.
   - Nothing stops the next developer copy-pasting `<div className="search-bar">` again.
   - Add an `enforce.js` check or an `ssot.config.mjs` row with a `forbidden` regex for `className="search-bar"` and raw `<input type="search"` outside `SearchInput`. Without that wall this is a surface consolidation, not Level 6 SSOT.

4. **Dropping the `Input` primitive reintroduces the drift it set out to remove.**
   - The current component builds on `Input` for its single-border focus treatment.
   - The plan switches to a bare native `<input>` and re-implements border and focus on the wrapper.
   - That puts a second source of truth for focus rings next to `Input`.
   - Keep `Input` and strip its chrome through a documented `bare` or `unstyled` prop on `Input`. That removes the `!important` fight at its source instead of just not writing it.

### Usability and a11y

- **Touch target.** The clear button is 40px, but your bar is ≥44px. The scanner button in `.search-bar__action` is also 40px. Make both 44px. The 48px pill fits a 44px button.
- **Dual change API.** `onChange` plus `onValueChange` plus a "synthetic change event if needed" is two APIs and a footgun.
  - Pick one. A `(value: string)`-style handler is cleaner, but existing consumers use the event form.
  - If you keep the event form, clear via the native value setter plus a dispatched `input` event, so React's `onChange` fires once. A fabricated `{target:{value:''}}` breaks consumers that read `e.currentTarget`.
- **`type="search"` changes semantics.** The ARIA role becomes `searchbox`. Existing tests that query `getByRole('textbox')` will break. `AuditLogPage.test.tsx` already references this.
  - Run the affected suites.
  - Don't add `role="search"` on the wrapper by accident.
- **`onMouseDown preventDefault`.**
  - It's fine on desktop. On touch, the focus-retention behaviour is what matters, so verify it on a real device (the `npm run test:device` keyboard-inset check).
  - The explicit `inputRef.current?.focus()` after clear is the real guarantee, so keep it.
  - Hide the clear button when `disabled` or `readOnly`.
- **Clear button and scanner together.** The plan has `trailing` and `trailingWhenEmpty` plus an auto clear button, but not the layout when text is present and a scanner exists.
  - Specify the order: `[input][✕][scanner]`.
  - At 320px that is icon + input + 44 + 44 + padding, leaving about 150px for the input. Verify that with Hindi placeholders.
- **Placeholder ellipsis.** `text-overflow: ellipsis` on the input applies to the placeholder in Chromium. Test it in the Android WebView.
- **Keyboard.** Plan the Esc-to-clear behaviour. Make sure the native cancel button is hidden in Chromium/WebKit, and check there's no `-moz` clear on desktop Firefox.

### Performance and regressions

- **No debouncing is specified.**
  - The component stays presentational, but the plan should say hosts debounce, with a shared `useDebouncedValue`, and that `SearchInput` itself never does.
  - It should also say `SearchInput` is `React.memo`'d, with `trailing` nodes memoised by callers. An inline `<ScannerButton/>` in `trailing` otherwise re-renders on every keystroke.
- **Staged rollout.** The "canary then 14 files in one pass" plan is too big for one commit. Split it: ProductFilterBar first (the scanner case), then the other filter bars, then the pages. Take a 375px and 320px screenshot of each before and after.

### Scope hygiene

- **Archetypes 2 and 3 are noise.** `EntitySearch` and `PartySearch` already exist in `ui/`. The omnibar has no deliverable. Cut both from this plan, or label them out of scope with a stated reason (`user-confirmed` is needed per your scope-integrity rule). The plan reads as if it introduces them.
- **File plan missing.** If the new CSS stays under 250 lines it's fine, but a plan touching 15+ files should list the files and layers.
- **Wrong gate in the checklist.** The plan lists `enforce.js --all` but omits `npm run ssot`.
- **Missing mechanical checks.** Add these to section 3:
  - A grep proving zero remaining `.search-bar` references.
  - The unit tests for the changed components.
  - The offline-rules script.

### Counter-proposal

1. Inventory current `SearchInput` callers and freeze their rendered 44px/md output as the `default` variant.
2. Add `bare` to `Input` and rebuild `SearchInput` on it. Add `variant`, `trailing`, auto-clear and 44px targets.
3. Add the `forbidden` regex row and the `enforce.js` check first, so the baseline ratchet exists before migration.
4. Migrate in three commits: ProductFilterBar, the other filter bars, then the pages and the remaining raw `type="search"` sites.
5. Delete every `.search-bar*` rule across all five CSS files in the last commit, and make the grep check required.

I made no changes to code or the plan file.

**[02:36 PM]**