from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    purpose = Column(String, nullable=True)
    color = Column(String, default="blue")

    # Links folder to its notes
    notes = relationship("Note", back_populates="folder", cascade="all, delete-orphan")

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    purpose = Column(String, nullable=True)
    folder_id = Column(Integer, ForeignKey("folders.id"))

    folder = relationship("Folder", back_populates="notes")
    sections = relationship("Section", back_populates="note", cascade="all, delete-orphan")

class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"))
    type = Column(String) # 'calendar', 'text', or 'checklist'
    content = Column(String) # Storing content as a text/JSON string for now

    note = relationship("Note", back_populates="sections")