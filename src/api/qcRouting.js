import api from './client'

const BASE = '/admin/qc-routing'

const qcRoutingApi = {
  /** Returns current mappings plus available worker and manager roles. */
  getConfig: () => api.get(BASE),

  /**
   * Saves the full QC routing config.
   * @param {Array<{workerRoleId: string, managerRoleId: string}>} mappings
   */
  saveConfig: (mappings) => api.put(BASE, mappings),
}

export default qcRoutingApi
