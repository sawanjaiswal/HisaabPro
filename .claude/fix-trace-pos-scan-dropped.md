---
symptom: Two units of the same item scanned in one motion bill as one unit — the second scan is discarded with no toast, no beep and no row change.
root_cause_file: src/features/pos/useBarcodeLookup.ts:75
root_cause_reason: A flat 300ms cooldown dropped every lookup regardless of which code it was or where it came from, so any scan following another inside that window was silently lost.
---

## 5-whys

1. **Why did the cart still say ×1 after scanning the item twice?**
   The second lookup never ran.
2. **But why not?** `lookup()` returned early: `now - lastLookupRef.current < 300`.
3. **But why is there a 300ms floor on scanning at all?** To swallow a scanner's
   repeat-fire of a single trigger pull — the same label decoded several times
   in a row.
4. **But why did that guard also drop a deliberate second scan?** Because it was
   written as "no lookup within 300ms of any lookup" — it keyed on time only,
   not on the code and not on where the code came from. A cashier and a camera
   look identical to it.
5. **But why did nobody notice?** Because the drop is silent. There is no toast,
   no error and no state change to see; the cart simply reads ×1 and the
   customer is charged for one bottle of the two they are carrying out. Stock
   drifts by the same unit.

**Root cause:** the echo guard was placed on the shared entry point rather than
on the one input that actually echoes. Repeats from the camera (continuous
decode while pointed at a label) and repeats from a person (two trigger pulls =
two units) are different events, and the code had no way to tell them apart.

## Hypothesis

Give `lookup()` a `source` — `'manual'` (typed / wedge-scanner Enter) or
`'camera'` — and apply the same-code cooldown only to `'camera'`, which is the
only source that can emit an unintended repeat. A deliberate scan is then always
a sale, and the camera keeps its de-duplication.

## Failing test

`e2e/gold/pos-ui.spec.ts` — TC-POS-02: scan a barcode twice, expect ONE cart
line at quantity 2. Before the fix the second scan is dropped and the line stays
at 1.
