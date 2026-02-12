import { useState, useEffect } from 'react'

const DEFAULT_APP_NAME = 'My Tasks Planner'

export function useAppName(): string {
  const [appName, setAppName] = useState(DEFAULT_APP_NAME)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.api?.app?.getAppName) return
    window.api.app.getAppName().then((res) => {
      if (res.success && res.data) setAppName(res.data)
    })
  }, [])

  return appName
}
