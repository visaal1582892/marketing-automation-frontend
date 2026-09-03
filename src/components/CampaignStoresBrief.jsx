import React, { useState, useMemo } from 'react'
import Pagination from './Pagination'

export default function CampaignStoresBrief({ stores, legacyStoreId }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 10

  if (!stores || stores.length === 0) {
    if (!legacyStoreId) return <span className="text-slate-400 italic">None</span>
    return <span>{legacyStoreId}</span>
  }

  const filteredStores = useMemo(() => {
    if (!search) return stores
    const q = search.toLowerCase()
    return stores.filter(s => 
      s.storeId?.toLowerCase().includes(q) || 
      s.name?.toLowerCase().includes(q) || 
      s.pinCode?.toLowerCase().includes(q)
    )
  }, [stores, search])

  const totalElements = filteredStores.length
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize))
  
  // Ensure page is in bounds if filter changes
  const safePage = Math.min(page, Math.max(0, totalPages - 1))
  const paginatedStores = filteredStores.slice(safePage * pageSize, (safePage + 1) * pageSize)

  return (
    <div className="mt-2 flex flex-col rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex justify-end">
        <input 
          type="text" 
          placeholder="Search stores..." 
          className="px-3 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 w-64"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Store ID</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Name</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Address</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Pincode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {paginatedStores.length > 0 ? paginatedStores.map((s, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-brand-700">{s.storeId}</td>
                <td className="px-3 py-2 text-slate-600">{s.name || '-'}</td>
                <td className="px-3 py-2 text-slate-600">{s.address || '-'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{s.pinCode || '-'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-slate-500 italic">No stores found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalElements > pageSize && (
        <div className="bg-slate-50 border-t border-slate-200 p-2">
          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalElements={totalElements}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}
