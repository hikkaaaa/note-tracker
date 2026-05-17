import { useEffect, useMemo, useState } from 'react'
import { Edit3, Folder, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { CreateFolderModal } from '../components/CreateFolderModal'
import type { FormState as FolderFormState } from '../components/CreateFolderModal'
import { getLocalFolders, saveLocalFolders } from '../lib/localWorkspace'
import type { FolderColor, LocalFolder } from '../lib/localWorkspace'

const colorStyles: Record<FolderColor, { back: string; front: string; icon: string }> = {
  purple: {
    back: 'from-[#977DFF] to-[#765DFF]',
    front: 'from-[#977DFF] via-[#866DFF]/95 to-[#0033FF]/75',
    icon: 'bg-[#977DFF]/12 text-[#977DFF]',
  },
  blue: {
    back: 'from-[#4770FF] to-[#0033FF]',
    front: 'from-[#4770FF] via-[#2451FF]/95 to-[#0033FF]/80',
    icon: 'bg-[#0033FF]/10 text-[#0033FF]',
  },
  pink: {
    back: 'from-[#FFCCF2] to-[#977DFF]',
    front: 'from-[#FF9BE2] via-[#CF8EFF]/95 to-[#977DFF]/85',
    icon: 'bg-[#FFCCF2]/60 text-[#977DFF]',
  },
  red: {
    back: 'from-red-400 to-red-500',
    front: 'from-red-500 via-red-400/95 to-rose-400/70',
    icon: 'bg-red-50 text-red-500',
  },
  green: {
    back: 'from-emerald-400 to-emerald-500',
    front: 'from-emerald-500 via-emerald-400/95 to-green-400/70',
    icon: 'bg-emerald-50 text-emerald-500',
  },
}

export function Dashboard() {
  const [folders, setFolders] = useState<LocalFolder[]>(() => getLocalFolders())
  const [searchQuery, setSearchQuery] = useState('')
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<LocalFolder | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<LocalFolder | null>(null)

  useEffect(() => {
    saveLocalFolders(folders)
  }, [folders])

  const filteredFolders = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return folders.filter(
      (folder) =>
        folder.name.toLowerCase().includes(query) ||
        folder.purpose.toLowerCase().includes(query),
    )
  }, [folders, searchQuery])

  const openCreateFolder = () => {
    setEditingFolder(null)
    setIsFolderModalOpen(true)
  }

  const openEditFolder = (folder: LocalFolder) => {
    setEditingFolder(folder)
    setIsFolderModalOpen(true)
  }

  const handleFolderSubmit = (form: FolderFormState) => {
    if (editingFolder) {
      setFolders((currentFolders) =>
        currentFolders.map((folder) =>
          folder.id === editingFolder.id
            ? { ...folder, name: form.name, purpose: form.purpose, color: form.color }
            : folder,
        ),
      )
      return
    }

    const nextFolder: LocalFolder = {
      id: Date.now(),
      name: form.name,
      purpose: form.purpose,
      color: form.color,
      notes: [],
    }
    setFolders((currentFolders) => [nextFolder, ...currentFolders])
  }

  const handleConfirmDelete = () => {
    if (!deletingFolder) return
    setFolders((currentFolders) => currentFolders.filter((folder) => folder.id !== deletingFolder.id))
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 px-6 py-4 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#977DFF] text-white shadow-lg shadow-[#977DFF]/25">
              <Folder className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Folders</h1>
          </div>

          <button
            type="button"
            onClick={openCreateFolder}
            className="flex h-11 items-center gap-2 rounded-2xl bg-[#0033FF] px-5 text-sm font-bold text-white shadow-lg shadow-[#0033FF]/20 transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            <span>New Folder</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-[#FFCCF2]/55 px-4 py-1.5 text-sm font-bold text-[#5f48d7]">
              Your organized space
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-950">My Folders</h2>
            <p className="mt-2 text-base font-medium text-slate-500">
              {folders.length} folder{folders.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="folder-search"
              type="text"
              placeholder="Search folders..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-13 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base font-medium text-slate-700 outline-none shadow-sm transition-all placeholder:text-slate-400 focus:border-[#977DFF] focus:ring-4 focus:ring-[#977DFF]/15"
            />
          </div>
        </div>

        {filteredFolders.length === 0 ? (
          <EmptyState searchQuery={searchQuery} />
        ) : (
          <div id="folders-grid" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onEdit={openEditFolder}
                onDelete={setDeletingFolder}
              />
            ))}
          </div>
        )}
      </main>

      <CreateFolderModal
        isOpen={isFolderModalOpen}
        initialFolder={editingFolder}
        onClose={() => setIsFolderModalOpen(false)}
        onSubmit={handleFolderSubmit}
      />

      <ConfirmationModal
        isOpen={Boolean(deletingFolder)}
        onClose={() => setDeletingFolder(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Folder"
        message={`Are you sure you want to delete the folder ${deletingFolder?.name ?? ''}?`}
      />
    </div>
  )
}

