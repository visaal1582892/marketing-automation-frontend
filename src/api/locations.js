import api from './client'

export const locationsApi = {
  suggest: (query, pod) =>
    api.get('/locations/suggest', {
      params: {
        query,
        ...(pod ? { pod } : {}),
      },
    }).then(r => r.data),
}
