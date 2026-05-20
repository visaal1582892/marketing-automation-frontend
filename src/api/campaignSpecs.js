import api from './client'

/**
 * API for Campaign Specifications hierarchical mappings.
 * Business Vertical → Business Type → Store / Format Type
 */
const campaignSpecsApi = {
  // ── Business Vertical → Business Type mappings ──────────────────────────────

  /** Full list of all BV → BT mappings (admin page). */
  listVerticalTypeMappings: () =>
    api.get('/campaign-specs/vertical-type-mappings').then((r) => r.data),

  /** Business Types filtered by selected vertical (form use). */
  getBusinessTypesByVertical: (verticalId) =>
    api.get('/campaign-specs/business-types', { params: { verticalId } }).then((r) => r.data),

  createVerticalTypeMapping: (verticalId, typeId) =>
    api.post('/campaign-specs/vertical-type-mappings', { verticalId, typeId }).then((r) => r.data),

  deleteVerticalTypeMapping: (id) =>
    api.delete(`/campaign-specs/vertical-type-mappings/${id}`).then((r) => r.data),

  // ── Business Type → Store Format mappings ───────────────────────────────────

  /** Full list of all BT → SFT mappings (admin page). */
  listTypeFormatMappings: () =>
    api.get('/campaign-specs/type-format-mappings').then((r) => r.data),

  /** Store Format Types filtered by selected business type (form use). */
  getStoreFormatsByBusinessType: (businessTypeId) =>
    api.get('/campaign-specs/store-formats', { params: { businessTypeId } }).then((r) => r.data),

  createTypeFormatMapping: (typeId, formatId) =>
    api.post('/campaign-specs/type-format-mappings', { typeId, formatId }).then((r) => r.data),

  deleteTypeFormatMapping: (id) =>
    api.delete(`/campaign-specs/type-format-mappings/${id}`).then((r) => r.data),
}

export default campaignSpecsApi
