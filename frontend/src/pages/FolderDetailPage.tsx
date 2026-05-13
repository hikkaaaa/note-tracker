import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, MoreHorizontal, Search, Trash2 } from 'lucide-react'
import { CreateNoteModal } from '../components/CreateNoteModal'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { Header } from '../components/Header'

interface NoteItem {
  id: number
  title: string
  purpose?: string
  created_at?: string
}

interface FolderData {
  id: number
  name: string
  notes: NoteItem[]
}

export function FolderDetailPage() {
  const { folderId } = useParams()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [folder, setFolder] = useState<FolderData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchFolderData = useCallback(async () => {
    if (!folderId) return
    try {
      const res = await fetch('http://localhost:8000/folders/')
      if (res.ok) {
        const folders: FolderData[] = await res.json()
        const found = folders.find((f) => f.id === parseInt(folderId))
        setFolder(found || null)
      }
    } catch {
      // Backend error handling
    } finally {
      setIsLoading(false)
    }
  }, [folderId])

  useEffect(() => {
    fetchFolderData()
  }, [fetchFolderData])

  const filteredNotes = (folder?.notes || []).filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.purpose ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleModalSuccess = () => {
    fetchFolderData()
  }

  return (
    <div id="folder-detail-page" className="min-h-screen bg-[#f0f4f8]">
      <Header
        title={folder ? folder.name : 'Loading...'}
        actionLabel="New Note"
        showBackButton={true}
        onActionClick={() => setIsModalOpen(true)}
      />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Notes</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {folder ? folder.notes.length : 0} note{folder?.notes.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              id="note-search"
              type="text"
              placeholder="Search notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm text-slate-700 placeholder-slate-400 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-150 w-56"
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingGrid />
        ) : !folder ? (
          <div className="text-center py-20 text-slate-500">Folder not found</div>
        ) : filteredNotes.length === 0 ? (
          <EmptyState
            hasSearch={searchQuery.length > 0}
            onCreateNote={() => setIsModalOpen(true)}
          />
        ) : (
          <div
            id="notes-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredNotes.map((note) => (
              <NoteCard key={note.id} note={note} onDeleteSuccess={fetchFolderData} />
            ))}
          </div>
        )}
      </main>

      {folderId && (
        <CreateNoteModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleModalSuccess}
          folderId={folderId}
        />
      )}
    </div>
  )
}

function NoteCard({ note, onDeleteSuccess }: { note: NoteItem, onDeleteSuccess: () => void }) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!showMenu) return
    const closeMenu = () => setShowMenu(false)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [showMenu])

  const handleDelete = async () => {
    try {
      const res = await fetch(`http://localhost:8000/notes/${note.id}`, { method: 'DELETE' })
      if (res.ok) onDeleteSuccess()
    } catch {
       // Ignore error
    }
  }

  return (
    <article
      onClick={() => navigate(`/notes/${note.id}`)}
      className="group relative w-full aspect-[4/5] sm:aspect-[3/4] block cursor-pointer hover:-translate-y-1.5 transition-all duration-300 isolate bg-white rounded-2xl shadow-sm hover:shadow-xl hover:shadow-slate-200/50 border border-slate-200 overflow-hidden"
    >
      {/* 1. Subtle Paper Background & Watermark */}
      <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50/50 z-0" />
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 text-slate-200 opacity-40 transform rotate-12 scale-150 group-hover:scale-[1.65] group-hover:rotate-6 transition-transform duration-500 pointer-events-none origin-top-right">
        <FileText className="w-24 h-24 sm:w-32 sm:h-32" strokeWidth={0.75} />
      </div>

      {/* 2. Mock Document Content (Skeleton Lines) */}
      <div className="absolute inset-x-6 top-8 flex flex-col gap-3.5 z-10 pointer-events-none opacity-40 group-hover:opacity-60 transition-opacity duration-300">
        <div className="h-2 w-1/3 bg-slate-200 rounded-full" />
        <div className="h-2 w-full bg-slate-200 rounded-full mt-2" />
        <div className="h-2 w-5/6 bg-slate-200 rounded-full" />
        <div className="h-2 w-full bg-slate-200 rounded-full" />
        <div className="h-2 w-2/3 bg-slate-200 rounded-full" />
        <div className="h-2 w-full bg-slate-200 rounded-full mt-2" />
        <div className="h-2 w-4/5 bg-slate-200 rounded-full" />
      </div>

      {/* 3. Glassy Bottom Info Pane */}
      <div className="absolute bottom-0 left-0 w-full h-[60%] z-20 flex flex-col justify-end">
        {/* Soft gradient fade masking the top of the glass pane */}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
        
        {/* Glass backdrop with border */}
        <div className="absolute bottom-0 inset-x-0 h-[75%] bg-white/70 backdrop-blur-xl border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]" />

        <div className="relative z-30 p-5 sm:p-6 w-full flex flex-col justify-end">
          <h3 className="font-bold text-slate-800 text-lg sm:text-xl tracking-tight leading-snug truncate">
            {note.title}
          </h3>
          
          {note.purpose ? (
            <p className="font-medium text-slate-500 text-xs sm:text-sm mt-0.5 truncate drop-shadow-sm">
              {note.purpose}
            </p>
          ) : (
            <p className="font-medium text-slate-400 text-xs sm:text-sm mt-0.5 italic truncate">
              No purpose specified
            </p>
          )}

          <div className="mt-4 sm:mt-5 flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              {note.created_at ? new Date(note.created_at).toLocaleDateString() : 'Draft'}
            </span>
          </div>

          <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4">
            <div className="relative">
              <button
                aria-label="More options"
                aria-expanded={showMenu}
                className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 opacity-0 group-hover:opacity-100 transition-all duration-150 relative"
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {showMenu && (
                <div 
                  className="absolute bottom-full right-0 mb-1 w-32 bg-white rounded-xl shadow-xl ring-1 ring-slate-100 py-1.5 z-50 animate-modal-in origin-bottom-right"
                  onClick={(e) => { e.stopPropagation() }}
                >
                  <button 
                    onClick={() => { setShowMenu(false); setShowConfirm(true) }}
                    className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={showConfirm} 
        onClose={() => setShowConfirm(false)} 
        onConfirm={handleDelete}
        title="Delete Note"
        message={`Are you sure you want to delete "${note.title}"? This action cannot be undone.`}
      />
    </article>
  )
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse">
          <div className="h-20 rounded-xl bg-slate-100 mb-4" />
          <div className="h-4 rounded-lg bg-slate-100 mb-2 w-3/4" />
          <div className="h-3 rounded-lg bg-slate-50 w-1/2" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  hasSearch,
  onCreateNote,
}: {
  hasSearch: boolean
  onCreateNote: () => void
}) {
  return (
    <div
      id="empty-state"
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <span className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 mb-4">
        <FileText className="w-8 h-8 text-emerald-400" strokeWidth={1.5} />
      </span>
      <h3 className="text-lg font-semibold text-slate-700 mb-1">
        {hasSearch ? 'No matching notes' : 'No notes yet'}
      </h3>
      <p className="text-sm text-slate-500 mb-6 max-w-xs">
        {hasSearch
          ? 'Try a different search term.'
          : 'Create your first note in this folder.'}
      </p>
      {!hasSearch && (
        <button
          id="empty-create-note-btn"
          onClick={onCreateNote}
          className="px-5 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-xl hover:bg-blue-600 transition-colors duration-150 shadow-sm shadow-blue-200"
        >
          Create a Note
        </button>
      )}
    </div>
  )
}
