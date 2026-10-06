/**
 * Tiny localStorage wrapper for per-browser preferences (last project path,
 * selected model). Storage can be unavailable (private mode, blocked site
 * data), so every access is guarded and failures fall back silently.
 */

const PREFIX = 'devlens:'

export function loadPref(key, fallback = '') {
  try {
    return localStorage.getItem(PREFIX + key) ?? fallback
  } catch {
    return fallback
  }
}

export function savePref(key, value) {
  try {
    localStorage.setItem(PREFIX + key, value)
  } catch {
    /* storage unavailable – preference simply isn't remembered */
  }
}
