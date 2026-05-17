import { useState, useEffect, useRef } from 'react'
import { X, FilePlus, Loader2 } from 'lucide-react'

interface CreateNoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  folderId: string
  onCreate?: (note: FormState) => void
}

export interface FormState {
  name: string
  purpose: string
}

export function CreateNoteModal({ isOpen, onClose, onSuccess, folderId, onCreate }: CreateNoteModalProps) {
  const [form, setForm] = useState<FormState>({ name: '', purpose: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setForm({ name: '', purpose: '' })
      setError(null)
      setTimeout(() => nameInputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Note name is required.')
      return
    }

    setIsLoading(true)
    setError(null)

    if (onCreate) {
      onCreate({ name: form.name.trim(), purpose: form.purpose.trim() })
      onSuccess?.()
      onClose()
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch(`http://localhost:8000/folders/${folderId}/notes/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.name.trim(), purpose: form.purpose.trim() }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.detail ?? `Server error (${response.status})`)
      }

      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      id="create-note-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.35)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        id="create-note-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 animate-modal-in"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50">
              <FilePlus className="w-5 h-5 text-blue-500" />
            </span>
            <h2 id="modal-title" className="text-lg font-semibold text-slate-800">
              New Note
            </h2>
          </div>
          <button
            id="close-modal-btn"
            onClick={onClose}
            aria-label="Close modal"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-150"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form id="create-note-form" onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="note-name" className="block text-sm font-medium text-slate-700">
                Note Name <span className="text-red-400">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="note-name"
                type="text"
                placeholder="e.g. Q1 Marketing Plan"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-xl outline-none transition-all duration-150 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="note-purpose" className="block text-sm font-medium text-slate-700">
                Purpose
                <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="note-purpose"
                rows={3}
                placeholder="e.g. Brainstorming session for the new campaign"
                value={form.purpose}
                onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-xl outline-none transition-all duration-150 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
            <button
              type="button"
              id="cancel-btn"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="create-note-submit-btn"
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-500 rounded-xl hover:bg-blue-600 active:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150 shadow-sm shadow-blue-200"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Creating…' : 'Create Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
