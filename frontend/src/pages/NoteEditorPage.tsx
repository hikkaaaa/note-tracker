import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, useBlocker } from 'react-router-dom'
import { Plus, Type, CheckSquare, ListTodo, ChevronLeft, ChevronRight, Save, Loader2, Trash2, List as ListIcon, Table as TableIcon, LayoutDashboard, LayoutList, GripVertical, MoreVertical, Copy, ClipboardPaste, Download, Code2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useReactToPrint } from 'react-to-print'
import { DndContext, DragOverlay, useDraggable, useDroppable, pointerWithin } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import { RichTextEditor } from '../components/RichTextEditor'
import { FormatListBlock } from '../components/FormatListBlock'
import { TableBlock } from '../components/TableBlock'
import { CodeBlock } from '../components/CodeBlock'

interface SectionData {
  id: number
  type: 'text' | 'checklist' | 'tickbox' | 'list' | 'table' | 'code'
  content: string
}

interface NoteData {
  id: number
  title: string
  purpose?: string
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [layoutMode, setLayoutMode] = useState<'vertical' | 'horizontal'>('vertical')
  const [activeDragItem, setActiveDragItem] = useState<any>(null)
  const [copiedBlock, setCopiedBlock] = useState<{type: string, content: string} | null>(null)
  const [deletedStack, setDeletedStack] = useState<Array<{ type: string, content: string, rowIndex: number, colIndex: number }>>([])

