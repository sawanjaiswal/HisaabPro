// ─── HisaabPro — English Ext 26 (BOM / Production — PR4-PR6) ────────────────

export const enExt26 = {
  // ── Nav ──────────────────────────────────────────────────────────────
  navProduction:              'Production',
  navRecipes:                 'Recipes',
  navProductionRuns:          'Production Runs',

  // ── BOM list ─────────────────────────────────────────────────────────
  bomListTitle:               'Recipes',
  bomListEmpty:               'No recipes yet',
  bomListEmptyBody:           'Create a Bill of Materials to start tracking production.',
  bomListError:               'Could not load recipes',
  bomListNewBtn:              'New Recipe',

  // ── BOM form ─────────────────────────────────────────────────────────
  bomFormNewTitle:            'New Recipe',
  bomFormEditTitle:           'Edit Recipe',
  bomFormNameLabel:           'Recipe name',
  bomFormProductLabel:        'Finished product',
  bomFormNotesLabel:          'Notes',
  bomFormIsDefaultLabel:      'Set as default recipe for this product',
  bomFormIsActiveLabel:       'Recipe is active',
  bomFormComponentsTitle:     'Components',
  bomFormAddComponent:        'Add component',
  bomFormSaveBtn:             'Save Recipe',
  bomFormSuccessToast:        'Recipe saved',
  bomFormVersionedToast:      'New recipe version created',
  bomFormDeleteBtn:           'Delete Recipe',
  bomFormDeleteConfirmTitle:  'Delete Recipe?',
  bomFormDeleteConfirmBody:   'This will soft-delete the recipe. Existing production runs will not be affected.',

  // ── BOM validation ────────────────────────────────────────────────────
  bomValidName:               'Recipe name is required',
  bomValidProduct:            'Finished product is required',
  bomValidComponents:         'Add at least one component',
  bomValidQty:                'Quantity must be greater than 0',
  bomValidSelfRef:            'Component cannot be the same as the finished product',
  bomValidDuplicate:          'This product is already added',

  // ── Production runs ───────────────────────────────────────────────────
  prListTitle:                'Production Runs',
  prListEmpty:                'No production runs yet',
  prListEmptyBody:            'Start a production run from a BOM to track your manufacturing.',
  prListError:                'Could not load production runs',
  prListStartBtn:             'Start Run',

  // ── Wizard ────────────────────────────────────────────────────────────
  prWizardStep1:              'Choose Recipe',
  prWizardStep2:              'Quantity & Date',
  prWizardStep3:              'Review Components',
  prWizardStep4:              'Confirm Run',
  prWizardConfirmBtn:         'Start Production Run',
  prWizardStarting:           'Starting run...',
  prWizardSuccess:            'Production run completed',

  // ── Stock warnings ────────────────────────────────────────────────────
  prStockInsufficient:        'Not enough stock',
  prStockLowBanner:           'Some materials are low on stock. Run will proceed with warnings recorded.',
  prStockBlockBanner:         'Cannot proceed — insufficient stock for one or more components.',

  // ── Cancel ────────────────────────────────────────────────────────────
  prCancelBtn:                'Cancel Run',
  prCancelTitle:              'Cancel Production Run?',
  prCancelBody:               'This will reverse all stock movements. Finished goods will be deducted and raw materials restored. This cannot be undone.',
  prCancelKeep:               'Keep Run',
  prCancelSuccess:            'Production run cancelled',
  prBomNotActive:             'This recipe is no longer active',
}
