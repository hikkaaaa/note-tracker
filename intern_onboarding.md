# Note Tracker: Junior Dev Onboarding Guide

Welcome to the **Note Tracker** project! 👋 

This is a full-stack web application designed for creating folders, notes, and a mix of dynamic content sections (like text blocks, calendars, checklists, and tables) within those notes. 

Here is a high-level overview of how the app works, what files are responsible for what, and how the different pieces communicate with each other so you can start contributing right away!

---

## 🏗 High-Level Architecture

The project is split into two independent parts that talk to each other via a REST API:
1. **Frontend (`/frontend`)**: A React application built with TypeScript and Vite. It runs locally on port `5173`.
2. **Backend (`/backend`)**: A Python API built with FastAPI and SQLite. It runs locally on port `8000`.

---

## 🗄 The Backend (`/backend/app`)

The backend is a straightforward FastAPI application that exposes API endpoints and manages a local SQLite database (`note_tracker.db`). 

### Core Database Models
We use **SQLAlchemy** to turn Python objects into database tables. The relationships (`models.py`) are strictly hierarchical:
- 📁 **Folder**: The top-level container. Has a `name`, `purpose`, and `color`. Contains multiple Notes.
- 📄 **Note**: Lives inside a Folder. Has a `title` and `purpose`. Contains multiple Sections.
- 🧱 **Section**: A specific block of content inside a note (its `type` dictates if it's a calendar block, a checklist, a text block, etc.). Contains the raw `content` payload.

### Backend Data Flow
When a user interacts with the app, the request flows through these main files in `/backend/app`:

- **`main.py`**: The entry point/router. It defines all the API endpoints (e.g., `GET /folders/`, `POST /notes/`). It connects incoming requests to the database operations. It also configures CORS so the frontend development server can fetch data without security errors.
- **`schemas.py`**: Pydantic models. These define the "shape" of the JSON data entering (Requests) and leaving (Responses) the API, ensuring type safety and automatic validation.
- **`database.py`**: Sets up the SQLite connection and provides a session manager dependency for the endpoints.

---

## 🖥 The Frontend (`/frontend/src`)

The frontend is a React Single Page Application (SPA) utilizing `react-router-dom` for navigation between pages. 

### Core Navigation (`App.tsx`)
This file is the main router. It links different URLs to the corresponding top-level Page components:
- `/` 👉 `<HomePage />`
- `/folders/:folderId` 👉 `<FolderDetailPage />`
- `/notes/:noteId` 👉 `<NoteEditorPage />`

### 1. Pages (`/pages`)
Think of these as the "managers" or "containers" for specific routes. They handle making network requests to the backend API and passing that data down to standard UI components.
- **`HomePage.tsx`**: Fetches and lists all Folders in the system.
- **`FolderDetailPage.tsx`**: Fetches a specific Folder by its ID and lists all Notes inside it.
- **`NoteEditorPage.tsx`**: The core workspace! Requests the details of a specific Note and manages its layout, rendering all its dynamic `Section` blocks on the screen.

### 2. Components (`/components`)
These are reusable, "dumb" UI puzzle pieces that accept data as props:
- **Modals**: Used for creating new files or confirming delete actions.
  - Examples: `CreateFolderModal.tsx`, `CreateNoteModal.tsx`, `ConfirmationModal.tsx`.
- **Note Content Blocks** (Found inside `/components/blocks` or the root of `/components`):
  - These are the individual "blocks" of content that make up a note section.
  - Examples: `RichTextEditor.tsx`, `TableBlock.tsx`, `FormatListBlock.tsx`.
- **`Header.tsx`**: The top-level navigation bar for the app.

---

## 🔌 How Everything Connects (An Example)

Here is a step-by-step trace of what happens when a user creates a new Folder:

1. **User Action**: You click the "Create Folder" button in the `<HomePage />` frontend component.
2. **Frontend UI**: The `<CreateFolderModal />` pops open. You type "Meeting Notes", pick a color, and click Submit.
3. **API Request**: The frontend makes an HTTP `POST` request to `http://localhost:8000/folders/` sending your inputs as a JSON payload.
4. **Backend Processing**: `main.py` receives the request at the `@app.post("/folders/")` function. It validates the JSON payload against the shape defined in `schemas.py`.
5. **Database Operation**: A new `Folder` object (from `models.py`) is instantiated, added to the database session, and committed/saved to the SQLite database.
6. **Response**: FastAPI returns the newly created folder data (now including its Database ID) back to the frontend, which patches its local React state to update the UI on the screen.

## 🚀 Where to begin?
- If you're fixing a **UI view bug** or adding a **new UI component block** for notes, start poking around `frontend/src/components`.
- If you're adding a **new feature** to an entity (like adding a "creation date" to a Note), you'll need to update it end-to-end:
  1. `backend/app/models.py` (add column to database database)
  2. `backend/app/schemas.py` (expose the field for API validation)
  3. The relevant frontend React component in `frontend/src/components` or `frontend/src/pages` to display the new data.
