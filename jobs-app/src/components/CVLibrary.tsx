import { useMemo, useState } from 'react'
import { formatFileSize } from '../lib/cvs'
import { formatDateTime } from '../lib/opportunities'
import { CV_BLOCK_TYPE_LABELS, type CV, type CVBlock } from '../types'

type CVLibraryProps = {
  cvs: CV[]
  blocks: CVBlock[]
  busy: boolean
  onAdd: () => void
  onEdit: (cv: CV) => void
  onDownload: (cv: CV) => Promise<void>
  onDelete: (cv: CV) => Promise<void>
  onBuild: () => void
  onAddBlock: () => void
  onEditBlock: (block: CVBlock) => void
  onDeleteBlock: (block: CVBlock) => Promise<void>
}

export function CVLibrary({ cvs, blocks, busy, onAdd, onEdit, onDownload, onDelete, onBuild, onAddBlock, onEditBlock, onDeleteBlock }: CVLibraryProps) {
  const [search, setSearch] = useState('')
  const filteredCVs = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return cvs
    return cvs.filter((cv) => [cv.name, cv.tailored_company ?? '', cv.target_role ?? '', cv.notes ?? '', cv.plain_text ?? ''].some((value) => value.toLowerCase().includes(needle)))
  }, [cvs, search])

  return (
    <>
    <section className="workspace-card">
      <div className="workspace-head"><div><p className="eyebrow">Secure document workspace</p><h2>{cvs.length} CV versions</h2></div><div className="controls"><button className="button primary" onClick={onBuild}>Build CV for a role</button><input aria-label="Search CVs" placeholder="Search name, company, role, notes, or text" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
      {filteredCVs.length === 0 ? <div className="empty-state"><strong>{cvs.length ? 'No matching CVs' : 'Build your CV library'}</strong><span>{cvs.length ? 'Try a different search.' : 'Upload a document, paste a text version, or use both. Your private library will follow your account to every device.'}</span>{!cvs.length && <button className="button primary" onClick={onAdd}>Add your first CV</button>}</div> : (
        <div className="cv-grid">{filteredCVs.map((cv) => (
          <article className="cv-card" key={cv.id}>
            <div className="cv-card-head"><span className="cv-file-mark" aria-hidden="true">CV</span><div><h3>{cv.name}</h3><p>{cv.tailored_company ? `Tailored for ${cv.tailored_company}` : cv.target_role || 'General CV'}</p></div></div>
            <div className="cv-meta"><span>{cv.storage_path ? cv.original_filename || 'Stored file' : 'Text-only version'}</span>{cv.size_bytes != null && <span>{formatFileSize(cv.size_bytes)}</span>}<span>Updated {formatDateTime(cv.updated_at)}</span></div>
            {cv.notes && <p className="cv-notes">{cv.notes}</p>}
            {cv.plain_text && <p className="cv-preview">{cv.plain_text.slice(0, 180)}{cv.plain_text.length > 180 ? '…' : ''}</p>}
            <div className="cv-actions">{cv.storage_path && <button className="button secondary" disabled={busy} onClick={() => void onDownload(cv)}>Download</button>}<button className="button secondary" disabled={busy} onClick={() => onEdit(cv)}>Edit</button><button className="button danger" disabled={busy} onClick={() => void onDelete(cv)}>Delete</button></div>
          </article>
        ))}</div>
      )}
    </section>

    <section className="workspace-card">
      <div className="workspace-head">
        <div><p className="eyebrow">Reusable content</p><h2>{blocks.length} CV blocks</h2></div>
        <button className="button secondary" onClick={onAddBlock}>+ Add block</button>
      </div>
      {blocks.length === 0 ? (
        <div className="empty-state">
          <strong>Write each part once</strong>
          <span>Save your summary, skills, roles and qualifications as blocks. The builder combines them with your STAR stories into a CV aimed at a specific role, using only text you have written.</span>
          <button className="button primary" onClick={onAddBlock}>Add your first block</button>
        </div>
      ) : (
        <div className="cv-grid">{blocks.map((block) => (
          <article className="cv-card" key={block.id}>
            <div className="cv-card-head"><span className="cv-file-mark" aria-hidden="true">§</span><div><h3>{block.title}</h3><p>{CV_BLOCK_TYPE_LABELS[block.block_type]}{block.tags ? ` · ${block.tags}` : ''}</p></div></div>
            <p className="cv-preview">{block.content.slice(0, 200)}{block.content.length > 200 ? '…' : ''}</p>
            <div className="cv-actions">
              <button className="button secondary" disabled={busy} onClick={() => onEditBlock(block)}>Edit</button>
              <button className="button danger" disabled={busy} onClick={() => void onDeleteBlock(block)}>Delete</button>
            </div>
          </article>
        ))}</div>
      )}
    </section>
    </>
  )
}
