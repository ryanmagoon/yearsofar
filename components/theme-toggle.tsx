'use client'

import { useSyncExternalStore } from 'react'

/** The <html> element's class list is the source of truth for the theme. */
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => observer.disconnect()
}

function isDark() {
  return document.documentElement.classList.contains('dark')
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false)

  function toggle() {
    const next = !isDark()
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-faint hover:text-foreground"
    >
      {dark ? 'Light' : 'Dark'}
    </button>
  )
}
