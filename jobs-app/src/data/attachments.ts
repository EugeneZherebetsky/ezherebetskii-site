import { safeStorageFilename } from '../lib/cvs'
import { blobToBase64, type EmailAttachment } from '../lib/google'
import type { CV } from '../types'
import { downloadCVFile } from './cvs'

/** Turns a stored or text-only CV into an email attachment. */
export async function cvEmailAttachment(cv: CV): Promise<EmailAttachment> {
  if (cv.storage_path) {
    const { data, error } = await downloadCVFile(cv.storage_path)
    if (error) throw error
    return {
      filename: safeStorageFilename(cv.original_filename || `${cv.name}.pdf`),
      mimeType: cv.mime_type || data.type || 'application/octet-stream',
      base64: await blobToBase64(data),
    }
  }
  if (!cv.plain_text) throw new Error('The selected CV has no file or text to attach.')
  const textFile = new Blob([cv.plain_text], { type: 'text/plain;charset=utf-8' })
  return {
    filename: `${safeStorageFilename(cv.name)}.txt`,
    mimeType: 'text/plain',
    base64: await blobToBase64(textFile),
  }
}
