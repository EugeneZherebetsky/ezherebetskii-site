import { formatDateTime } from '../lib/opportunities'
import type { StarStory } from '../types'

type StarStoryViewProps = {
  story: StarStory
  onClose: () => void
  onEdit: (story: StarStory) => void
}

const SECTIONS: Array<{ key: keyof Pick<StarStory, 'situation' | 'task' | 'action' | 'result'>; label: string; hint: string }> = [
  { key: 'situation', label: 'Situation', hint: 'The context: where, when, and what was at stake.' },
  { key: 'task', label: 'Task', hint: 'What you were responsible for.' },
  { key: 'action', label: 'Action', hint: 'The specific steps you took.' },
  { key: 'result', label: 'Result', hint: 'The measurable outcome.' },
]

export function StarStoryView({ story, onClose, onEdit }: StarStoryViewProps) {
  const missing = SECTIONS.filter((section) => !story[section.key]?.trim()).map((section) => section.label)

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal story-modal" role="dialog" aria-modal="true" aria-labelledby="story-view-title">
        <header className="modal-header">
          <div><p className="eyebrow">STAR story</p><h2 id="story-view-title">{story.title}</h2></div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="story-view">
          {story.skills && <div className="story-skills">{story.skills.split(',').map((skill) => skill.trim()).filter(Boolean).map((skill) => <span key={skill}>{skill}</span>)}</div>}

          {missing.length > 0 && (
            <p className="story-incomplete" role="status">
              Not yet complete: {missing.join(', ')}. An interviewer weighs the result most, so add it before using this story.
            </p>
          )}

          {SECTIONS.map((section) => {
            const value = story[section.key]?.trim()
            return (
              <div className="story-section" key={section.key}>
                <h3>{section.label}</h3>
                {value ? <p>{value}</p> : <p className="story-section-empty">Not recorded yet — {section.hint}</p>}
              </div>
            )
          })}

          {story.notes && (
            <div className="story-section story-section-notes">
              <h3>When to use this</h3>
              <p>{story.notes}</p>
            </div>
          )}

          <p className="story-meta">Last updated {formatDateTime(story.updated_at)}</p>
        </div>
        <div className="form-actions story-view-actions">
          <button className="button secondary" type="button" onClick={onClose}>Close</button>
          <button className="button primary" type="button" onClick={() => onEdit(story)}>Edit story</button>
        </div>
      </section>
    </div>
  )
}
