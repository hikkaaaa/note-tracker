export type FolderColor = 'purple' | 'pink' | 'blue' | 'red' | 'green'

export interface LocalNote {
  id: number
  title: string
  purpose?: string
  created_at: string
}

export interface LocalFolder {
  id: number
  name: string
  purpose: string
  color: FolderColor
  notes: LocalNote[]
}

export interface LocalSection {
  id: number
  type: 'text' | 'checklist' | 'tickbox' | 'list' | 'table' | 'code'
  content: string
}

const foldersKey = 'note-tracker.local-folders'
const sectionsKey = 'note-tracker.local-sections'

const seedFolders: LocalFolder[] = [
  {
    id: 1,
    name: 'Leetcode',
    purpose: 'Patterns and practice notes',
    color: 'blue',
    notes: [{ id: 101, title: 'Two pointer patterns', purpose: 'Practice notes', created_at: new Date().toISOString() }],
  },
  {
    id: 2,
    name: 'daily digestion',
    purpose: 'Collected thoughts and reading',
    color: 'pink',
    notes: [
      { id: 201, title: 'Reading notes', purpose: 'Morning summary', created_at: new Date().toISOString() },
      { id: 202, title: 'Ideas inbox', purpose: 'Loose thoughts', created_at: new Date().toISOString() },
      { id: 203, title: 'Health log', purpose: 'Daily notes', created_at: new Date().toISOString() },
      { id: 204, title: 'Evening review', purpose: 'Wrap-up', created_at: new Date().toISOString() },
    ],
  },
  {
    id: 3,
    name: 'Fullstack',
    purpose: 'Frontend and backend references',
    color: 'purple',
    notes: [
      { id: 301, title: 'React patterns', purpose: 'UI references', created_at: new Date().toISOString() },
      { id: 302, title: 'API checklist', purpose: 'Backend notes', created_at: new Date().toISOString() },
      { id: 303, title: 'Deployment', purpose: 'Release notes', created_at: new Date().toISOString() },
    ],
  },
  {
    id: 4,
    name: 'Projects',
    purpose: 'Build plans and follow-ups',
    color: 'purple',
    notes: [{ id: 401, title: 'Roadmap', purpose: 'Next steps', created_at: new Date().toISOString() }],
  },
  {
    id: 5,
    name: 'algorithms',
    purpose: 'Core concepts and examples',
    color: 'blue',
    notes: [{ id: 501, title: 'Graph basics', purpose: 'Reference', created_at: new Date().toISOString() }],
  },
]

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const stored = window.localStorage.getItem(key)
  if (!stored) return fallback
  try {
    return JSON.parse(stored) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function getLocalFolders(): LocalFolder[] {
  const folders = readJson<LocalFolder[] | null>(foldersKey, null)
  if (folders) return folders
  writeJson(foldersKey, seedFolders)
  return seedFolders
}

export function saveLocalFolders(folders: LocalFolder[]) {
  writeJson(foldersKey, folders)
}

export function getLocalFolder(folderId: number): LocalFolder | null {
  return getLocalFolders().find((folder) => folder.id === folderId) ?? null
}

export function getLocalNote(noteId: number): LocalNote | null {
  for (const folder of getLocalFolders()) {
    const note = folder.notes.find((item) => item.id === noteId)
    if (note) return note
  }
  return null
}

export function createLocalNote(folderId: number, title: string, purpose: string): LocalNote | null {
  const folders = getLocalFolders()
  const nextNote: LocalNote = {
    id: Date.now(),
    title,
    purpose,
    created_at: new Date().toISOString(),
  }
  const updatedFolders = folders.map((folder) =>
    folder.id === folderId ? { ...folder, notes: [nextNote, ...folder.notes] } : folder,
  )
  saveLocalFolders(updatedFolders)
  writeJson(`${sectionsKey}.${nextNote.id}`, [])
  return updatedFolders.some((folder) => folder.id === folderId) ? nextNote : null
}

export function deleteLocalNote(noteId: number) {
  saveLocalFolders(
    getLocalFolders().map((folder) => ({
      ...folder,
      notes: folder.notes.filter((note) => note.id !== noteId),
    })),
  )
}

export function getLocalSections(noteId: number): LocalSection[] {
  return readJson<LocalSection[]>(`${sectionsKey}.${noteId}`, [])
}

export function saveLocalSections(noteId: number, sections: LocalSection[]) {
  writeJson(`${sectionsKey}.${noteId}`, sections)
}
