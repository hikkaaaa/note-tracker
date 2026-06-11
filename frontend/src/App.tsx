import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { Dashboard } from './pages/Dashboard'
import { FolderDetailPage } from './pages/FolderDetailPage'
import { NoteEditorPage } from './pages/NoteEditorPage'

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/folders/:folderId', element: <FolderDetailPage /> },
  { path: '/notes/:noteId', element: <NoteEditorPage /> },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