function FolderCard({
  folder,
  onEdit,
  onDelete,
}: {
  folder: LocalFolder
  onEdit: (folder: LocalFolder) => void
  onDelete: (folder: LocalFolder) => void
}) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const styles = colorStyles[folder.color]

  useEffect(() => {
    if (!showMenu) return
    const closeMenu = () => setShowMenu(false)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [showMenu])

  return (
    <article
      onClick={() => navigate(`/folders/${folder.id}`)}
      className="group relative h-64 w-full cursor-pointer overflow-hidden rounded-[1.75rem] shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-[#977DFF]/15"
    >
      <div className={`absolute inset-x-0 bottom-0 h-[88%] rounded-[1.75rem] bg-gradient-to-br ${styles.back}`} />

      <div className="absolute inset-x-7 top-5 z-10 h-26 rounded-t-2xl rounded-b-lg border border-white/80 bg-white shadow-xl shadow-slate-900/5 transition-transform duration-300 group-hover:-translate-y-2">
        <div className="space-y-2 p-5 opacity-55">
          <div className="h-2 w-2/3 rounded-full bg-slate-200" />
          <div className="h-2 w-full rounded-full bg-slate-200" />
          <div className="h-2 w-4/5 rounded-full bg-slate-200" />
        </div>
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 z-20 h-[66%] overflow-hidden rounded-b-[1.75rem] bg-gradient-to-t ${styles.front} shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]`}
        style={{ clipPath: 'polygon(0 0, 40% 0, 55% 16%, 100% 16%, 100% 100%, 0 100%)' }}
      />

      <div className="absolute inset-0 z-30 flex flex-col justify-end p-6">
        <div className="mb-5 flex items-center justify-between">
          <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 ${styles.icon}`}>
            <Folder className="h-5 w-5" />
          </span>
          <div className="relative">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              aria-label={`${folder.name} options`}
              aria-expanded={showMenu}
              onClick={(event) => {
                event.stopPropagation()
                setShowMenu((current) => !current)
              }}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {showMenu && (
              <div
                className="absolute bottom-full right-0 z-50 mb-2 w-36 overflow-hidden rounded-2xl bg-white py-1.5 shadow-xl ring-1 ring-slate-200 animate-modal-in"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    onEdit(folder)
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    onDelete(folder)
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        <h3 className="truncate text-2xl font-extrabold tracking-tight text-white">{folder.name}</h3>
        <p className="mt-1 line-clamp-1 text-sm font-semibold text-white/80">{folder.purpose}</p>
        <p className="mt-4 text-sm font-bold text-white/90">
          {folder.notes.length} note{folder.notes.length !== 1 ? 's' : ''}
        </p>
      </div>
    </article>
  )
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-[#977DFF]/30 bg-white text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#FFCCF2]/55 text-[#977DFF]">
        <Folder className="h-8 w-8" />
      </span>
      <h3 className="text-xl font-bold text-slate-800">No matching folders</h3>
      <p className="mt-2 max-w-xs text-sm font-medium text-slate-500">
        Nothing matched “{searchQuery}”. Try a different search term.
      </p>
    </div>
  )
}
