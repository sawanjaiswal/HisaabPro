/**
 * Party service — barrel re-export.
 *
 * Split into domain-specific files for maintainability:
 *   party-crud.service.ts        — list, detail, create, update, delete + transactions
 *   party-subresource.service.ts — address & pricing sub-resources
 *   party-group.service.ts       — party group CRUD
 *   party-custom-field.service.ts — custom field definitions CRUD
 *
 * All existing `import { … } from './party.service'` continue to work.
 */

// Party CRUD + transactions
export {
  buildPartyQuery,
  getParties,
  getParty,
  createParty,
  updateParty,
  deleteParty,
  getPartyTransactions,
} from './party-crud.service'

// Address & Pricing sub-resources
export {
  addPartyAddress,
  updatePartyAddress,
  deletePartyAddress,
  updatePartyPricing,
} from './party-subresource.service'
export type { PartyAddressInput, PartyPricingInput } from './party-subresource.service'

// Party Groups
export {
  getPartyGroups,
  createPartyGroup,
  updatePartyGroup,
  deletePartyGroup,
} from './party-group.service'
export type { PartyGroupInput } from './party-group.service'

// Custom Fields
export {
  getPartyCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
} from './party-custom-field.service'
export type {
  CustomFieldDefinition,
  CustomFieldInput,
  CustomFieldValue,
} from './party-custom-field.service'
