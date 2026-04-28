import api from './client'

/**
 * Fetches all {value, label} option groups for the campaign request form from the backend.
 * The backend derives them directly from Java enums, so this stays in sync automatically.
 *
 * Returns an object with keys:
 *   businessObjectives, geographyTiers, languages, offerTypes, keyMessages,
 *   supportingProofs, tones, priorities, budgetTiers, vendorTypes,
 *   kpiTypes, expectedOutputs, quantities
 */
export const enumsApi = {
  getCampaignFormOptions: () =>
    api.get('/enums/campaign-form').then((r) => r.data),
}
