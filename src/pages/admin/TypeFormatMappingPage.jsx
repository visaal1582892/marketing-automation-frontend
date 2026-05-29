import { useCallback, useEffect, useState } from 'react'
import { masterApi } from '../../api/masterData'
import campaignSpecsApi from '../../api/campaignSpecs'
import BackToMaster from '../../components/admin/BackToMaster'
import CampaignMappingTable from '../../components/admin/CampaignMappingTable'
import { useToast } from '../../components/Toast'

const toOpt = (item) => ({ value: item.id, label: item.name })

export default function TypeFormatMappingPage() {
  const toast = useToast()
  const [mappings, setMappings] = useState([])
  const [loading, setLoading] = useState(true)
  const [bizTypes, setBizTypes] = useState([])
  const [formats, setFormats] = useState([])
  const [filterParent, setFilterParent] = useState('')
  const [filterChild, setFilterChild] = useState('')

  const loadMappings = useCallback(() => {
    setLoading(true)
    campaignSpecsApi.listTypeFormatMappings()
      .then(setMappings)
      .catch(() => toast.error('Failed to load mappings'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => {
    masterApi.list('business-types').then(setBizTypes).catch(() => {})
    masterApi.list('store-format-types').then(setFormats).catch(() => {})
    loadMappings()
  }, [loadMappings])

  const handleAdd = async (typeId, formatId) => {
    try {
      await campaignSpecsApi.createTypeFormatMapping(typeId, formatId)
      toast.success('Mapping added')
      loadMappings()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add mapping')
      throw err
    }
  }

  const handleDelete = async (id) => {
    try {
      await campaignSpecsApi.deleteTypeFormatMapping(id)
      toast.success('Mapping removed')
      loadMappings()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to remove mapping')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-10">
      <BackToMaster />
      <div>
        <h1 className="text-lg font-bold text-slate-900">Type → Format</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Which store / format types are available for each business type.
        </p>
      </div>
      <CampaignMappingTable
        mappings={mappings}
        loading={loading}
        parentLabel="Business Type"
        childLabel="Store / Format Type"
        parentOptions={bizTypes.map(toOpt)}
        childOptions={formats.map(toOpt)}
        onAdd={handleAdd}
        onDelete={handleDelete}
        filterParentId={filterParent}
        setFilterParentId={setFilterParent}
        filterChildId={filterChild}
        setFilterChildId={setFilterChild}
      />
    </div>
  )
}
