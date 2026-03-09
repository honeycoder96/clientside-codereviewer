import { useEffect, useState } from 'react'

/**
 * Captures the browser's `beforeinstallprompt` event and surfaces a slim
 * "Install" button in the navbar. Disappears after install or dismissal.
 *
 * Only renders in browsers that support the install prompt (Chrome / Edge).
 * No-ops silently everywhere else.
 */
export default function InstallButton() {
  const [prompt,     setPrompt]     = useState(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault()
      setPrompt(e)
    }
    function onAppInstalled() {
      setPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled',        onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled',        onAppInstalled)
    }
  }, [])

  if (!prompt) return null

  async function handleInstall() {
    setInstalling(true)
    try {
      prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') setPrompt(null)
    } finally {
      setInstalling(false)
    }
  }

  return (
    <button
      onClick={handleInstall}
      disabled={installing}
      title="Install as desktop app"
      className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-indigo-700 text-indigo-400 hover:border-indigo-500 hover:text-indigo-200 transition-colors disabled:opacity-50"
    >
      <span aria-hidden="true">⬇</span>
      Install
    </button>
  )
}
