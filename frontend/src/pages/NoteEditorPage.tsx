import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, useBlocker } from 'react-router-dom'
import { Plus, Type, CheckSquare, ListTodo, ChevronLeft, ChevronRight, Save, Loader2, Trash2, List as ListIcon, Table as TableIcon, LayoutDashboard, LayoutList, GripVertical, MoreVertical, Copy, ClipboardPaste, Download, Code2, Heading, Image as ImageIcon, Timer as TimerIcon } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useReactToPrint } from 'react-to-print'
import { DndContext, DragOverlay, useDraggable, useDroppable, pointerWithin } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import { RichTextEditor } from '../components/RichTextEditor'
import { NoteTimer } from '../components/NoteTimer'
import { FormatListBlock } from '../components/FormatListBlock'
import { TableBlock } from '../components/TableBlock'
import { CodeBlock } from '../components/CodeBlock'
import { ImageBlock } from '../components/ImageBlock'
import { getLocalSections, saveLocalSections, getCopiedBlock, saveCopiedBlock, clipboardKeyFor, type CopiedBlock } from '../lib/localWorkspace'
import type { LocalFolder } from '../lib/localWorkspace'
import { getSwatch } from '../lib/folderColors'
import { authedFetch } from '../lib/api'
import { fetchFolder } from '../lib/workspace'
import { getAuthToken } from '../lib/authToken'

interface SectionData {
  id: number
  type: 'text' | 'checklist' | 'tickbox' | 'list' | 'table' | 'code' | 'image'
  content: string
  // Optional per-block title. null = no title (text/code, or removed); a string (incl. '')
  // = a titled block. See TITLE_BLOCKS for which types show a title by default.
  title?: string | null
}

// Block types that carry an editable title. Text and code blocks never do (code has
// its own built-in title in a different style).
const TITLE_BLOCKS = new Set(['checklist', 'tickbox', 'list', 'table', 'image'])
const canHaveTitle = (type: string) => TITLE_BLOCKS.has(type)
// A title-capable block shows its title unless it has been explicitly removed (null).
const blockShowsTitle = (s: { type: string, title?: string | null }) => canHaveTitle(s.type) && s.title !== null
// Titles are rich-text HTML; treat tag-only/whitespace markup (e.g. "<p></p>") as empty
// so the "Untitled" placeholder shows.
const isBlankHtml = (html?: string | null) => !html || html.replace(/<[^>]+>/g, '').replace(/&nbsp;|\s/g, '') === ''

interface NoteData {
  id: number
  title: string
  purpose?: string
}

const bricolage = "'Bricolage Grotesque', sans-serif"
const geist = "'Geist', ui-sans-serif, sans-serif"
const mono = "'Geist Mono', monospace"

// Smooth tween for section enter/exit/reorder. A plain duration+ease (not a spring) so
// blocks settle without the overshoot/bounce that the default layout spring produces.
const SECTION_TRANSITION = { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }

// Drag-to-add palette (Bloom). Each block type gets an accent + soft tint tile.
const BLOCK_DEFS = [
  { type: 'text', title: 'Text Block', subtitle: 'Free-form prose', icon: Type, accent: '#3B82F6', tint: 'rgba(59,130,246,0.12)' },
  { type: 'checklist', title: 'Checklist', subtitle: 'Checks move to bottom', icon: ListTodo, accent: '#10B981', tint: 'rgba(16,185,129,0.12)' },
  { type: 'tickbox', title: 'Tickboxes', subtitle: 'Static order', icon: CheckSquare, accent: '#EC4899', tint: 'rgba(236,72,153,0.12)' },
  { type: 'list', title: 'List', subtitle: 'Custom styles', icon: ListIcon, accent: '#F97316', tint: 'rgba(249,115,22,0.12)' },
  { type: 'table', title: 'Table', subtitle: 'Resizable grid', icon: TableIcon, accent: '#14B8A6', tint: 'rgba(20,184,166,0.14)' },
  { type: 'code', title: 'Code Block', subtitle: 'Syntax highlighted', icon: Code2, accent: '#5B21B6', tint: 'rgba(91,33,182,0.12)' },
  { type: 'image', title: 'Image', subtitle: 'Drag, drop or browse', icon: ImageIcon, accent: '#8B5CF6', tint: 'rgba(139,92,246,0.12)' },
] as const

// best-effort word count across all section types (strip HTML / JSON wrappers)
function countWords(sections: SectionData[]) {
  let n = 0
  for (const s of sections) {
    let text = ''
    if (s.type === 'text' || s.type === 'table') text = s.content
    else if (s.type === 'list') {
      try { text = (JSON.parse(s.content).items ?? []).map((i: { text: string }) => i.text).join(' ') } catch { /* ignore */ }
    } else if (s.type === 'checklist' || s.type === 'tickbox') {
      try { text = (JSON.parse(s.content) as Array<{ text: string }>).map((i) => i.text).join(' ') } catch { /* ignore */ }
    } else if (s.type === 'code') {
      try { text = JSON.parse(s.content).code ?? '' } catch { /* ignore */ }
    }
    n += text.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  }
  return n
}

// Plain-text rendering of a block, for the system clipboard so it can be pasted into
// other apps. Best-effort per block type; HTML is stripped to its text.
function blockToPlainText(block: CopiedBlock): string {
  const stripHtml = (html: string) =>
    html.replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim()
  const titleText = block.title ? stripHtml(block.title) : ''
  const titlePrefix = titleText ? `${titleText}\n` : ''
  let body = ''
  try {
    if (block.type === 'text' || block.type === 'table') body = stripHtml(block.content)
    else if (block.type === 'list') body = (JSON.parse(block.content).items ?? []).map((i: { text: string }) => `• ${i.text}`).join('\n')
    else if (block.type === 'checklist' || block.type === 'tickbox') body = (JSON.parse(block.content) as Array<{ text: string, checked: boolean }>).map((i) => `${i.checked ? '[x]' : '[ ]'} ${i.text}`).join('\n')
    else if (block.type === 'code') body = JSON.parse(block.content).code ?? ''
  } catch { body = block.content }
  return `${titlePrefix}${body}`.trim()
}

