import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/client'
import BackToMaster from '../../components/admin/BackToMaster'
import Icon from '../../components/Icon'

export default function RoleRightsMappingPage() {
  const [roles, setRoles] = useState([])
  const [rights, setRights] = useState([])
  const [selectedRole, setSelectedRole] = useState(null)
  
  // Local state for the selected role's right IDs
  const [mappedRightIds, setMappedRightIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/master/roles'),
      api.get('/master/rights')
    ]).then(([rolesRes, rightsRes]) => {
      setRoles(rolesRes.data.filter(r => r.status === 'ACTIVE'))
      setRights(rightsRes.data.filter(r => r.status === 'ACTIVE'))
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setMessage('Failed to load master data.')
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (selectedRole) {
      setLoading(true)
      api.get(`/admin/roles/${selectedRole}/rights`)
        .then(res => {
          setMappedRightIds(new Set(res.data))
          setLoading(false)
        })
        .catch(err => {
          console.error(err)
          setMessage('Failed to load rights for selected role.')
          setLoading(false)
        })
    } else {
      setMappedRightIds(new Set())
    }
  }, [selectedRole])

  const toggleRight = (rightId) => {
    setMappedRightIds(prev => {
      const next = new Set(prev)
      if (next.has(rightId)) {
        next.delete(rightId)
      } else {
        next.add(rightId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!selectedRole) return
    setSaving(true)
    setMessage('')
    try {
      await api.put(`/admin/roles/${selectedRole}/rights`, Array.from(mappedRightIds))
      setMessage('Role rights successfully updated.')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      console.error(err)
      setMessage('Failed to save role rights.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && roles.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-slate-500 animate-pulse">Loading Configuration...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <BackToMaster />
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight mt-2 flex items-center gap-2">
            <Icon name="shield" className="w-8 h-8 text-amber-500" />
            Role Rights Mapping
          </h1>
          <p className="text-slate-500 mt-1">
            Configure system privileges and granular access controls for each role.
          </p>
        </div>
        
        {selectedRole && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium shadow-sm transition-all ${
              saving ? 'bg-amber-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700 hover:shadow-md active:scale-95'
            }`}
          >
            <Icon name="check" className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 shadow-sm ${
          message.includes('success') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.includes('success') ? <Icon name="checkCircle" className="w-5 h-5" /> : <Icon name="xCircle" className="w-5 h-5" />}
          {message}
        </div>
      )}

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Roles Sidebar */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-semibold text-slate-700">System Roles</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {roles.map(role => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`w-full text-left px-4 py-3 rounded-lg mb-1 transition-all flex items-center justify-between ${
                  selectedRole === role.id 
                    ? 'bg-amber-50 text-amber-900 border-amber-200 shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent'
                } border`}
              >
                <span className="font-medium">{role.name}</span>
                {selectedRole === role.id && <div className="w-2 h-2 rounded-full bg-amber-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* Rights Main Panel */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
          {!selectedRole ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Icon name="shield" className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">Select a role from the sidebar to configure its rights</p>
            </div>
          ) : (
            <>
              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                  <div className="animate-pulse text-amber-600 font-medium bg-white px-6 py-3 rounded-full shadow-lg border border-amber-100">
                    Loading Mapping...
                  </div>
                </div>
              )}
              
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between sticky top-0 z-0">
                <h2 className="font-semibold text-slate-700">
                  Access Rights for <span className="text-amber-600">{roles.find(r => r.id === selectedRole)?.name}</span>
                </h2>
                <div className="text-sm font-medium px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm text-slate-600">
                  {mappedRightIds.size} Rights Granted
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {rights.map(right => {
                    const isGranted = mappedRightIds.has(right.id)
                    return (
                      <div 
                        key={right.id}
                        onClick={() => toggleRight(right.id)}
                        className={`group relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          isGranted 
                            ? 'bg-gradient-to-br from-amber-50 to-white border-amber-400 shadow-md shadow-amber-500/10' 
                            : 'bg-white border-slate-200 hover:border-amber-200 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isGranted ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white border-slate-300'
                        }`}>
                          {isGranted && <Icon name="check" className="w-3.5 h-3.5 stroke-2" />}
                        </div>
                        <div className="flex-1">
                          <h3 className={`font-semibold mb-1 transition-colors ${
                            isGranted ? 'text-amber-900' : 'text-slate-700 group-hover:text-slate-900'
                          }`}>
                            {right.name}
                          </h3>
                          <p className={`text-xs leading-relaxed transition-colors ${
                            isGranted ? 'text-amber-700/80' : 'text-slate-500'
                          }`}>
                            {right.id}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
