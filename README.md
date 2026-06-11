setting up the backend (on another terminal): 
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

setting up the front: 
root folder: 
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install 
install tailwind: 
npm install -D tailwindcss @tailwindcss/vite
Import the Tailwind plugin and add it to the plugins array. Your file should look exactly like this vite.config.ts file in your frontend folder.:
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})


running the back: 
cd backend
source venv/bin/activate          # Windows: venv\Scripts\activate  (skip if already active)
uvicorn app.main:app --reload
localhost: http://localhost:8000
backend endpoints check: http://localhost:8000/docs

auth / env vars (backend):
The JWT signing secret is read from the AUTH_SECRET_KEY env var. A dev fallback is
baked in so local dev works with no setup, but set a real secret in any deployed env:
  export AUTH_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
Run that in the same shell before `uvicorn`, or add it to your shell profile / .env.

running the front: 
cd frontend
npm run dev
localhost: http://localhost:5173
frontend check: http://localhost:5173 -> browser's Developer Tools (F12) -> "Network" tab -> ensure your frontend is successfully sending data to http://localhost:8000

frontend env vars (optional):
The backend URL defaults to http://localhost:8000. To point the frontend elsewhere,
copy frontend/.env.example to frontend/.env and set VITE_API_BASE.


note-tracker/
├── frontend/                 # React + TypeScript (Vite)
│   ├── src/
│   │   ├── components/       # Reusable UI (FolderList, NoteCard, BlockWrapper)
│   │   │   ├── blocks/       # The specific sections inside a note
│   │   │   │   ├── CalendarBlock.tsx
│   │   │   │   ├── TextBlock.tsx
│   │   │   │   └── ChecklistBlock.tsx
│   │   ├── pages/            # Main views (Dashboard, NoteEditor)
│   │   ├── api/              # Axios or Fetch logic to talk to the backend
│   │   ├── types/            # TypeScript interfaces (Folder, Note, Block)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── backend/                  # Python + FastAPI
    ├── app/
    │   ├── main.py           # Core FastAPI application and endpoints
    │   ├── models.py         # SQLAlchemy database models (tables)
    │   ├── schemas.py        # Pydantic models (data validation for endpoints)
    │   └── database.py       # SQLite connection setup
    ├── requirements.txt      # Pinned Python deps (fastapi, uvicorn, sqlalchemy, pydantic, bcrypt, PyJWT, email-validator)
    ├── venv/                 # Local virtualenv — run everything from here (gitignored)
    └── note_tracker.db       # Your SQLite DB file (auto-generates later)

frontend/api: 
Use fetch or a library like axios in your frontend api/ folder to make HTTP requests to your Python backend endpoints.


Step 1: Set up the Backend (Python/FastAPI)

Navigate to the backend folder and create a virtual environment: python -m venv venv

Activate it (source venv/bin/activate) and install dependencies: pip install -r requirements.txt

In database.py, set up your SQLite connection engine.

In models.py, define your database tables:

Folder (id, name)

Note (id, title, folder_id)

Section (id, note_id, type [calendar, text, checklist], content [JSON or text])

In main.py, set up your API routes (endpoints) to Create, Read, Update, and Delete these items. Crucial: Add CORS middleware in main.py to allow your React frontend to communicate with your FastAPI backend.

Step 2: Set up the Frontend (React/TS)

Navigate to the root folder and run: npm create vite@latest frontend -- --template react-ts

Navigate into frontend, run npm install, and then install Tailwind CSS for styling.

Define your TypeScript types so your frontend knows exactly what a Folder or Note looks like.

Build the UI components. For the note sections, create a generic <BlockWrapper> component that applies a border and padding (the "squares"), and render the specific block (Calendar, Text, Checklist) inside it based on the section's type from the database.