export function NoteEditorPage() {
  const { noteId } = useParams()
  const navigate = useNavigate()
  const [note, setNote] = useState<NoteData | null>(null)
  const [sections, setSections] = useState<SectionData[]>([])
  const [layoutRows, setLayoutRows] = useState<number[][]>([])
  const [layoutSectionId, setLayoutSectionId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [showTimer, setShowTimer] = useState(false)
  const [layoutMode, setLayoutMode] = useState<'vertical' | 'horizontal'>('vertical')
  const [activeDragItem, setActiveDragItem] = useState<any>(null)
  // Seed from the shared localStorage clipboard so a block copied in another note (or
  // before a reload) can be pasted here.
  const [copiedBlock, setCopiedBlock] = useState<CopiedBlock | null>(() => getCopiedBlock())
  const [deletedStack, setDeletedStack] = useState<Array<{ type: string, content: string, rowIndex: number, colIndex: number }>>([])

  const contentRef = useRef<HTMLDivElement>(null);

  // The note's folder (for breadcrumb + accent color) comes from the backend once the
  // note loads — see fetchNoteAndSections, which resolves it via the note's folder_id.
  const [folder, setFolder] = useState<LocalFolder | null>(null)
  const accent = getSwatch(folder?.color ?? 'violet')
  const wordCount = useMemo(() => countWords(sections), [sections])

  // No session → back to login.
  useEffect(() => {
    if (!getAuthToken()) navigate('/login', { replace: true })
  }, [navigate])

  const handleExportPDF = useReactToPrint({
    contentRef,
    documentTitle: note?.title || 'Note',
    pageStyle: `
      @page {
        margin: 20mm !important;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
        }
      }
    `
  })

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  )

  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const fetchNoteAndSections = useCallback(async () => {
    if (!noteId) return
    const parsedNoteId = parseInt(noteId)
    try {
      const noteRes = await authedFetch(`/notes/${noteId}`)
      if (noteRes.ok) {
        const noteData = await noteRes.json()
        setNote(noteData)
        // Resolve the owning folder for the breadcrumb + accent color.
        if (noteData.folder_id != null) {
          fetchFolder(noteData.folder_id).then(setFolder).catch(() => setFolder(null))
        }
      } else {
        setNote(null)
      }

      const sectionsRes = await authedFetch(`/notes/${noteId}/sections/`)
      if (sectionsRes.ok) {
        const data = await sectionsRes.json()
        const layoutSecs = data.filter((s: any) => s.type === 'layout');
        const regularSecs = data.filter((s: any) => s.type !== 'layout');
        setSections(regularSecs)

        // Use the most-recently-saved layout (highest id). A previous bug created a new
        // layout row on every save, so a note can carry several; the older ones hold a
        // stale order that omits later-added blocks. Best-effort delete the duplicates so
        // the DB self-heals.
        const layoutSec = layoutSecs.length
          ? layoutSecs.reduce((a: any, b: any) => (b.id > a.id ? b : a))
          : undefined;
        layoutSecs
          .filter((s: any) => s.id !== layoutSec?.id)
          .forEach((s: any) => { authedFetch(`/sections/${s.id}`, { method: 'DELETE' }).catch(() => {}) });

        if (layoutSec) {
           setLayoutSectionId(layoutSec.id);
           try {
              const parsed = JSON.parse(layoutSec.content);
              if (Array.isArray(parsed)) {
                  const presentIds = new Set(parsed.flat());
                  let finalRows = [...parsed];
                  regularSecs.forEach((sec: any) => {
                     if (!presentIds.has(sec.id)) finalRows.push([sec.id]);
                  })
                  setLayoutRows(finalRows);
              } else setLayoutRows(regularSecs.map((s: any) => [s.id]));
           } catch { setLayoutRows(regularSecs.map((s: any) => [s.id])) }
        } else {
           setLayoutSectionId(null);
           setLayoutRows(regularSecs.map((s: any) => [s.id]));
        }
      } else {
        const localSections = getLocalSections(parsedNoteId)
        setSections(localSections)
        setLayoutSectionId(null)
        setLayoutRows(localSections.map((section) => [section.id]))
      }
    } catch {
      // Network/backend hiccup (a 401 has already redirected to /login): fall back to any
      // sections buffered locally for this note so in-progress work isn't lost.
      const localSections = getLocalSections(parsedNoteId)
      setSections(localSections)
      setLayoutSectionId(null)
      setLayoutRows(localSections.map((section) => [section.id]))
    } finally {
       setIsLoading(false)
    }
  }, [noteId])

  useEffect(() => {
    fetchNoteAndSections()
  }, [fetchNoteAndSections])

  // Keep the paste option in sync when a block is copied in another tab/window.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === clipboardKeyFor()) setCopiedBlock(getCopiedBlock())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const addSectionAt = async (type: any, targetId: number | null, position: 'top'|'bottom'|'left'|'right', customContent?: string, customTitle?: string | null) => {
    if (!noteId) return
    let defaultContent = ''
    if (customContent !== undefined) {
      defaultContent = customContent
    } else if (type === 'checklist' || type === 'tickbox') defaultContent = JSON.stringify([{ id: Date.now().toString(), text: '', checked: false }])
    else if (type === 'list') defaultContent = JSON.stringify({ style: '1.', items: [{ id: Date.now().toString(), text: '' }] })
    else if (type === 'table') defaultContent = `<table style="width:100%"><tbody><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr></tbody></table>`
    else if (type === 'code') defaultContent = JSON.stringify({ language: '', code: '' })
    else if (type === 'image') defaultContent = JSON.stringify({ src: '' })

    // A pasted block carries its own title; otherwise title-capable blocks start with an
    // (empty) title shown by default, and other types have none.
    const defaultTitle = customTitle !== undefined ? customTitle : (canHaveTitle(type) ? '' : null)

    const addSectionToLayout = (newSection: SectionData) => {
      setSections(prev => {
        const nextSections = [...prev, newSection]
        saveLocalSections(parseInt(noteId), nextSections)
        return nextSections
      })
      setIsDirty(true)
      setLayoutRows(prev => {
          let newLayout = [...prev];
          if (!targetId) {
              newLayout.push([newSection.id]);
              return newLayout;
          }
          for (let r = 0; r < newLayout.length; r++) {
              const row = [...newLayout[r]];
              const cIndex = row.indexOf(targetId);
              if (cIndex !== -1) {
                  if (position === 'left') row.splice(cIndex, 0, newSection.id);
                  else if (position === 'right') row.splice(cIndex + 1, 0, newSection.id);
                  else if (position === 'top') { newLayout.splice(r, 0, [newSection.id]); return newLayout; }
                  else if (position === 'bottom') { newLayout.splice(r + 1, 0, [newSection.id]); return newLayout; }
                  newLayout[r] = row;
                  break;
              }
          }
          return newLayout;
      });
    }

    try {
      const res = await authedFetch(`/notes/${noteId}/sections/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, content: defaultContent, title: defaultTitle }) })
      if (res.ok) {
        const newSection = await res.json()
        addSectionToLayout(newSection)
      } else {
        addSectionToLayout({ id: Date.now(), type, content: defaultContent, title: defaultTitle })
      }
    } catch {
      addSectionToLayout({ id: Date.now(), type, content: defaultContent, title: defaultTitle })
    }
  }

  const addSection = (type: any) => addSectionAt(type, null, 'bottom');

  const moveExistingSection = (sourceId: number, targetId: number | null, position: 'top'|'bottom'|'left'|'right') => {
    if (sourceId === targetId) return;
    setLayoutRows(prev => {
        let newLayout = prev.map(row => row.filter(id => id !== sourceId)).filter(row => row.length > 0);
        if (!targetId) {
            newLayout.push([sourceId]);
            return newLayout;
        }
        for (let r = 0; r < newLayout.length; r++) {
            const row = [...newLayout[r]];
            const cIndex = row.indexOf(targetId);
            if (cIndex !== -1) {
                if (position === 'left') row.splice(cIndex, 0, sourceId);
                else if (position === 'right') row.splice(cIndex + 1, 0, sourceId);
                else if (position === 'top') { newLayout.splice(r, 0, [sourceId]); return newLayout; }
                else if (position === 'bottom') { newLayout.splice(r + 1, 0, [sourceId]); return newLayout; }
                newLayout[r] = row;
                break;
            }
        }
        return newLayout;
    });
    setIsDirty(true);
  }

  const updateSectionContentLocal = (id: number, content: string) => {
    setSections(prev => {
      const nextSections = prev.map(s => s.id === id ? { ...s, content } : s)
      if (noteId) saveLocalSections(parseInt(noteId), nextSections)
      return nextSections
    })
    setIsDirty(true)
  }

  // Update a block's title. Pass a string to set/show it, or null to remove it entirely.
  const updateSectionTitleLocal = (id: number, title: string | null) => {
    setSections(prev => {
      const nextSections = prev.map(s => s.id === id ? { ...s, title } : s)
      if (noteId) saveLocalSections(parseInt(noteId), nextSections)
      return nextSections
    })
    setIsDirty(true)
  }

  const deleteSection = async (id: number) => {
    const target = sections.find(s => s.id === id)
    let rowIndex = -1, colIndex = -1
    for (let r = 0; r < layoutRows.length; r++) {
      const c = layoutRows[r].indexOf(id)
      if (c !== -1) { rowIndex = r; colIndex = c; break }
    }
    try {
      await authedFetch(`/sections/${id}`, { method: 'DELETE' })
      setSections(prev => {
        const nextSections = prev.filter(s => s.id !== id)
        if (noteId) saveLocalSections(parseInt(noteId), nextSections)
        return nextSections
      })
      setLayoutRows(prev => prev.map(row => row.filter(rid => rid !== id)).filter(row => row.length > 0))
      if (target && rowIndex !== -1) {
        setDeletedStack(prev => [...prev, { type: target.type, content: target.content, rowIndex, colIndex }])
      }
      setIsDirty(true)
    } catch {
      setSections(prev => {
        const nextSections = prev.filter(s => s.id !== id)
        if (noteId) saveLocalSections(parseInt(noteId), nextSections)
        return nextSections
      })
      setLayoutRows(prev => prev.map(row => row.filter(rid => rid !== id)).filter(row => row.length > 0))
      if (target && rowIndex !== -1) {
        setDeletedStack(prev => [...prev, { type: target.type, content: target.content, rowIndex, colIndex }])
      }
      setIsDirty(true)
    }
  }

  const undoDelete = useCallback(async () => {
    if (!noteId || deletedStack.length === 0) return
    const last = deletedStack[deletedStack.length - 1]
    try {
      const res = await authedFetch(`/notes/${noteId}/sections/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: last.type, content: last.content })
      })
      if (!res.ok) return
      const newSection = await res.json()
      setSections(prev => [...prev, newSection])
      setLayoutRows(prev => {
        const newLayout = [...prev]
        if (last.rowIndex >= 0 && last.rowIndex < newLayout.length) {
          const row = [...newLayout[last.rowIndex]]
          row.splice(Math.min(last.colIndex, row.length), 0, newSection.id)
          newLayout[last.rowIndex] = row
        } else {
          newLayout.splice(Math.max(0, Math.min(last.rowIndex, newLayout.length)), 0, [newSection.id])
        }
        return newLayout
      })
      setDeletedStack(prev => prev.slice(0, -1))
      setIsDirty(true)
    } catch {
      console.error('Failed to restore section')
    }
  }, [noteId, deletedStack])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.key.toLowerCase() !== 'z' || e.shiftKey) return
      const target = e.target as HTMLElement | null
      const insideEditor = target?.closest('.ProseMirror, input, textarea')
      if (insideEditor) return
      if (deletedStack.length === 0) return
      e.preventDefault()
      undoDelete()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deletedStack, undoDelete])

  const saveWorkspace = async () => {
    setIsSaving(true)
    if (noteId) saveLocalSections(parseInt(noteId), sections)
    try {
      await Promise.all(
        sections.map(s =>
          authedFetch(`/sections/${s.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: s.content, title: s.title ?? null })
          })
        )
      )

      if (layoutSectionId) {
          await authedFetch(`/sections/${layoutSectionId}`, {
             method: 'PUT', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ content: JSON.stringify(layoutRows) })
          })
      } else {
          const res = await authedFetch(`/notes/${noteId}/sections/`, {
             method: 'POST', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ type: 'layout', content: JSON.stringify(layoutRows) })
          })
          if (res.ok) {
             const data = await res.json();
             setLayoutSectionId(data.id);
          }
      }
    } catch {
      // Local workspace changes are already saved above when the backend is unavailable.
    } finally {
      setIsSaving(false)
      setIsDirty(false)
    }
  }

  const handleSaveAndLeave = async () => {
    await saveWorkspace()
    if (blocker.state === 'blocked') blocker.proceed()
  }

  const handleLeaveWithoutSaving = () => {
    if (blocker.state === 'blocked') blocker.proceed()
  }

  const handleCancelLeave = () => {
    if (blocker.state === 'blocked') blocker.reset()
  }

  const handleDragStart = (e: DragStartEvent) => {
    setActiveDragItem(e.active)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragItem(null)
    const { over, active } = e
    if (!over) return;

    const sourceData = active.data.current;
    if (!sourceData) return;

    if (over.id === 'canvas-droppable') {
       if (sourceData.isExisting) moveExistingSection(sourceData.id, null, 'bottom');
       else addSectionAt(sourceData.type, null, 'bottom');
       return;
    }

    const overStr = String(over.id);
    if (overStr.startsWith('drop-')) {
       const parts = overStr.split('-');
       const position = parts[1] as any;
       const targetId = parseInt(parts[2]);

       if (sourceData.isExisting) moveExistingSection(sourceData.id, targetId, position);
       else addSectionAt(sourceData.type, targetId, position);
    }
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
    <div
      className="min-h-screen overflow-x-clip"
      style={{ background: '#FBF7F2', color: '#1B1326', fontFamily: geist, ['--accent' as string]: accent.swatch, ['--accent-tint' as string]: accent.tint } as React.CSSProperties}
    >
      {/* sub-topbar */}
      <header className="sticky top-0 z-40 border-b border-[#1B1326]/[0.06] bg-[#FBF7F2]/85 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-5 py-3 sm:px-10">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="bloom-backbtn grid h-[42px] w-[42px] flex-shrink-0 place-items-center rounded-full border border-[#1B1326]/[0.08] bg-white text-[#1B1326] shadow-[0_8px_22px_-16px_rgba(27,19,38,0.2)]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </button>

          <div className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
            <button onClick={() => navigate('/dashboard')} className="hidden px-1 py-1.5 text-[#6E5F7B] transition-colors hover:text-[#1B1326] sm:inline">Folders</button>
            {folder && (
              <>
                <span className="hidden text-[#6E5F7B] opacity-40 sm:inline">/</span>
                <button onClick={() => navigate(`/folders/${folder.id}`)} className="hidden items-center gap-1.5 px-1 py-1.5 font-semibold text-[#1B1326] sm:inline-flex">
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: accent.swatch }} />
                  {folder.name}
                </button>
              </>
            )}
            <span className="hidden text-[#6E5F7B] opacity-40 sm:inline">/</span>
            <span className="max-w-[200px] truncate font-extrabold tracking-[-0.01em]" style={{ fontFamily: bricolage }}>
              {note ? note.title : 'Loading…'}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <div className="inline-flex rounded-xl border border-[#1B1326]/[0.08] bg-white p-1">
              <button
                onClick={() => setLayoutMode('vertical')}
                title="Focus width"
                className="grid h-8 w-8 place-items-center rounded-lg transition-colors"
                style={layoutMode === 'vertical' ? { background: accent.tint, color: accent.swatch } : { color: '#6E5F7B' }}
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                onClick={() => setLayoutMode('horizontal')}
                title="Wide width"
                className="grid h-8 w-8 place-items-center rounded-lg transition-colors"
                style={layoutMode === 'horizontal' ? { background: accent.tint, color: accent.swatch } : { color: '#6E5F7B' }}
              >
                <LayoutDashboard className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => handleExportPDF()}
              className="note-ghost-btn inline-flex items-center gap-2 rounded-xl border border-[#1B1326]/[0.08] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1B1326]"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
            <button
              onClick={saveWorkspace}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1B1326] px-[18px] py-2.5 text-[13px] font-bold text-[#FBF7F2] shadow-[0_14px_30px_-16px_rgba(27,19,38,0.5)] transition-transform hover:-translate-y-px disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{isSaving ? 'Saving…' : 'Save Workspace'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-6 sm:px-10">
        {/* hero */}
        <section className="mb-6 print:hidden">
          <div className="mb-3.5 flex flex-wrap items-center gap-2.5 text-[11px] uppercase tracking-[0.06em] text-[#6E5F7B]" style={{ fontFamily: mono }}>
            {folder && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold normal-case tracking-normal" style={{ background: accent.tint, color: accent.swatch }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent.swatch }} />
                {folder.name}
              </span>
            )}
            <span className="opacity-40">·</span>
            <span>{isDirty ? 'unsaved changes' : 'edited just now'}</span>
            <span className="opacity-40">·</span>
            <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          </div>
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <h1 className="m-0 font-extrabold leading-[1.04] tracking-[-0.035em]" style={{ fontFamily: bricolage, fontSize: 'clamp(38px, 5.5vw, 68px)' }}>
              {note ? note.title : 'Loading…'}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(120deg, ${accent.swatch}, #EC4899)` }}>.</span>
            </h1>
            {showTimer && (
              <div className="mb-1.5 animate-modal-in sm:ml-4">
                <NoteTimer accent={accent.swatch} accentTint={accent.tint} onClose={() => setShowTimer(false)} />
              </div>
            )}
          </div>
          {note?.purpose && (
            <p className="mt-3.5 max-w-[720px] text-base leading-[1.55] text-[#6E5F7B]">{note.purpose}</p>
          )}
        </section>

        {/* workspace: drag-to-add (left) · canvas (center) · tools (right).
            Both side panels sticky so they stay in view, and share one baseline via the
            grid row's items-start. Below md they collapse so the canvas isn't squished. */}
        <main className="flex items-start gap-6 print:block">
          {/* LEFT — drag to add */}
          <AnimatePresence initial={false}>
          {leftOpen && (
            <motion.aside
              key="left-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="sticky top-24 hidden shrink-0 self-start overflow-hidden md:block print:hidden"
            >
            <div className="flex max-h-[calc(100vh_-_7rem)] w-[64px] flex-col gap-2.5 lg:w-[280px]">
              <div className="flex flex-shrink-0 items-center justify-center px-1 lg:justify-between">
                <span className="hidden text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6E5F7B] lg:inline" style={{ fontFamily: mono }}>Drag to add</span>
                <Plus className="h-3.5 w-3.5 text-[#F59E0B]" />
              </div>
              <div className="flex min-h-0 flex-col gap-2 overflow-y-auto px-1 py-1.5 -mx-1">
                {BLOCK_DEFS.map((b) => (
                  <DraggableSidebarItem
                    key={b.type}
                    type={b.type}
                    title={b.title}
                    subtitle={b.subtitle}
                    icon={b.icon}
                    accent={b.accent}
                    tint={b.tint}
                    onClick={() => addSection(b.type)}
                  />
                ))}
              </div>
              <div className="mt-3 hidden flex-shrink-0 flex-col gap-1.5 rounded-2xl border border-dashed border-[#1B1326]/[0.08] bg-[#1B1326]/[0.03] px-3.5 py-3 text-[11px] text-[#6E5F7B] lg:flex">
                <p className="m-0">Drag a tile onto the page, or drop one beside a block to make columns.</p>
                <p className="m-0">⌘Z restores a deleted block.</p>
              </div>
            </div>
            </motion.aside>
          )}
          </AnimatePresence>

          {/* CENTER — canvas */}
          <DroppableCanvas
            contentRef={contentRef}
            layoutMode={layoutMode}
            layoutRows={layoutRows}
            sections={sections}
            isLoading={isLoading}
            activeDragItem={activeDragItem}
            updateSectionContentLocal={updateSectionContentLocal}
            updateSectionTitleLocal={updateSectionTitleLocal}
            deleteSection={deleteSection}
            copiedBlock={copiedBlock}
            setCopiedBlock={setCopiedBlock}
            addSectionAt={addSectionAt}
          />

          {/* RIGHT — tools */}
          <AnimatePresence initial={false}>
          {rightOpen && (
            <motion.aside
              key="right-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="sticky top-24 hidden shrink-0 self-start overflow-hidden md:block print:hidden"
            >
            <div className="flex max-h-[calc(100vh_-_7rem)] w-[64px] flex-col gap-2.5 lg:w-[280px]">
              <div className="flex flex-shrink-0 items-center justify-center px-1 lg:justify-between">
                <span className="hidden text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6E5F7B] lg:inline" style={{ fontFamily: mono }}>Tools</span>
                <TimerIcon className="h-3.5 w-3.5 text-[#F59E0B]" />
              </div>
              <div className="flex min-h-0 flex-col gap-2 px-1 py-1.5 -mx-1">
                <ToolCard
                  icon={TimerIcon}
                  title="Timer"
                  subtitle="Countdown + chime"
                  accent="#8B5CF6"
                  tint="rgba(139,92,246,0.12)"
                  active={showTimer}
                  onClick={() => setShowTimer((v) => !v)}
                />
              </div>
            </div>
            </motion.aside>
          )}
          </AnimatePresence>
        </main>
      </div>

      <UnsavedChangesModal
        isOpen={blocker.state === 'blocked'}
        onSaveAndLeave={handleSaveAndLeave}
        onLeave={handleLeaveWithoutSaving}
        onCancel={handleCancelLeave}
      />
      <DragOverlay>
        {activeDragItem ? (
          <div className="flex w-64 items-center gap-3 rounded-2xl border border-[#1B1326]/[0.1] bg-white px-3 py-3 opacity-95 shadow-[0_20px_40px_-16px_rgba(27,19,38,0.35)]">
            {activeDragItem.data.current?.icon && (
              <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: activeDragItem.data.current?.tint ?? 'rgba(139,92,246,0.12)', color: activeDragItem.data.current?.accent ?? '#8B5CF6' }}>
                <activeDragItem.data.current.icon className="h-[18px] w-[18px]" />
              </span>
            )}
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-[#1B1326]">{activeDragItem.data.current?.title}</span>
              {activeDragItem.data.current?.subtitle && <span className="text-[11px] font-normal text-[#6E5F7B]">{activeDragItem.data.current.subtitle}</span>}
            </div>
          </div>
        ) : null}
      </DragOverlay>

      <button
        onClick={() => setLeftOpen((v) => !v)}
        className="fixed bottom-6 left-6 z-50 hidden h-12 w-12 items-center justify-center rounded-full border border-[#1B1326]/[0.08] bg-white text-[#6E5F7B] shadow-[0_14px_30px_-12px_rgba(27,19,38,0.4)] transition-all hover:text-[#1B1326] md:flex print:hidden"
        aria-label={leftOpen ? 'Hide left panel' : 'Show left panel'}
        title={leftOpen ? 'Hide “Drag to add” panel' : 'Show “Drag to add” panel'}
      >
        {leftOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </button>

      <button
        onClick={() => setRightOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 hidden h-12 w-12 items-center justify-center rounded-full border border-[#1B1326]/[0.08] bg-white text-[#6E5F7B] shadow-[0_14px_30px_-12px_rgba(27,19,38,0.4)] transition-all hover:text-[#1B1326] md:flex print:hidden"
        aria-label={rightOpen ? 'Hide right panel' : 'Show right panel'}
        title={rightOpen ? 'Hide “Tools” panel' : 'Show “Tools” panel'}
      >
        {rightOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>
    </div>
    </DndContext>
  )
}

function DroppableCanvas({ contentRef, layoutMode, layoutRows, sections, isLoading, activeDragItem, updateSectionContentLocal, updateSectionTitleLocal, deleteSection, copiedBlock, setCopiedBlock, addSectionAt }: any) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-droppable' })
  return (
    <section className="flex min-w-0 flex-1 justify-center print:block">
      <div ref={contentRef} id="pdf-content-area" className={`w-full rounded-[6px] border border-[#1B1326]/[0.08] bg-white p-8 pb-24 shadow-[0_1px_0_rgba(27,19,38,0.04),0_8px_18px_-10px_rgba(27,19,38,0.08),0_30px_60px_-28px_rgba(27,19,38,0.18)] transition-all sm:p-14 print:border-none print:p-0 print:shadow-none ${layoutMode === 'horizontal' ? 'max-w-[1000px] min-h-[700px]' : 'max-w-[760px] min-h-[842px]'}`}>
        {isLoading ? (
           <div className="flex justify-center pt-20"><Loader2 className="h-6 w-6 animate-spin text-[#6E5F7B]" /></div>
        ) : sections.length === 0 ? (
          <div ref={setNodeRef}>
            <EmptyNote isOver={isOver} accent="var(--accent)" addSectionAt={addSectionAt} />
          </div>
        ) : (
          <div className="flex h-full min-h-[500px] flex-col space-y-6">
            <AnimatePresence>
              {layoutRows.map((rowArr: number[]) => (
                <div key={`row-${rowArr.join()}`} className="flex w-full flex-row items-start gap-4">
                   {rowArr.map(id => {
                       const section = sections.find((s: any) => s.id === id);
                       if (!section) return null;
                       return (
                           <motion.div
                             initial={{ opacity: 0, y: 8 }}
                             animate={{ opacity: 1, y: 0 }}
                             exit={{ opacity: 0 }}
                             transition={SECTION_TRANSITION}
                             key={section.id}
                             className="h-full min-w-0 flex-[1_1_0%]"
                           >
                             <BlockWrapper
                               section={section}
                               activeDragItem={activeDragItem}
                               onCopy={() => {
                                 const block: CopiedBlock = { type: section.type, content: section.content, title: section.title }
                                 setCopiedBlock(block)
                                 saveCopiedBlock(block) // shared across notes + survives reload
                                 // also place a plain-text version on the OS clipboard for other apps
                                 navigator.clipboard?.writeText(blockToPlainText(block)).catch(() => {})
                               }}
                               onPaste={() => {
                                 if (copiedBlock) addSectionAt(copiedBlock.type, section.id, 'bottom', copiedBlock.content, copiedBlock.title)
                               }}
                               canPaste={!!copiedBlock}
                               onChange={(content: string) => updateSectionContentLocal(section.id, content)}
                               onTitleChange={(title: string | null) => updateSectionTitleLocal(section.id, title)}
                               onDelete={() => deleteSection(section.id)}
                               onAddTextBelow={() => addSectionAt('text', section.id, 'bottom')}
                             />
                           </motion.div>
                       )
                   })}
                </div>
              ))}
            </AnimatePresence>
            {/* The general canvas dropzone is a large spacer at the bottom to catch appended blocks */}
            <div ref={setNodeRef} className={`mt-6 flex min-h-[120px] w-full flex-1 items-center justify-center rounded-xl border-2 transition-all ${isOver ? 'border-dashed' : 'border-transparent'}`} style={isOver ? { borderColor: 'var(--accent)', background: 'var(--accent-tint)', color: 'var(--accent)' } : undefined}>
                {isOver && activeDragItem && (
                   <div className="flex items-center gap-2 font-medium">
                     <Plus className="h-6 w-6" />
                     <span>Drop {activeDragItem.data.current?.title} at the bottom</span>
                   </div>
                )}
                {!isOver && (
                  <button onClick={() => addSectionAt('text', null, 'bottom')} className="flex items-center gap-2.5 px-1.5 py-2 text-[13px] text-[#6E5F7B] opacity-50 transition-opacity hover:opacity-100 print:hidden">
                    <span className="grid h-[22px] w-[22px] place-items-center rounded-md text-base font-semibold" style={{ background: 'var(--accent-tint)', color: 'var(--accent)' }}>+</span>
                    <span>Click to write, or drag a block from the right →</span>
                  </button>
                )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function EmptyNote({ isOver, accent, addSectionAt }: { isOver: boolean, accent: string, addSectionAt: (type: string, targetId: number | null, position: 'top' | 'bottom' | 'left' | 'right', customContent?: string) => void }) {
  return (
    <div className={`flex flex-col items-center justify-center px-5 pb-12 pt-20 text-center transition-all ${isOver ? 'rounded-2xl' : ''}`} style={isOver ? { background: 'var(--accent-tint)' } : undefined}>
      <div className="mb-[18px] grid h-12 w-12 place-items-center rounded-[14px]" style={{ background: 'var(--accent-tint)', color: accent }}>
        <Plus className="h-6 w-6" />
      </div>
      <h2 className="m-0 mb-2.5 text-[28px] font-extrabold tracking-[-0.025em] text-[#1B1326]" style={{ fontFamily: bricolage }}>
        {isOver ? 'Drop to create your first block' : 'This page is a blank one.'}
      </h2>
      <p className="m-0 mb-7 text-[15px] leading-[1.5] text-[#6E5F7B]">
        <span className="mr-1.5 align-[-2px] text-[22px] font-bold" style={{ fontFamily: "'Caveat', cursive", color: accent }}>Start anywhere →</span>
        tap a tile to drop a block, or just click below to write.
      </p>
      <div className="flex flex-wrap justify-center gap-2 print:hidden">
        <EmptyPill icon={Type} label="Start writing" onClick={() => addSectionAt('text', null, 'bottom')} />
        <EmptyPill icon={ListTodo} label="New checklist" onClick={() => addSectionAt('checklist', null, 'bottom')} />
        <EmptyPill icon={TableIcon} label="Insert a table" onClick={() => addSectionAt('table', null, 'bottom')} />
        <EmptyPill icon={Code2} label="Add code" onClick={() => addSectionAt('code', null, 'bottom')} />
      </div>
    </div>
  )
}

function EmptyPill({ icon: Icon, label, onClick }: { icon: React.ElementType, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="note-ghost-btn inline-flex items-center gap-2 rounded-full border border-[#1B1326]/[0.08] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#1B1326]"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  )
}

function DraggableSidebarItem({ type, title, subtitle, icon: Icon, accent, tint, onClick }: any) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `draggable-${type}`,
    data: { type, title, icon: Icon, colorClass: '', subtitle, accent, tint },
  })

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{ ['--card-accent' as string]: accent } as React.CSSProperties}
      title={title}
      className={`note-dock-card grid w-full cursor-grab place-items-center grid-cols-1 gap-0 p-2.5 lg:place-items-stretch lg:grid-cols-[36px_1fr_16px] lg:items-center lg:gap-2.5 lg:p-3 rounded-2xl border border-[#1B1326]/[0.08] bg-white text-left active:cursor-grabbing ${isDragging ? 'opacity-30' : 'opacity-100'}`}
    >
      <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: tint, color: accent }}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="hidden lg:flex min-w-0 flex-col">
        <span className="text-[13px] font-bold tracking-[-0.005em] text-[#1B1326]">{title}</span>
        {subtitle && <span className="text-[11px] leading-tight text-[#6E5F7B]">{subtitle}</span>}
      </span>
      <span className="hidden lg:inline text-[12px] tracking-[-2px] text-[#6E5F7B] opacity-50">⋮⋮</span>
    </button>
  )
}

// A Tools-panel entry. Same card shell as DraggableSidebarItem (so the two flanking
// panels read as one system) but a plain toggle button rather than a drag source.
function ToolCard({ icon: Icon, title, subtitle, accent, tint, active, onClick }: { icon: React.ElementType, title: string, subtitle?: string, accent: string, tint: string, active?: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      style={{ ['--card-accent' as string]: accent, background: active ? tint : 'white', borderColor: active ? accent : 'rgba(27,19,38,0.08)' } as React.CSSProperties}
      className="note-dock-card grid w-full place-items-center grid-cols-1 gap-0 rounded-2xl border p-2.5 text-left lg:grid-cols-[36px_1fr_16px] lg:items-center lg:place-items-stretch lg:gap-2.5 lg:p-3"
    >
      <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: active ? 'white' : tint, color: accent }}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="hidden min-w-0 flex-col lg:flex">
        <span className="text-[13px] font-bold tracking-[-0.005em] text-[#1B1326]">{title}</span>
        {subtitle && <span className="text-[11px] leading-tight text-[#6E5F7B]">{subtitle}</span>}
      </span>
      <span className="hidden h-2 w-2 place-self-center rounded-full transition-colors lg:block" style={{ background: active ? accent : 'rgba(27,19,38,0.15)' }} />
    </button>
  )
}