  const contentRef = useRef<HTMLDivElement>(null);

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
    try {
      const noteRes = await fetch(`http://localhost:8000/notes/${noteId}`)
      if (noteRes.ok) setNote(await noteRes.json())
      
      const sectionsRes = await fetch(`http://localhost:8000/notes/${noteId}/sections/`)
      if (sectionsRes.ok) {
        const data = await sectionsRes.json()
        const layoutSec = data.find((s: any) => s.type === 'layout');
        const regularSecs = data.filter((s: any) => s.type !== 'layout');
        setSections(regularSecs)
        
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
      }
    } catch {
      // ignore
    } finally {
       setIsLoading(false)
    }
  }, [noteId])

  useEffect(() => {
    fetchNoteAndSections()
  }, [fetchNoteAndSections])

  const addSectionAt = async (type: any, targetId: number | null, position: 'top'|'bottom'|'left'|'right', customContent?: string) => {
    if (!noteId) return
    let defaultContent = ''
    if (customContent !== undefined) {
      defaultContent = customContent
    } else if (type === 'checklist' || type === 'tickbox') defaultContent = JSON.stringify([{ id: Date.now().toString(), text: '', checked: false }])
    else if (type === 'list') defaultContent = JSON.stringify({ style: '1.', items: [{ id: Date.now().toString(), text: '' }] })
    else if (type === 'table') defaultContent = `<table style="width:100%"><tbody><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr></tbody></table>`
    else if (type === 'code') defaultContent = JSON.stringify({ language: '', code: '' })

    try {
      const res = await fetch(`http://localhost:8000/notes/${noteId}/sections/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, content: defaultContent }) })
      if (res.ok) {
        const newSection = await res.json()
        setSections(prev => [...prev, newSection])
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
    } catch { console.error('Failed to add section') }
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
    setSections(prev => prev.map(s => s.id === id ? { ...s, content } : s))
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
      await fetch(`http://localhost:8000/sections/${id}`, { method: 'DELETE' })
      setSections(prev => prev.filter(s => s.id !== id))
      setLayoutRows(prev => prev.map(row => row.filter(rid => rid !== id)).filter(row => row.length > 0))
      if (target && rowIndex !== -1) {
        setDeletedStack(prev => [...prev, { type: target.type, content: target.content, rowIndex, colIndex }])
      }
      setIsDirty(true)
    } catch {
      console.error('Failed to delete section')
    }
  }

  const undoDelete = useCallback(async () => {
    if (!noteId || deletedStack.length === 0) return
    const last = deletedStack[deletedStack.length - 1]
    try {
      const res = await fetch(`http://localhost:8000/notes/${noteId}/sections/`, {
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
    try {
      await Promise.all(
        sections.map(s => 
          fetch(`http://localhost:8000/sections/${s.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: s.content })
          })
        )
      )
      
      const missingLayoutInState = !sections.find(s => s.id === layoutSectionId);
      if (layoutSectionId && !missingLayoutInState) {
          await fetch(`http://localhost:8000/sections/${layoutSectionId}`, {
             method: 'PUT', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ content: JSON.stringify(layoutRows) })
          })
      } else {
          const res = await fetch(`http://localhost:8000/notes/${noteId}/sections/`, {
             method: 'POST', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ type: 'layout', content: JSON.stringify(layoutRows) })
          })
          if (res.ok) {
             const data = await res.json();
             setLayoutSectionId(data.id);
          }
      }
    } catch {
      alert('Failed to save some sections.')
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
    <div className="h-screen overflow-hidden bg-[#f0f4f8] flex flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-800 leading-tight">
              {note ? note.title : 'Loading...'}
            </h1>
            {note?.purpose && (
              <p className="text-xs text-slate-400 opacity-80">{note.purpose}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-6 print:hidden">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setLayoutMode('vertical')}
              className={`p-2 rounded-lg transition-all ${layoutMode === 'vertical' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}
              title="Vertical Layout"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayoutMode('horizontal')}
              className={`p-2 rounded-lg transition-all ${layoutMode === 'horizontal' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}
              title="Horizontal Layout"
            >
              <LayoutDashboard className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleExportPDF()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <button
              onClick={saveWorkspace}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-xl hover:bg-blue-600 active:bg-blue-700 disabled:opacity-60 transition-colors duration-150 shadow-sm shadow-blue-200"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Saving...' : 'Save Workspace'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <DroppableCanvas 
          contentRef={contentRef}
          layoutMode={layoutMode} 
          layoutRows={layoutRows}
          sections={sections} 
          isLoading={isLoading}
          activeDragItem={activeDragItem}
          updateSectionContentLocal={updateSectionContentLocal}
          deleteSection={deleteSection}
          copiedBlock={copiedBlock}
          setCopiedBlock={setCopiedBlock}
          addSectionAt={addSectionAt}
        />

        <div className={`relative flex-shrink-0 transition-[width] duration-300 ease-in-out print:hidden ${isSidebarOpen ? 'w-64' : 'w-0'}`}>

          <aside className={`absolute top-0 right-0 w-64 h-full bg-white border-l border-slate-200 shadow-lg p-5 z-20 flex flex-col gap-3 transition-transform duration-300 ease-in-out overflow-y-auto scrollbar-slim ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className={`flex flex-col gap-3 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Drag to Add</h3>
              <DraggableSidebarItem type="text" title="Text Block" icon={Type} colorClass="text-blue-500" onClick={() => addSection('text')} />
              <DraggableSidebarItem type="checklist" title="Checklist" subtitle="Checks move to bottom" icon={ListTodo} colorClass="text-emerald-500" onClick={() => addSection('checklist')} />
              <DraggableSidebarItem type="tickbox" title="Tickboxes" subtitle="Static order" icon={CheckSquare} colorClass="text-purple-500" onClick={() => addSection('tickbox')} />
              <DraggableSidebarItem type="list" title="List" subtitle="Custom styles" icon={ListIcon} colorClass="text-orange-500" onClick={() => addSection('list')} />
              <DraggableSidebarItem type="table" title="Table" subtitle="Resizable grid" icon={TableIcon} colorClass="text-indigo-500" onClick={() => addSection('table')} />
              <DraggableSidebarItem type="code" title="Code Block" subtitle="Syntax highlighted" icon={Code2} colorClass="text-zinc-600" onClick={() => addSection('code')} />
            </div>
          </aside>
        </div>
      </div>

      <UnsavedChangesModal 
        isOpen={blocker.state === 'blocked'}
        onSaveAndLeave={handleSaveAndLeave}
        onLeave={handleLeaveWithoutSaving}
        onCancel={handleCancelLeave}
      />
      <DragOverlay>
        {activeDragItem ? (
          <div className="flex items-center gap-3 w-64 px-4 py-3 text-left bg-white border border-blue-300 shadow-2xl rounded-xl opacity-90 scale-105 cursor-grabbing mix-blend-multiply">
            {activeDragItem.data.current?.icon && <activeDragItem.data.current.icon className={`w-4 h-4 ${activeDragItem.data.current.colorClass}`} />}
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-800">{activeDragItem.data.current?.title}</span>
              {activeDragItem.data.current?.subtitle && <span className="text-[10px] text-slate-500 font-normal">{activeDragItem.data.current.subtitle}</span>}
            </div>
          </div>
        ) : null}
      </DragOverlay>

      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-white border border-slate-200 rounded-full shadow-lg flex items-center justify-center z-50 hover:bg-slate-50 transition-all duration-300 text-slate-500 hover:text-slate-800 print:hidden"
        title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
      >
        {isSidebarOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>
    </div>
    </DndContext>
  )
}

function DroppableCanvas({ contentRef, layoutMode, layoutRows, sections, isLoading, activeDragItem, updateSectionContentLocal, deleteSection, copiedBlock, setCopiedBlock, addSectionAt }: any) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-droppable' })
  return (
    <main className="flex-1 overflow-y-auto p-8 relative transition-colors duration-300 print:p-0">
      <motion.div ref={contentRef} id="pdf-content-area" layout className={`mx-auto bg-white shadow-xl rounded-sm border border-slate-200 p-10 pb-32 transition-all print:shadow-none print:border-none print:bg-transparent print:p-0 print:m-0 ${layoutMode === 'horizontal' ? 'max-w-6xl min-h-[595px]' : 'max-w-4xl min-h-[842px]'}`}>
        {isLoading ? (
           <div className="flex justify-center pt-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : sections.length === 0 ? (
          <div ref={setNodeRef} className={`h-full flex flex-col items-center justify-center text-slate-400 space-y-4 pt-20 pb-20 transition-all ${isOver ? 'scale-105 text-blue-500 bg-blue-50/50 rounded-xl' : ''}`}>
            <p className="text-lg">{isOver ? 'Drop here to create your first block' : 'This note is empty.'}</p>
            <p className="text-sm">{isOver ? '' : 'Drag a block from the toolbar to start writing.'}</p>
          </div>
        ) : (
          <motion.div layout className="flex flex-col space-y-6 h-full min-h-[500px]">
            <AnimatePresence>
              {layoutRows.map((rowArr: number[]) => (
                <motion.div layout key={`row-${rowArr.join()}`} className="flex flex-row w-full gap-4 items-start">
                   {rowArr.map(id => {
                       const section = sections.find((s: any) => s.id === id);
                       if (!section) return null;
                       return (
                           <motion.div
                             layout
                             initial={{ opacity: 0, y: 20 }}
                             animate={{ opacity: 1, y: 0 }}
                             exit={{ opacity: 0, scale: 0.95 }}
                             transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                             key={section.id}
                             className="flex-[1_1_0%] min-w-0 h-full"
                           >
                             <BlockWrapper
                               section={section}
                               activeDragItem={activeDragItem}
                               onCopy={() => setCopiedBlock({ type: section.type, content: section.content })}
                               onPaste={() => {
                                 if (copiedBlock) addSectionAt(copiedBlock.type, section.id, 'bottom', copiedBlock.content)
                               }}
                               canPaste={!!copiedBlock}
                               onChange={(content: string) => updateSectionContentLocal(section.id, content)}
                               onDelete={() => deleteSection(section.id)}
                               onAddTextBelow={() => addSectionAt('text', section.id, 'bottom')}
                             />
                           </motion.div>
                       )
                   })}
                </motion.div>
              ))}
            </AnimatePresence>
            {/* The general canvas dropzone is now a large spacer at the bottom to catch appended blocks */}
            <div ref={setNodeRef} className={`w-full flex-1 min-h-[150px] transition-all rounded-xl flex items-center justify-center mt-6 ${isOver ? 'bg-blue-50/50 border-2 border-dashed border-blue-400 text-blue-500' : 'border-2 border-transparent'}`}>
                {isOver && activeDragItem && (
                   <div className="flex items-center gap-2">
                     <Plus className="w-6 h-6 animate-bounce" />
                     <span className="font-medium">Drop {activeDragItem.data.current?.title} at the bottom</span>
                   </div>
                )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </main>
  )
}

function DraggableSidebarItem({ type, title, subtitle, icon: Icon, colorClass, onClick }: any) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `draggable-${type}`,
    data: { type, title, icon: Icon, colorClass, subtitle },
  })

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all duration-300 text-sm font-medium text-slate-700 hover:shadow-md hover:-translate-y-0.5 ${isDragging ? 'opacity-30 scale-95' : 'opacity-100'}`}
    >
      <Icon className={`w-4 h-4 ${colorClass}`} />
      <div className="flex flex-col">
        <span>{title}</span>
        {subtitle && <span className="text-[10px] text-slate-400 font-normal">{subtitle}</span>}
      </div>
    </button>
  )
}

function UnsavedChangesModal({ isOpen, onSaveAndLeave, onLeave, onCancel }: { isOpen: boolean, onSaveAndLeave: () => void, onLeave: () => void, onCancel: () => void }) {
  if (!isOpen) return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity" style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(3px)' }}>
      <div role="dialog" className="w-full max-w-sm bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 p-6 animate-modal-in">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Unsaved Changes</h3>
        <p className="text-sm text-slate-500 mb-6">Do you want to save the work? Your recent changes have not been saved.</p>
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 w-full">
          <button onClick={onCancel} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={onLeave} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">Leave without saving</button>
          <button onClick={onSaveAndLeave} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-xl hover:bg-blue-600 active:bg-blue-700 shadow-sm shadow-blue-200 transition-colors">Save & Leave</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function BlockWrapper({ section, onChange, onDelete, activeDragItem, onCopy, onPaste, canPaste, onAddTextBelow }: any) {
    const { setNodeRef: setDragRef, attributes, listeners, isDragging } = useDraggable({
        id: `existing-${section.id}`,
        data: { type: section.type, id: section.id, isExisting: true, title: 'Block', icon: GripVertical, colorClass: 'text-slate-500' }
    });

    const topDrop = useDroppable({ id: `drop-top-${section.id}` });
    const bottomDrop = useDroppable({ id: `drop-bottom-${section.id}` });
    const leftDrop = useDroppable({ id: `drop-left-${section.id}` });
    const rightDrop = useDroppable({ id: `drop-right-${section.id}` });

    return (
        <div className={`relative flex flex-col group/wrapper w-full h-full ${isDragging ? 'opacity-30 scale-95' : ''} transition-all duration-300`}>
             
            {/* Edge Drop Zones */}
            {activeDragItem && !isDragging && (
               <>
                 {/* Top */}
                 <div ref={topDrop.setNodeRef} className="absolute -top-4 left-0 right-0 h-8 pointer-events-auto z-30 flex items-center justify-center print:hidden">
                    <div className={`w-full h-2 outline outline-blue-200 rounded-full bg-blue-500 transition-all duration-200 ${topDrop.isOver ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} />
                 </div>
                 {/* Bottom */}
                 <div ref={bottomDrop.setNodeRef} className="absolute -bottom-4 left-0 right-0 h-8 pointer-events-auto z-30 flex items-center justify-center print:hidden">
                    <div className={`w-full h-2 outline outline-blue-200 rounded-full bg-blue-500 transition-all duration-200 ${bottomDrop.isOver ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} />
                 </div>
                 {/* Left */}
                 <div ref={leftDrop.setNodeRef} className="absolute top-0 bottom-0 -left-4 w-8 pointer-events-auto z-30 flex items-center justify-center print:hidden">
                    <div className={`h-full w-2 outline outline-blue-200 rounded-full bg-blue-500 transition-all duration-200 ${leftDrop.isOver ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} />
                 </div>
                 {/* Right */}
                 <div ref={rightDrop.setNodeRef} className="absolute top-0 bottom-0 -right-4 w-8 pointer-events-auto z-30 flex items-center justify-center print:hidden">
                    <div className={`h-full w-2 outline outline-blue-200 rounded-full bg-blue-500 transition-all duration-200 ${rightDrop.isOver ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} />
                 </div>
               </>
            )}

            {/* Drag Handle */}
            <div 
               ref={setDragRef} 
               {...attributes} 
               {...listeners} 
               className="absolute -left-6 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing opacity-0 group-hover/wrapper:opacity-100 z-10 transition-opacity print:hidden"
            >
               <GripVertical className="w-4 h-4" />
            </div>

            <BlockRenderer section={section} onChange={onChange} onDelete={onDelete} onCopy={onCopy} onPaste={onPaste} canPaste={canPaste} onAddTextBelow={onAddTextBelow} />
        </div>
    )
}

function BlockRenderer({ section, onChange, onDelete, onCopy, onPaste, canPaste, onAddTextBelow }: { section: SectionData, onChange: (c: string) => void, onDelete: () => void, onCopy: () => void, onPaste: () => void, canPaste: boolean, onAddTextBelow?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    <div className="group/block relative w-full h-full border border-slate-200 bg-slate-50/50 rounded-xl p-4 pr-14 hover:border-slate-300 hover:shadow-md transition-all duration-300 print:border-none print:shadow-none print:bg-transparent print:p-0 print:pr-0 print:border-transparent">
      <div className="absolute top-2 right-2 z-10 print:hidden" ref={menuRef}>
        <button 
          onClick={() => setMenuOpen(!menuOpen)}
          className={`p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all ${menuOpen ? 'opacity-100 bg-slate-200/50' : 'opacity-0 group-hover/block:opacity-100'}`}
          title="Block options"
        >
          <MoreVertical className="w-5 h-5" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden py-1 z-50">
            <button 
              onClick={() => { onCopy(); setMenuOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
            <button 
              onClick={() => { onPaste(); setMenuOpen(false); }}
              disabled={!canPaste}
              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${canPaste ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-400 opacity-50 cursor-not-allowed'}`}
            >
              <ClipboardPaste className="w-4 h-4" /> Paste
            </button>
            <button 
              onClick={() => { onDelete(); setMenuOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        )}
      </div>
      
      {section.type === 'text' && (
        <RichTextEditor
          content={section.content}
          onChange={onChange}
          placeholder="Start typing..."
          className="text-slate-800 leading-relaxed min-h-[4rem]"
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
    <div className="w-full pl-3 border-l-2 border-slate-200 transition-colors">
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-3 group">
            <input 
              type="checkbox" 
              checked={item.checked} 
              onChange={() => handleToggle(item.id)} 
              className={`mt-1.5 w-4 h-4 border-slate-300 transition-all cursor-pointer ${isDynamic ? 'rounded-full text-emerald-500 focus:ring-emerald-500' : 'rounded text-purple-500 focus:ring-purple-500'}`}
            />
            <div className={`flex-1 ${item.checked ? 'opacity-50 line-through' : ''} transition-all duration-300`}>
              <RichTextEditor
                content={item.text}
                onChange={(html) => handleTextChange(item.id, html)}
                onEnter={handleAdd}
                placeholder="List item..."
                className="text-slate-800 leading-relaxed"
              />
            </div>
            <button 
              onClick={() => handleRemove(item.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-400 transition-opacity print:hidden"
            >
              <Plus className="w-4 h-4 rotate-45" />
            </button>
          </div>
        ))}
      </div>
      <button 
        onClick={handleAdd}
        className="mt-3 text-xs font-semibold text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors pl-7 print:hidden"
      >
        <Plus className="w-3 h-3" />
        Add Item
      </button>
    </div>
  )
}
