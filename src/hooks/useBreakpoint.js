import { useState, useEffect } from 'react'

export function useBreakpoint() {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    function handler(e) { setIsMobile(e.matches) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return { isMobile }
}