function UnsavedChangesModal({ isOpen, onSaveAndLeave, onLeave, onCancel }: { isOpen: boolean, onSaveAndLeave: () => void, onLeave: () => void, onCancel: () => void }) {
  if (!isOpen) return null
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(27, 19, 38, 0.45)', backdropFilter: 'blur(4px)' }}>
      <div role="dialog" className="w-full max-w-[440px] rounded-3xl bg-white p-6 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.35)] animate-modal-in" style={{ fontFamily: geist, color: '#1B1326' }}>
        <h3 className="m-0 mb-1.5 text-[20px] font-extrabold tracking-[-0.02em]" style={{ fontFamily: bricolage }}>Unsaved changes</h3>
        <p className="mb-6 text-sm text-[#6E5F7B]">Do you want to save your work? Your recent changes haven't been saved.</p>
        <div className="flex flex-col items-center justify-end gap-2.5 sm:flex-row">
          <button onClick={onCancel} className="w-full rounded-xl border-[1.5px] border-[#1B1326]/10 bg-white px-4 py-2.5 text-sm font-semibold text-[#1B1326] transition-colors hover:bg-[#F4F5F8] sm:w-auto">Cancel</button>
          <button onClick={onLeave} className="w-full rounded-xl bg-[#DC2626]/10 px-4 py-2.5 text-sm font-semibold text-[#B91C1C] transition-colors hover:bg-[#DC2626]/15 sm:w-auto">Leave without saving</button>
          <button onClick={onSaveAndLeave} className="w-full rounded-xl bg-[#1B1326] px-4 py-2.5 text-sm font-bold text-[#FBF7F2] transition-transform hover:-translate-y-px sm:w-auto">Save &amp; leave</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function BlockWrapper({ section, onChange, onTitleChange, onDelete, activeDragItem, onCopy, onPaste, canPaste, onAddTextBelow }: any) {
    const { setNodeRef: setDragRef, attributes, listeners, isDragging } = useDraggable({
        id: `existing-${section.id}`,
        data: { type: section.type, id: section.id, isExisting: true, title: 'Block', icon: GripVertical, colorClass: 'text-slate-500' }
    });

    const topDrop = useDroppable({ id: `drop-top-${section.id}` });
    const bottomDrop = useDroppable({ id: `drop-bottom-${section.id}` });
    const leftDrop = useDroppable({ id: `drop-left-${section.id}` });
    const rightDrop = useDroppable({ id: `drop-right-${section.id}` });

    const indicator = (over: boolean, vertical: boolean) =>
      `${vertical ? 'h-full w-2' : 'w-full h-2'} rounded-full transition-all duration-200 ${over ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`

    return (
        <div className={`group/wrapper relative flex h-full w-full flex-col ${isDragging ? 'scale-95 opacity-30' : ''} transition-all duration-300`}>

            {/* Edge Drop Zones */}
            {activeDragItem && !isDragging && (
               <>
                 <div ref={topDrop.setNodeRef} className="pointer-events-auto absolute -top-4 left-0 right-0 z-30 flex h-8 items-center justify-center print:hidden">
                    <div className={indicator(topDrop.isOver, false)} style={{ background: 'var(--accent)' }} />
                 </div>
                 <div ref={bottomDrop.setNodeRef} className="pointer-events-auto absolute -bottom-4 left-0 right-0 z-30 flex h-8 items-center justify-center print:hidden">
                    <div className={indicator(bottomDrop.isOver, false)} style={{ background: 'var(--accent)' }} />
                 </div>
                 <div ref={leftDrop.setNodeRef} className="pointer-events-auto absolute -left-4 bottom-0 top-0 z-30 flex w-8 items-center justify-center print:hidden">
                    <div className={indicator(leftDrop.isOver, true)} style={{ background: 'var(--accent)' }} />
                 </div>
                 <div ref={rightDrop.setNodeRef} className="pointer-events-auto absolute -right-4 bottom-0 top-0 z-30 flex w-8 items-center justify-center print:hidden">
                    <div className={indicator(rightDrop.isOver, true)} style={{ background: 'var(--accent)' }} />
                 </div>
               </>
            )}

            {/* Drag Handle */}
            <div
               ref={setDragRef}
               {...attributes}
               {...listeners}
               className="absolute -left-6 top-1/2 z-10 -translate-y-1/2 cursor-grab p-1 text-[#1B1326]/25 opacity-0 transition-opacity hover:text-[#1B1326]/50 active:cursor-grabbing group-hover/wrapper:opacity-100 print:hidden"
            >
               <GripVertical className="h-4 w-4" />
            </div>

            <BlockRenderer section={section} onChange={onChange} onTitleChange={onTitleChange} onDelete={onDelete} onCopy={onCopy} onPaste={onPaste} canPaste={canPaste} onAddTextBelow={onAddTextBelow} />
        </div>
    )
}

function BlockRenderer({ section, onChange, onTitleChange, onDelete, onCopy, onPaste, canPaste, onAddTextBelow }: { section: SectionData, onChange: (c: string) => void, onTitleChange: (t: string | null) => void, onDelete: () => void, onCopy: () => void, onPaste: () => void, canPaste: boolean, onAddTextBelow?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const showTitle = blockShowsTitle(section);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    else document.removeEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="note-block-box group/block relative h-full w-full rounded-2xl border border-[#1B1326]/[0.08] bg-white p-4 pr-14 print:border-none print:bg-transparent print:p-0 print:pr-0">
      <div className="absolute right-2 top-2 z-10 print:hidden" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`rounded-lg p-1.5 text-[#6E5F7B] transition-all hover:bg-[#1B1326]/[0.06] hover:text-[#1B1326] ${menuOpen ? 'bg-[#1B1326]/[0.06] opacity-100' : 'opacity-0 group-hover/block:opacity-100'}`}
          title="Block options"
        >
          <MoreVertical className="h-5 w-5" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-1 w-36 overflow-hidden rounded-xl border border-[#1B1326]/[0.08] bg-white py-1.5 shadow-[0_10px_24px_-8px_rgba(27,19,38,0.18),0_24px_60px_-20px_rgba(27,19,38,0.3)] animate-modal-in z-50">
            <button
              onClick={() => { onCopy(); setMenuOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-[#1B1326] transition-colors hover:bg-[#7758A3]/[0.08]"
            >
              <Copy className="h-4 w-4" /> Copy
            </button>
            <button
              onClick={() => { onPaste(); setMenuOpen(false); }}
              disabled={!canPaste}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium transition-colors ${canPaste ? 'text-[#1B1326] hover:bg-[#7758A3]/[0.08]' : 'cursor-not-allowed text-[#6E5F7B] opacity-50'}`}
            >
              <ClipboardPaste className="h-4 w-4" /> Paste
            </button>
            {canHaveTitle(section.type) && (
              showTitle ? (
                <button
                  onClick={() => { onTitleChange(null); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-[#1B1326] transition-colors hover:bg-[#7758A3]/[0.08]"
                >
                  <Heading className="h-4 w-4" /> Remove title
                </button>
              ) : (
                <button
                  onClick={() => { onTitleChange(''); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-[#1B1326] transition-colors hover:bg-[#7758A3]/[0.08]"
                >
                  <Heading className="h-4 w-4" /> Add title
                </button>
              )
            )}
            <button
              onClick={() => { onDelete(); setMenuOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-[#B91C1C] transition-colors hover:bg-[#DC2626]/[0.08]"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        )}
      </div>

      {showTitle && (
        <div className="relative mb-3">
          {isBlankHtml(section.title) && (
            <span className="pointer-events-none absolute left-1 top-1 text-[15px] tracking-[-0.01em] text-[#1B1326]/30">
              Untitled
            </span>
          )}
          <RichTextEditor
            content={section.title ?? ''}
            onChange={(html) => onTitleChange(html)}
            className="text-[15px] tracking-[-0.01em] text-[#1B1326]"
          />
        </div>
      )}

      {section.type === 'text' && (
        <RichTextEditor
          content={section.content}
          onChange={onChange}
          placeholder="Start typing..."
          className="min-h-[4rem] leading-relaxed text-[#1B1326]"
          onEnter={onAddTextBelow}
        />
      )}

      {(section.type === 'checklist' || section.type === 'tickbox') && (
        <ListRenderer section={section} onChange={onChange} />
      )}

      {section.type === 'list' && (
        <FormatListBlock content={section.content} onChange={onChange} />
      )}

      {section.type === 'table' && (
        <TableBlock content={section.content} onChange={onChange} />
      )}

      {section.type === 'code' && (
        <CodeBlock content={section.content} onChange={onChange} />
      )}

      {section.type === 'image' && (
        <ImageBlock content={section.content} onChange={onChange} />
      )}
    </div>
  )
}

function ListRenderer({ section, onChange }: { section: SectionData, onChange: (c: string) => void }) {
  const isDynamic = section.type === 'checklist'
  let items: Array<{id: string, text: string, checked: boolean}> = []
  try { items = JSON.parse(section.content || '[]') } catch {}

  const updateItems = (newItems: typeof items) => {
    if (isDynamic) {
       const unchecked = newItems.filter(i => !i.checked)
       const checked = newItems.filter(i => i.checked)
       newItems = [...unchecked, ...checked]
    }
    onChange(JSON.stringify(newItems))
  }

  const handleToggle = (id: string) => {
    const updated = items.map(i => i.id === id ? { ...i, checked: !i.checked } : i)
    updateItems(updated)
  }

  const handleTextChange = (id: string, newText: string) => {
    const updated = items.map(i => i.id === id ? { ...i, text: newText } : i)
    // Avoid resorting just because they are typing
    onChange(JSON.stringify(updated))
  }

  const handleAdd = () => {
    const newItem = { id: Date.now().toString(), text: '', checked: false }
    if (isDynamic) {
        const unchecked = items.filter(i => !i.checked)
        const checked = items.filter(i => i.checked)
        onChange(JSON.stringify([...unchecked, newItem, ...checked]))
    } else {
        onChange(JSON.stringify([...items, newItem]))
    }
  }

  const handleRemove = (id: string) => {
    const newItems = items.filter(i => i.id !== id)
    updateItems(newItems)
  }

  return (
    <div className="w-full border-l-2 pl-3 transition-colors" style={{ borderColor: 'var(--accent-tint)' }}>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="group flex items-start gap-3">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => handleToggle(item.id)}
              className={`mt-1.5 h-4 w-4 cursor-pointer border-[#1B1326]/25 transition-all ${isDynamic ? 'rounded-full text-emerald-500 focus:ring-emerald-500' : 'rounded text-[#EC4899] focus:ring-[#EC4899]'}`}
            />
            <div className={`flex-1 ${item.checked ? 'line-through opacity-50' : ''} transition-all duration-300`}>
              <RichTextEditor
                content={item.text}
                onChange={(html) => handleTextChange(item.id, html)}
                onEnter={handleAdd}
                placeholder="List item..."
                className="leading-relaxed text-[#1B1326]"
              />
            </div>
            <button
              onClick={() => handleRemove(item.id)}
              className="p-1 text-[#1B1326]/25 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 print:hidden"
            >
              <Plus className="h-4 w-4 rotate-45" />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={handleAdd}
        className="mt-3 flex items-center gap-1 pl-7 text-xs font-semibold text-[#6E5F7B] transition-colors hover:text-[#1B1326] print:hidden"
      >
        <Plus className="h-3 w-3" />
        Add Item
      </button>
      {items.length > 0 && (
        <div className="mt-2 pl-7 text-[11px] font-medium tracking-wide text-[#1B1326]/35">
          {items.filter(i => i.checked).length}/{items.length} completed
        </div>
      )}
    </div>
  )
}
