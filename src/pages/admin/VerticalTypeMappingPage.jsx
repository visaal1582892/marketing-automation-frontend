import { useCallback, useEffect, useState } from 'react'
import { masterApi } from '../../api/masterData'
import campaignSpecsApi from '../../api/campaignSpecs'
import BackToMaster from '../../components/admin/BackToMaster'
import CampaignMappingTable from '../../components/admin/CampaignMappingTable'
import { useToast } from '../../components/Toast'

const toOpt = (item) => ({ value: item.id, label: item.name })

export default function VerticalTypeMappingPage() {
  const toast = useToast()
  const [mappings, setMappings] = useState([])
  const [loading, setLoading] = useState(true)
  const [verticals, setVerticals] = useState([])
  const [bizTypes, setBizTypes] = useState([])
  const [filterParent, setFilterParent] = useState('')
  const [filterChild, setFilterChild] = useState('')

  const loadMappings = useCallback(() => {
    setLoading(true)
    campaignSpecsApi.listVerticalTypeMappings()
      .then(setMappings)
      .catch(() => toast.error('Failed to load mappings'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => {
    masterApi.list('business-verticals').then(setVerticals).catch(() => {})
    masterApi.list('business-types').then(setBizTypes).catch(() => {})
    loadMappings()
  }, [loadMappings])

  const handleAdd = async (verticalId, typeId) => {
    try {
      await campaignSpecsApi.createVerticalTypeMapping(verticalId, typeId)
      toast.success('Mapping added')
      loadMappings()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add mapping')
      throw err
    }
  }

  const handleDelete = async (id) => {
    try {
      await campaignSpecsApi.deleteVerticalTypeMapping(id)
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
        <h1 className="text-lg font-bold text-slate-900">Vertical → Type</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Which business types are available for each business vertical.
        </p>
      </div>
      <CampaignMappingTable
        mappings={mappings}
        loading={loading}
        parentLabel="Business Vertical"
        childLabel="Business Type"
        parentOptions={verticals.map(toOpt)}
        childOptions={bizTypes.map(toOpt)}
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
