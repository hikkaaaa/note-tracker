import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { FolderDetailPage } from './pages/FolderDetailPage'
import { NoteEditorPage } from './pages/NoteEditorPage'

const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/folders/:folderId', element: <FolderDetailPage /> },
  { path: '/notes/:noteId', element: <NoteEditorPage /> },
])

function App() {
  return <RouterProvider router={router} />
}

export default App