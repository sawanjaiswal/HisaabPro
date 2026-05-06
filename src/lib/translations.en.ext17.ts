// ─── HisaabPro — English Ext 17 (GST-04 Invoice Form UI) ────────────────────

export const enExt17 = {
  // ── Tax Picker Column ─────────────────────────────────────────────────────
  taxPickerLabel:               'Tax',
  taxPickerPlaceholder:         '-- Select tax --',
  taxPickerNotSet:              'Tax not set',

  // ── HSN Typeahead ─────────────────────────────────────────────────────────
  hsnSacLabel:                  'HSN/SAC',
  hsnTypeMin4:                  'Type 4+ chars',
  hsnSearching:                 'Searching...',
  hsnSearchUnavailable:         'Search unavailable',
  hsnNoResults:                 'No results',

  // ── Place of Supply Selector ──────────────────────────────────────────────
  placeOfSupplyLabel:           'Place of Supply',
  placeOfSupplyPlaceholder:     '-- Select state --',
  placeOfSupplyRequired:        'Place of supply is required',

  // ── RCM Toggle ───────────────────────────────────────────────────────────
  rcmCheckboxLabel:             'Reverse Charge Mechanism (RCM)',
  rcmAdvisoryShort:             'Customer will self-assess tax under RCM. Tax is shown on the invoice but not collected.',

  // ── Tax Pricing Chip ─────────────────────────────────────────────────────
  taxModeExclusive:             'Exclusive',
  taxModeInclusiveMrp:          'Inclusive (MRP)',
  taxModeExclusiveDesc:         'Tax added on top of price',
  taxModeInclusiveDesc:         'Tax included in price',
  taxPricingGroupLabel:         'Tax pricing mode',

  // ── Untagged Tax Dialog ───────────────────────────────────────────────────
  untaggedDialogTitle:          'Some items have no tax rate',
  untaggedDialogDesc:           'One or more line items do not have a tax rate assigned. They will be treated as Exempt (0%). Continue saving?',
  untaggedDialogGoBack:         'Go back and fix',
  untaggedDialogSaveAnyway:     'Save anyway',
}
