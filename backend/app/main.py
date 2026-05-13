from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from . import models, schemas
from .database import engine, SessionLocal

# This creates the tables in SQLite when the app starts
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Note Tracker API")

# CRUCIAL: Set up CORS to allow Vite frontend to talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Vite's default port
    allow_credentials=True,
    allow_methods=["*"], # Allows GET, POST, PUT, DELETE
    allow_headers=["*"],
)

# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- ROUTES ---

@app.post("/folders/", response_model=schemas.FolderResponse)
def create_folder(folder: schemas.FolderCreate, db: Session = Depends(get_db)):
    db_folder = models.Folder(name=folder.name, purpose=folder.purpose, color=folder.color)
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

@app.get("/folders/", response_model=List[schemas.FolderResponse])
def get_folders(db: Session = Depends(get_db)):
    return db.query(models.Folder).all()

@app.post("/folders/{folder_id}/notes/", response_model=schemas.NoteResponse)
def create_note(folder_id: int, note: schemas.NoteCreate, db: Session = Depends(get_db)):
    db_note = models.Note(title=note.title, purpose=note.purpose, folder_id=folder_id)
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

@app.post("/notes/{note_id}/sections/", response_model=schemas.SectionResponse)
def create_section(note_id: int, section: schemas.SectionCreate, db: Session = Depends(get_db)):
    db_section = models.Section(note_id=note_id, type=section.type, content=section.content)
    db.add(db_section)
    db.commit()
    db.refresh(db_section)
    return db_section

@app.put("/sections/{section_id}", response_model=schemas.SectionResponse)
def update_section(section_id: int, section_update: schemas.SectionUpdate, db: Session = Depends(get_db)):
    db_section = db.query(models.Section).filter(models.Section.id == section_id).first()
    if db_section:
        db_section.content = section_update.content
        db.commit()
        db.refresh(db_section)
    return db_section

@app.delete("/sections/{section_id}")
def delete_section(section_id: int, db: Session = Depends(get_db)):
    db_section = db.query(models.Section).filter(models.Section.id == section_id).first()
    if db_section:
        db.delete(db_section)
        db.commit()
    return {"ok": True}

@app.delete("/folders/{folder_id}")
def delete_folder(folder_id: int, db: Session = Depends(get_db)):
    db_folder = db.query(models.Folder).filter(models.Folder.id == folder_id).first()
    if db_folder:
        db.delete(db_folder)
        db.commit()
    return {"ok": True}

@app.delete("/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    db_note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if db_note:
        db.delete(db_note)
        db.commit()
    return {"ok": True}

@app.get("/notes/{note_id}", response_model=schemas.NoteResponse)
def get_note(note_id: int, db: Session = Depends(get_db)):
    return db.query(models.Note).filter(models.Note.id == note_id).first()

# Get all sections across the entire app (great for checking your DB)
@app.get("/sections/", response_model=List[schemas.SectionResponse])
def get_all_sections(db: Session = Depends(get_db)):
    return db.query(models.Section).all()

# Get only the sections that belong to a specific note
@app.get("/notes/{note_id}/sections/", response_model=List[schemas.SectionResponse])
def get_sections_for_note(note_id: int, db: Session = Depends(get_db)):
    return db.query(models.Section).filter(models.Section.note_id == note_id).all()
