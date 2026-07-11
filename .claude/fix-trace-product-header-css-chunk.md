---
symptom: Product Detail hero card can render completely unstyled (no gradient, no white text, wrong avatar size) on a fresh visit before the Parties route has ever loaded.
root_cause_file: src/features/products/components/ProductDetailHeader.tsx:25
root_cause_reason: ProductDetailHeader borrows classnames (party-detail-header, party-detail-avatar, party-detail-info, party-detail-name, party-detail-meta, party-detail-balance) whose only CSS definitions live in src/features/parties/party-detail-header.css — a file imported exclusively by the Parties feature's lazy route chunk, never by the Products chunk.
---
## 5-whys

1. Why can the hero card render unstyled? — Its CSS classes (`party-detail-*`) are not defined in any stylesheet reachable from the Products route's own JS chunk.
2. Why aren't they defined there? — `party-detail-header.css` is only imported by 3 files under `src/features/parties/` (`PartyDetailPage.tsx`, `PartyDetailHeader.tsx`, `PartyOverviewTab.tsx`); `ProductDetailHeader.tsx` never imports it, nor is it part of the global cascade in `src/styles/globals.css`.
3. Why does `ProductDetailHeader.tsx` use those classnames at all? — It was built by copying `PartyDetailHeader.tsx`'s JSX/classnames as a starting point but never swapped to the Products-scoped equivalents, even though `src/features/products/product-detail.css` already defines a parallel, correctly-scoped set (`.product-detail-header`, `.product-detail-avatar`, `.product-detail-info`, `.product-detail-name`, `.product-detail-sku`, `.product-detail-meta`, `.product-detail-stock`) that was sitting unused.
4. Why did this go unnoticed in manual testing? — Vite's route-level code splitting (`lazy(() => import(...))` per route in `src/app.routes.ts`) means each route ships its own CSS chunk; visually the bug only appears when the Products route's chunk loads without the Parties chunk already cached — e.g. a deep link straight to `/products/:id`, a fresh install, or a cleared cache, before the PWA service worker completes its background precache of other routes' assets. A developer who always browses Parties before Products in the same session never hits the uncached path.
5. Why does the PWA service worker not fully mask this? — `dist/sw.js` precaches all built chunks including `PartyDetailPage-*.css`, but precaching only completes on repeat visits after install — a first-time or cache-cleared visit to `/products/:id` can render before that precache pass has fetched the Parties chunk.

## Hypothesis

Point `ProductDetailHeader.tsx` at the already-existing, already-correctly-scoped `.product-detail-*` classes in `product-detail.css` (imported by `ProductDetailPage.tsx`, part of the Products route's own chunk) instead of the borrowed `.party-detail-*` classes. This removes the cross-feature CSS dependency entirely and eliminates dead CSS in `product-detail.css` at the same time — no new styles needed, only a classname swap. Also move `.product-detail-thumb` (the uploaded-photo override, added earlier this session) from `party-detail-header.css` into `product-detail.css`, since it is exclusively consumed by `ProductDetailHeader.tsx` and has the same cross-chunk exposure.

## Failing test

Manual repro via production build: `npm run build`, then `grep -c "party-detail-header\|party-detail-avatar\|money-hero" dist/assets/ProductDetailPage-*.css` returns 0 — confirming the Products route's compiled CSS chunk contains none of the selectors `ProductDetailHeader.tsx` depends on, while `dist/assets/PartyDetailPage-*.css` does define them.

## Re-review

Fixed the cause, not the symptom: this isn't a patch that force-loads the Parties CSS from the Products chunk (which would just paper over the coupling and bloat the chunk) — it retargets the component onto CSS that already exists, is already correctly scoped to Products, and was previously dead code. The fix simultaneously removes a cross-feature dependency and deletes duplication.
