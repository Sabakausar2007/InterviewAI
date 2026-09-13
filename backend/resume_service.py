"""
resume_service.py
Handles resume file validation, storage, and text extraction (PDF/DOCX).
"""

import os
import uuid
from fastapi import UploadFile, HTTPException
from dotenv import load_dotenv

load_dotenv()

# Uploads are stored at the project root's uploads/resumes/ folder (created by
# setup.bat), one level up from this backend/ directory.
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "resumes")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_FILE_SIZE_MB = float(os.getenv("MAX_RESUME_SIZE_MB", "5"))


def validate_resume_file(file: UploadFile, content: bytes):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are allowed.")
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"File is too large. Maximum size is {MAX_FILE_SIZE_MB}MB.")
    return ext


def save_resume_file(content: bytes, ext: str) -> str:
    """Saves the file with a random name to prevent path traversal / collisions."""
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(content)
    return path


def extract_text_from_pdf(path: str) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(path)
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
        return text.strip()
    except Exception as e:
        print(f"[RESUME_SERVICE] PDF extraction failed: {e}")
        return ""


def extract_text_from_docx(path: str) -> str:
    try:
        import docx
        document = docx.Document(path)
        text = "\n".join(p.text for p in document.paragraphs)
        return text.strip()
    except Exception as e:
        print(f"[RESUME_SERVICE] DOCX extraction failed: {e}")
        return ""


def extract_resume_text(path: str, ext: str) -> str:
    if ext == ".pdf":
        return extract_text_from_pdf(path)
    elif ext == ".docx":
        return extract_text_from_docx(path)
    return ""
