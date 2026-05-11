import { useEffect, useState } from 'react'

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms of
 * inactivity.  Use for text-input filter fields to avoid firing an API call on
 * every keystroke.
 *
 * @param {*}      value  – the live value to debounce
 * @param {number} delay  – debounce window in milliseconds (default 400)
 */
export default function useDebounce(value, delay = 600) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
