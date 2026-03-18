/**
 * useImageExport — Captures an HTML element as a PNG and triggers a browser download.
 *
 * Usage:
 *   const { exportAsImage, isExporting } = useImageExport(containerRef)
 *   exportAsImage('INV-001.png')
 *
 * Uses html-to-image (dynamic import — zero bundle cost when unused).
 * Safe on mobile: creates an <a> blob URL, revokes after click.
 */

import { useCallback, useRef, useState } from 'react'
import { useToast } from './useToast'
import type { RefObject } from 'react'

export interface UseImageExportReturn {
  /** Capture the ref'd element and download as PNG. */
  exportAsImage: (fileName: string) => Promise<void>
  /** True while html-to-image is working. Disable the trigger button while true. */
  isExporting: boolean
}

export function useImageExport(
  targetRef: RefObject<HTMLElement | null>,
): UseImageExportReturn {
  const [isExporting, setIsExporting] = useState(false)
  const runningRef = useRef(false)
  const toast = useToast()

  const exportAsImage = useCallback(
    async (fileName: string) => {
      // Concurrency guard — prevent double-tap or rapid clicks
      if (runningRef.current) return
      if (!targetRef.current) {
        toast.error('Nothing to capture. Try again.')
        return
      }

      runningRef.current = true
      setIsExporting(true)

      try {
        // Dynamic import keeps html-to-image out of the main bundle
        const { toPng } = await import('html-to-image')

        const dataUrl = await toPng(targetRef.current, {
          quality: 1,
          pixelRatio: 3, // high-DPI — sharp logos, stamps, and signatures
          backgroundColor: '#ffffff',
        })

        // Create a blob URL and trigger download
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`
        link.click()

        toast.success('Image saved!')
      } catch {
        toast.error('Could not capture image. Try again.')
      } finally {
        runningRef.current = false
        setIsExporting(false)
      }
    },
    [targetRef, toast],
  )

  return { exportAsImage, isExporting }
}
