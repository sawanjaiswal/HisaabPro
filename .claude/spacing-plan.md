# Spacing Standardization — All Frontend Pages

## Requirement
- **Section gap:** 24px (gap-6 in Tailwind)
- **Section padding:** 0px top/bottom
- **Apply to:** All frontend pages and components

## Implementation Strategy

1. **Identify section patterns** in each page:
   - Form sections
   - Content cards
   - List containers
   - Header/footer areas

2. **Apply spacing:**
   ```tsx
   <div className="space-y-6">  {/* gap-6 = 24px */}
     <section className="py-0"> {/* no top/bottom padding */}
       ...
     </section>
     <section className="py-0">
       ...
     </section>
   </div>
   ```

3. **Convert existing:**
   - Remove `py-*` (except py-0)
   - Remove `mt-*` and `mb-*` between sections
   - Wrap section groups in `space-y-6`

## Files to Process
- All 80+ feature pages
- All components
- Landing pages
- Admin pages

Status: READY TO EXECUTE
