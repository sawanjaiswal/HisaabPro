import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadSettings, saveSettings, playClickSound, triggerVibration } from '../calculator-settings.utils'

// ─── loadSettings ─────────────────────────────────────────────────────────────

describe('loadSettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when nothing stored', () => {
    const settings = loadSettings()
    expect(settings.keyboardSound).toBe(true)
    expect(settings.keyboardVibration).toBe(true)
  })

  it('returns stored settings', () => {
    localStorage.setItem('hisaab:calculator-settings', JSON.stringify({
      keyboardSound: false,
      keyboardVibration: true,
    }))
    const settings = loadSettings()
    expect(settings.keyboardSound).toBe(false)
    expect(settings.keyboardVibration).toBe(true)
  })

  it('merges partial stored settings with defaults', () => {
    localStorage.setItem('hisaab:calculator-settings', JSON.stringify({
      keyboardSound: false,
    }))
    const settings = loadSettings()
    expect(settings.keyboardSound).toBe(false)
    expect(settings.keyboardVibration).toBe(true) // default
  })

  it('returns defaults for corrupt data', () => {
    localStorage.setItem('hisaab:calculator-settings', 'not json')
    const settings = loadSettings()
    expect(settings.keyboardSound).toBe(true)
  })
})

// ─── saveSettings ─────────────────────────────────────────────────────────────

describe('saveSettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists settings to localStorage', () => {
    saveSettings({ keyboardSound: false, keyboardVibration: false })
    const raw = localStorage.getItem('hisaab:calculator-settings')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.keyboardSound).toBe(false)
    expect(parsed.keyboardVibration).toBe(false)
  })

  it('survives quota exceeded error', () => {
    // Mock localStorage.setItem to throw
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded')
    })
    expect(() => saveSettings({ keyboardSound: true, keyboardVibration: true })).not.toThrow()
    spy.mockRestore()
  })
})

// ─── playClickSound ───────────────────────────────────────────────────────────

describe('playClickSound', () => {
  it('does not throw when AudioContext unavailable', () => {
    // jsdom has no AudioContext by default
    expect(() => playClickSound()).not.toThrow()
  })
})

// ─── triggerVibration ─────────────────────────────────────────────────────────

describe('triggerVibration', () => {
  it('does not throw when Vibration API unavailable', () => {
    expect(() => triggerVibration()).not.toThrow()
  })

  it('calls navigator.vibrate when available', () => {
    const vibrateSpy = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, vibrate: vibrateSpy })
    triggerVibration()
    expect(vibrateSpy).toHaveBeenCalledWith(10)
    vi.unstubAllGlobals()
  })
})
