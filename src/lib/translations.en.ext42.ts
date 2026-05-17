// ─── HisaabPro — English Ext 42 (Epic D #128 — Commission) ────────────────
// PR6 — Commission frontend (rules CRUD + ledger + leaderboard + staff widget).
// All keys consumed via useLanguage(); no hardcoded EN/HI in JSX (Rule A).

export const enExt42 = {
  // ── Settings hub row ────────────────────────────────────────────────────
  commissionSettingsTitle: 'Commission',
  commissionSettingsDescription:
    'Reward staff with commission on every sale. Rules apply to POS, invoices, or both.',

  // ── Scope enum labels (used as commissionScope_${value}) ────────────────
  commissionScope_ALL: 'All sales',
  commissionScope_PRODUCT: 'Specific product',
  commissionScope_CATEGORY: 'Specific category',

  // ── Mode enum labels (used as commissionMode_${value}) ──────────────────
  commissionMode_PERCENT_GROSS: '% of subtotal',
  commissionMode_PERCENT_NET: '% of subtotal after discount',
  commissionMode_FLAT_PER_UNIT: 'Flat per unit (Rs)',

  // ── AppliesTo enum labels (used as commissionAppliesTo_${value}) ────────
  commissionAppliesTo_POS: 'POS sales only',
  commissionAppliesTo_INVOICE: 'Invoices only',
  commissionAppliesTo_BOTH: 'POS and invoices',

  // ── Rule form ───────────────────────────────────────────────────────────
  commissionRuleNameLabel: 'Rule name',
  commissionRuleNamePlaceholder: 'e.g. Salesperson 5% on Saree',
  commissionRuleNameInvalid: 'Name must be between 1 and 80 characters',

  commissionRuleScopeLabel: 'Apply to',
  commissionRuleProductIdLabel: 'Product ID',
  commissionRuleCategoryIdLabel: 'Category ID',
  commissionRuleScopeIdPlaceholder: 'Paste product or category ID',
  commissionRuleScopeMismatch: 'Remove the scope ID for "All sales" rules',
  commissionRuleScopeRequired: 'Choose a product or category for this scope',

  commissionRuleModeLabel: 'How it is calculated',
  commissionRuleAppliesToLabel: 'Where it applies',

  commissionRateLabel: 'Rate (%)',
  commissionRateHint: 'Up to 100%. Indian retail commission is usually 1-10%.',
  commissionRateInvalid: 'Rate must be between 0 and 100%',
  commissionRateWarnBanner:
    'Rate is at or above {percent} of the sale — staff would take a large share.',
  commissionRateBlockBanner:
    'Rate cannot be {percent} or more. Lower the rate to save.',
  commissionRateExceedsToast:
    'Server rejected: commission rate cannot exceed 100%',

  commissionFlatLabel: 'Flat amount per unit (Rs)',
  commissionFlatHint: 'Max Rs 10,000 per unit.',
  commissionFlatInvalid: 'Flat amount must be between Rs 1 and Rs 10,000 per unit',

  commissionRuleStaffLabel: 'Restrict to staff (optional)',
  commissionRuleStaffPlaceholder: 'staff-id-1, staff-id-2',
  commissionRuleStaffHint:
    'Leave blank to apply to all staff. Comma-separated IDs.',

  commissionRuleActiveLabel: 'Active',

  commissionRuleCreateButton: 'New rule',
  commissionRuleUpdateButton: 'Save rule',
  commissionRuleSaveProgress: 'Saving…',
  commissionRuleCreatedToast: 'Commission rule created',
  commissionRuleUpdatedToast: 'Commission rule updated',
  commissionRuleQueuedToast: 'Saved — will sync when online',
  commissionRuleSaveFailed: 'Could not save commission rule',
  commissionRuleDeletedToast: 'Commission rule deleted',
  commissionRuleDeleteFailed: 'Could not delete commission rule',

  commissionRuleCreateDrawerTitle: 'New commission rule',
  commissionRuleEditDrawerTitle: 'Edit commission rule',

  // ── Rule list ───────────────────────────────────────────────────────────
  commissionRulesLoadFailed: 'Could not load commission rules',
  commissionRulesEmptyTitle: 'No commission rules yet',
  commissionRulesEmptyDesc:
    'Create your first rule to start rewarding staff on every sale.',
  commissionRuleInactive: 'Inactive',
  commissionRuleEdit: 'Edit rule',
  commissionRuleDelete: 'Delete rule',
  commissionRuleDeleteCancel: 'Cancel',
  commissionRuleDeleteConfirmTitle: 'Delete commission rule?',
  commissionRuleDeleteConfirmDesc:
    'The rule "{name}" will no longer apply to new sales. Past commissions are preserved.',
  commissionRuleStaffCount: 'Restricted to {count} staff',
  commissionRuleListFlatPerUnit: 'per unit',

  // ── Ledger ──────────────────────────────────────────────────────────────
  commissionLedgerHeader: 'My Commission',
  commissionLedgerHeaderOther: 'Staff Commission',
  commissionLedgerPeriodLabel: 'Period',
  commissionLedgerLoadFailed: 'Could not load commission ledger',
  commissionLedgerEmptyTitle: 'No commission this period',
  commissionLedgerEmptyDesc:
    'Sales in {period} did not earn any commission yet.',
  commissionLedgerLoadMore: 'Load more',
  commissionLedgerSummaryMeta: '{count} sales · {period}',
  commissionLedgerBasis: 'Basis',

  // ── Cross-tenant 404 ────────────────────────────────────────────────────
  commissionStaffNotFoundTitle: 'Staff not found',
  commissionStaffNotFoundDesc:
    'This staff member is not part of your business.',
  commissionStaffNotFoundToast: 'Staff not found in this business',

  // ── Leaderboard ─────────────────────────────────────────────────────────
  commissionLeaderboardHeader: 'Leaderboard',
  commissionLeaderboardPeriodLabel: 'Period',
  commissionLeaderboardLoadFailed: 'Could not load leaderboard',
  commissionLeaderboardEmptyTitle: 'No commissions this period',
  commissionLeaderboardEmptyDesc:
    'Once sales earn commission, staff rankings appear here.',
  commissionLeaderboardSortLabel: 'Sort by',
  commissionLeaderboardSortByAmount: 'Total commission',
  commissionLeaderboardSortByCount: 'Sale count',
  commissionLeaderboardSortByName: 'Name',
  commissionLeaderboardRankHeader: '#',
  commissionLeaderboardStaffHeader: 'Staff',
  commissionLeaderboardAmountHeader: 'Total',
  commissionLeaderboardCountHeader: 'Sales',
  commissionLeaderboardUnknownStaff: 'Unknown',
  commissionLeaderboardForbiddenTitle: 'Leaderboard is restricted',
  commissionLeaderboardForbiddenDesc:
    'Only owners and admins with the "View all commission" permission can see this page.',

  // ── Dashboard staff widget ──────────────────────────────────────────────
  commissionWidgetTitle: 'My commission (MTD)',
  commissionWidgetEmpty: 'No sales this month yet',
  commissionWidgetSaleCount: '{count} sales this month',

  dashboardStaffSectionHeading: 'Your performance',
} as const
