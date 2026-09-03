import api from './client'

export const posDataApi = {
  searchStores: (keyword) =>
    api.get('/pos-data/stores/search', { params: { keyword } }).then(r => r.data),

  getCountries: () =>
    api.get('/pos-data/countries').then(r => r.data),

  getStates: (countryCodes) =>
    api.get('/pos-data/states', { params: { countryCodes: Array.isArray(countryCodes) ? countryCodes.join(',') : countryCodes } }).then(r => r.data),

  getCities: (stateCodes) =>
    api.get('/pos-data/cities', { params: { stateCodes: Array.isArray(stateCodes) ? stateCodes.join(',') : stateCodes } }).then(r => r.data),
}
