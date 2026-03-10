import { useState, useEffect } from 'react'

function getRoute() {
  const hash = window.location.hash
  if (hash.startsWith('#/cli')) return '/cli'
  return '/'
}

export function useHashRoute() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const handler = () => setRoute(getRoute())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  return route
}
