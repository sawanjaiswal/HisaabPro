---
symptom: Product Detail page hero always shows an initials-letter avatar ("A") even after the user uploads a product photo during creation.
root_cause_file: src/features/products/components/ProductDetailHeader.tsx:26
root_cause_reason: ProductDetailHeader unconditionally renders <PartyAvatar name={product.name} .../>, which only ever draws initials — it never reads product.images[0], so an uploaded photo is fetched from the API but never rendered.
---
## 5-whys

1. Why does the detail page show initials instead of the photo? — `ProductDetailHeader.tsx` renders `<PartyAvatar name={product.name} size="lg" className="party-detail-avatar" />` with no condition — it never looks at `product.images`.
2. Why does it never look at `product.images`? — `PartyAvatar` is a generic initials-circle component (used for parties/customers/staff too) with no `src`/image prop at all — it was never wired up to accept a photo.
3. Why wasn't it wired up? — The sibling `ProductCard.tsx` (products list) already has the correct pattern: `product.imageUrl ? <img src={product.imageUrl} .../> : <PartyAvatar .../>`, but that same ternary was never copied into `ProductDetailHeader.tsx` when the detail page was built.
4. Why did the image upload appear to work with no error? — It does work: `useProductForm.ts` calls `uploadProductImages(created.id, pendingImages)` after create, and the server select (`server/src/services/product/selects.ts:43` `images: true`) returns the array on `GET /products/:id`. The data reaches the client correctly — only the header component fails to consume it.
5. Why wasn't this caught earlier? — No existing test or manual check compared "product has images uploaded" against "detail header renders a photo" — the list page (which does the ternary correctly) was the only page anyone visually checked.

## Hypothesis

Mirror the existing `ProductCard.tsx` pattern in `ProductDetailHeader.tsx`: render `product.images[0]` as an `<img>` (reusing the `party-detail-avatar` box sizing plus a `product-detail-thumb` class for `object-fit: cover`) when present, falling back to `PartyAvatar` only when there are no uploaded images.

## Failing test

Manual repro only (no existing test harness for this component) — verified via code read that `ProductDetailHeader.tsx` never referenced `product.images` before the fix, confirmed the field is populated end-to-end (upload → server select → API response).

## Re-review

Fixed the cause, not the symptom: this isn't a patch that hides the missing image behind a nicer fallback — it makes the header actually read the `images` field that was already being uploaded and returned by the API, matching the pattern already proven correct in `ProductCard.tsx`.
