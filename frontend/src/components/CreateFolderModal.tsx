import { useState, useEffect, useRef } from 'react'
import { X, FolderPlus } from 'lucide-react'
import type { FolderColor, LocalFolder } from '../lib/localWorkspace'

interface CreateFolderModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit?: (folder: FormState) => void
  onSuccess?: () => void
  initialFolder?: LocalFolder | null
}

export interface FormState {
  name: string
  purpose: string
  color: FolderColor
}

const colorOptions: Array<{ id: FolderColor; label: string; swatch: string; ring: string }> = [
  { id: 'purple', label: 'Soft Purple', swatch: '#977DFF', ring: 'ring-[#977DFF]/35' },
  { id: 'pink', label: 'Pastel Pink', swatch: '#FFCCF2', ring: 'ring-[#FFCCF2]' },
  { id: 'blue', label: 'Original Blue', swatch: '#0033FF', ring: 'ring-[#0033FF]/25' },
  { id: 'red', label: 'Red', swatch: '#ef4444', ring: 'ring-red-200' },
  { id: 'green', label: 'Green', swatch: '#10b981', ring: 'ring-emerald-200' },
]

export function CreateFolderModal({ isOpen, onClose, onSubmit, onSuccess, initialFolder }: CreateFolderModalProps) {
  const [form, setForm] = useState<FormState>({ name: '', purpose: '', color: 'purple' })
  const [error, setError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const isEditing = Boolean(initialFolder)

  // Focus the name input when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm({
        name: initialFolder?.name ?? '',
        purpose: initialFolder?.purpose ?? '',
        color: initialFolder?.color ?? 'purple',
      })
      setError(null)
      setTimeout(() => nameInputRef.current?.focus(), 50)
    }
  }, [initialFolder, isOpen])

  // Close on Escape key
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
      setError('Folder name is required.')
      return
    }

    setError(null)
    if (onSubmit) {
      onSubmit({ name: form.name.trim(), purpose: form.purpose.trim(), color: form.color })
    } else {
      onSuccess?.()
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    /* Backdrop */
    <div
      id="create-folder-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.35)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal card */}
      <div
        id="create-folder-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 animate-modal-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50">
              <FolderPlus className="w-5 h-5 text-blue-500" />
            </span>
            <h2 id="modal-title" className="text-lg font-semibold text-slate-800">
              {isEditing ? 'Edit Folder' : 'New Folder'}
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

        {/* Body */}
        <form id="create-folder-form" onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-4">
            {/* Name field */}
            <div className="space-y-1.5">
              <label htmlFor="folder-name" className="block text-sm font-medium text-slate-700">
                Folder Name <span className="text-red-400">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="folder-name"
                type="text"
                placeholder="e.g. Research Notes"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-xl outline-none transition-all duration-150 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Purpose field */}
            <div className="space-y-1.5">
              <label htmlFor="folder-purpose" className="block text-sm font-medium text-slate-700">
                Folder Description
                <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="folder-purpose"
                rows={3}
                placeholder="e.g. Collecting notes for Q2 market research"
                value={form.purpose}
                onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-xl outline-none transition-all duration-150 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>

            {/* Color field */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-sm font-medium text-slate-700">Folder Color</label>
              <div className="flex flex-wrap items-center gap-3">
                {colorOptions.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, color: color.id }))}
                    className={`h-8 w-8 rounded-full border border-white shadow-sm transition-all duration-200 ${
                      form.color === color.id
                        ? `ring-4 ring-offset-2 ${color.ring}`
                        : 'opacity-85 hover:scale-110 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color.swatch }}
                    aria-label={`Select ${color.label} color`}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
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
              id="create-folder-submit-btn"
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#0033FF] rounded-xl hover:bg-[#002be0] active:bg-[#0024bd] transition-colors duration-150 shadow-sm shadow-[#0033FF]/20"
            >
              {isEditing ? 'Save Changes' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
