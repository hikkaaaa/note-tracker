from pydantic import BaseModel, ConfigDict
from typing import List, Optional

# --- SECTIONS ---
class SectionCreate(BaseModel):
    type: str
    content: str

class SectionResponse(BaseModel):
    id: int
    note_id: int
    type: str
    content: str

    model_config = ConfigDict(from_attributes=True)

class SectionUpdate(BaseModel):
    content: str

# --- NOTES ---
class NoteCreate(BaseModel):
    title: str
    purpose: Optional[str] = None

class NoteResponse(BaseModel):
    id: int
    title: str
    purpose: Optional[str] = None
    folder_id: int
    sections: List[SectionResponse] = []

    model_config = ConfigDict(from_attributes=True)

# --- FOLDERS ---
class FolderCreate(BaseModel):
    name: str
    purpose: Optional[str] = None
    color: Optional[str] = "blue"

class FolderResponse(BaseModel):
    id: int
    name: str
    purpose: Optional[str] = None
    color: Optional[str] = "blue"
    notes: List[NoteResponse] = []

    model_config = ConfigDict(from_attributes=True)