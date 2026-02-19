import { getSupabaseClient } from '@/shared/lib/supabase/config'

const BUCKET = 'board-thumbnails'
const THUMBNAIL_WIDTH = 400
const THUMBNAIL_HEIGHT = 280

/**
 * Resize a base64 data URL to a fixed width/height JPEG at reduced quality.
 * Runs in the browser using an offscreen canvas.
 */
function resizeDataUrl(dataUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = THUMBNAIL_WIDTH
      canvas.height = THUMBNAIL_HEIGHT
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No canvas context')); return }
      // Fill white background before drawing (JPEG has no alpha)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
      // Draw image scaled to fit, centered, letterboxed
      const scale = Math.min(THUMBNAIL_WIDTH / img.width, THUMBNAIL_HEIGHT / img.height)
      const w = img.width * scale
      const h = img.height * scale
      const x = (THUMBNAIL_WIDTH - w) / 2
      const y = (THUMBNAIL_HEIGHT - h) / 2
      ctx.drawImage(img, x, y, w, h)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('toBlob failed'))
        },
        'image/jpeg',
        0.7
      )
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = dataUrl
  })
}

/**
 * Upload a thumbnail blob to Supabase Storage and persist the public URL
 * on the boards table. Fire-and-forget; errors are silently swallowed.
 */
export async function saveBoardThumbnail(
  boardId: string,
  dataUrl: string
): Promise<void> {
  try {
    const blob = await resizeDataUrl(dataUrl)
    const supabase = getSupabaseClient()
    const path = `${boardId}.jpg`

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (uploadErr) return

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path)

    if (!urlData?.publicUrl) return

    await supabase
      .from('boards')
      .update({ thumbnail_url: urlData.publicUrl })
      .eq('id', boardId)
  } catch {
    // Never throw — thumbnail failures must not interrupt navigation
  }
}
