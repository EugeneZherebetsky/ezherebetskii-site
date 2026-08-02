import type { CV, CVDraft } from '../types'

export const MAX_CV_FILE_BYTES = 10 * 1024 * 1024
export const CV_FILE_ACCEPT = '.pdf,.doc,.docx,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/rtf,text/rtf'

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  rtf: 'application/rtf',
}

export function cvToDraft(cv: CV): CVDraft {
  return {
    name: cv.name,
    target_role: cv.target_role ?? '',
    notes: cv.notes ?? '',
    plain_text: cv.plain_text ?? '',
  }
}

export function validateCVFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mimeType = MIME_BY_EXTENSION[extension]
  if (!mimeType) throw new Error('Choose a PDF, DOC, DOCX, TXT, or RTF file.')
  if (file.size > MAX_CV_FILE_BYTES) throw new Error('The CV file must be 10 MB or smaller.')
  return { extension, mimeType }
}

export function safeStorageFilename(filename: string) {
  const sanitized = filename
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  return sanitized || 'cv-file'
}

export function formatFileSize(bytes: number | null) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
