"""
admin_routes.py
Admin dashboard endpoints: platform-wide stats, user management,
interview/MCQ oversight. All endpoints require is_admin=True.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
import models
from auth import get_current_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
def admin_stats(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    total_users = db.query(models.User).count()
    total_interviews = db.query(models.Interview).count()
    total_quizzes = db.query(models.QuizAttempt).count()

    completed_interviews = db.query(models.Interview).filter(models.Interview.status == "completed").all()
    avg_interview_score = (
        round(sum(i.overall_score or 0 for i in completed_interviews) / len(completed_interviews), 1)
        if completed_interviews else 0
    )

    quiz_attempts = db.query(models.QuizAttempt).all()
    avg_quiz_score = (
        round(sum(q.score_percent or 0 for q in quiz_attempts) / len(quiz_attempts), 1)
        if quiz_attempts else 0
    )

    return {
        "total_users": total_users,
        "total_interviews": total_interviews,
        "total_quizzes": total_quizzes,
        "avg_interview_score": avg_interview_score,
        "avg_quiz_score": avg_quiz_score,
        "total_mcq_questions": db.query(models.MCQQuestion).count(),
    }


@router.get("/users")
def list_users(
    search: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    query = db.query(models.User)
    if search:
        like = f"%{search}%"
        query = query.filter(or_(models.User.full_name.like(like), models.User.email.like(like)))

    total = query.count()
    users = query.order_by(models.User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "users": [
            {
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "is_admin": u.is_admin,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
    }


@router.put("/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_active = not user.is_active
    db.commit()
    return {"message": f"User is now {'active' if user.is_active else 'inactive'}.", "is_active": user.is_active}


@router.put("/users/{user_id}/toggle-admin")
def toggle_user_admin(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_admin = not user.is_admin
    db.commit()
    return {"message": "Admin status updated.", "is_admin": user.is_admin}


@router.get("/interviews")
def list_all_interviews(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    query = db.query(models.Interview)
    total = query.count()
    interviews = query.order_by(models.Interview.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "interviews": [
            {
                "id": i.id,
                "user_id": i.user_id,
                "job_role": i.job_role,
                "interview_type": i.interview_type,
                "difficulty": i.difficulty,
                "status": i.status,
                "overall_score": i.overall_score,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in interviews
        ],
    }


@router.get("/mcq-questions")
def list_mcq_questions(
    category: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    query = db.query(models.MCQQuestion)
    if category:
        query = query.filter(models.MCQQuestion.category == category)
    total = query.count()
    questions = query.order_by(models.MCQQuestion.id.asc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "questions": [
            {
                "id": q.id,
                "category": q.category,
                "difficulty": q.difficulty,
                "question": q.question,
                "correct_answer": q.correct_answer,
            }
            for q in questions
        ],
    }
