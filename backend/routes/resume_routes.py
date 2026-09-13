"""
resume_routes.py
Resume upload, storage, text extraction, AI analysis, and generating
personalized interview questions based on the resume.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from database import get_db
import models
import ai_service
import resume_service
from auth import get_current_user

router = APIRouter(prefix="/api/resume", tags=["resume"])


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    ext = resume_service.validate_resume_file(file, content)
    saved_path = resume_service.save_resume_file(content, ext)
    extracted_text = resume_service.extract_resume_text(saved_path, ext)

    if not extracted_text:
        extracted_text = ""

    analysis = ai_service.analyze_resume(extracted_text) if extracted_text else {
        "skills": "Could not extract text from this file.",
        "education": "Could not extract text from this file.",
        "projects": "Could not extract text from this file.",
        "experience": "Could not extract text from this file.",
        "technologies": "Could not extract text from this file.",
    }

    resume = models.Resume(
        user_id=current_user.id,
        file_name=file.filename,
        file_path=saved_path,
        extracted_text=extracted_text,
        skills=analysis.get("skills"),
        education=analysis.get("education"),
        experience=analysis.get("experience"),
        projects=analysis.get("projects"),
        technologies=analysis.get("technologies"),
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    return {
        "id": resume.id,
        "file_name": resume.file_name,
        "skills": resume.skills,
        "education": resume.education,
        "experience": resume.experience,
        "projects": resume.projects,
        "technologies": resume.technologies,
        "uploaded_at": resume.uploaded_at.isoformat() if resume.uploaded_at else None,
    }


@router.get("/list")
def list_resumes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    resumes = (
        db.query(models.Resume)
        .filter(models.Resume.user_id == current_user.id)
        .order_by(models.Resume.uploaded_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "file_name": r.file_name,
            "skills": r.skills,
            "education": r.education,
            "experience": r.experience,
            "projects": r.projects,
            "technologies": r.technologies,
            "uploaded_at": r.uploaded_at.isoformat() if r.uploaded_at else None,
        }
        for r in resumes
    ]


@router.get("/{resume_id}/questions")
def resume_based_questions(
    resume_id: int,
    num_questions: int = 5,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    resume = db.query(models.Resume).filter(
        models.Resume.id == resume_id, models.Resume.user_id == current_user.id
    ).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")

    analysis = {
        "skills": resume.skills,
        "education": resume.education,
        "experience": resume.experience,
        "projects": resume.projects,
        "technologies": resume.technologies,
    }
    questions = ai_service.generate_resume_questions(analysis, num_questions=num_questions)
    return {"resume_id": resume.id, "questions": questions}


@router.delete("/{resume_id}")
def delete_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    resume = db.query(models.Resume).filter(
        models.Resume.id == resume_id, models.Resume.user_id == current_user.id
    ).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")
    db.delete(resume)
    db.commit()
    return {"message": "Resume deleted."}
