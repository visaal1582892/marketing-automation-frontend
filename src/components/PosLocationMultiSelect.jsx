import React, { useState, useEffect } from 'react'
import { posDataApi } from '../api/posData'
import MultiSelectDropdown from './MultiSelectDropdown'

export default function PosLocationMultiSelect({
  value = { countryCodes: [], stateCodes: [], cityCodes: [] },
  onChange,
  hasError
}) {
  const [countries, setCountries] = useState([])
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])

  const selectedCountryCodes = (value.countryCodes || []).map(String)
  const selectedStateCodes = (value.stateCodes || []).map(String)
  const selectedCityCodes = (value.cityCodes || []).map(String)

  // 1. Fetch countries on component mount
  useEffect(() => {
    posDataApi.getCountries().then(data => {
      setCountries(data || [])
    }).catch(console.error)
  }, [])

  // 2. Fetch states whenever selectedCountryCodes changes
  useEffect(() => {
    if (selectedCountryCodes.length > 0) {
      posDataApi.getStates(selectedCountryCodes).then(data => {
        setStates(data || [])
      }).catch(console.error)
    } else {
      setStates([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountryCodes.join(',')])

  // 3. Fetch cities whenever selectedStateCodes changes
  useEffect(() => {
    if (selectedStateCodes.length > 0) {
      posDataApi.getCities(selectedStateCodes).then(data => {
        setCities(data || [])
      }).catch(console.error)
    } else {
      setCities([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStateCodes.join(',')])

  const handleCountriesChange = (newCountryCodes) => {
    // Filter stateCodes to only keep states that belong to one of the newCountryCodes
    const validStateCodes = selectedStateCodes.filter(sCode => {
      const s = states.find(x => String(x.stateCode) === sCode || String(x.subName) === sCode)
      return s && newCountryCodes.includes(String(s.countryCode))
    })
    const validCityCodes = selectedCityCodes.filter(cCode => {
      const c = cities.find(x => String(x.cityCode) === cCode || String(x.citySubName) === cCode)
      return c && validStateCodes.some(sCode => String(c.stateCode) === sCode || String(c.stateSubName) === sCode)
    })

    onChange({
      countryCodes: newCountryCodes,
      stateCodes: validStateCodes,
      cityCodes: validCityCodes,
    })
  }

  const handleStatesChange = (newStateCodes) => {
    const validCityCodes = selectedCityCodes.filter(cCode => {
      const c = cities.find(x => String(x.cityCode) === cCode || String(x.citySubName) === cCode)
      return c && newStateCodes.some(sCode => String(c.stateCode) === sCode || String(c.stateSubName) === sCode)
    })

    onChange({
      countryCodes: selectedCountryCodes,
      stateCodes: newStateCodes,
      cityCodes: validCityCodes,
    })
  }

  const handleCitiesChange = (newCityCodes) => {
    onChange({
      countryCodes: selectedCountryCodes,
      stateCodes: selectedStateCodes,
      cityCodes: newCityCodes,
    })
  }

  const countryOptions = countries.map(c => ({
    id: String(c.countryCode),
    name: c.countryName,
    subtitle: c.subName || String(c.countryCode)
  }))

  const stateOptions = states.map(s => ({
    id: String(s.stateCode),
    name: s.stateName,
    subtitle: s.subName || String(s.stateCode)
  }))

  const cityOptions = cities.map(c => ({
    id: String(c.cityCode),
    name: c.cityName,
    subtitle: c.citySubName || String(c.cityCode)
  }))

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${hasError ? 'ring-1 ring-red-300 rounded-md p-1' : ''}`}>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Countries</label>
        <MultiSelectDropdown
          options={countryOptions}
          value={selectedCountryCodes}
          onChange={handleCountriesChange}
          placeholder="Select countries..."
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">States</label>
        <MultiSelectDropdown
          options={stateOptions}
          value={selectedStateCodes}
          onChange={handleStatesChange}
          placeholder={selectedCountryCodes.length === 0 ? 'Select a country first' : 'Select states...'}
          disabled={selectedCountryCodes.length === 0}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Cities</label>
        <MultiSelectDropdown
          options={cityOptions}
          value={selectedCityCodes}
          onChange={handleCitiesChange}
          placeholder={selectedStateCodes.length === 0 ? 'Select a state first' : 'Select cities...'}
          disabled={selectedStateCodes.length === 0}
        />
      </div>
    </div>
  )
}
