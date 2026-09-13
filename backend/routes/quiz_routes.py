"""
quiz_routes.py
MCQ practice: category listing, starting a randomized quiz, submitting
answers, automatic scoring, and quiz history.
"""

import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(prefix="/api/quiz", tags=["quiz"])

CATEGORIES = [
    "Python", "Java", "C/C++", "Data Structures", "Algorithms", "HTML",
    "CSS", "JavaScript", "Web Development", "SQL", "Database", "Cybersecurity",
    "Computer Networks", "Operating Systems",
]


@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    counts = {}
    for cat in CATEGORIES:
        counts[cat] = db.query(models.MCQQuestion).filter(models.MCQQuestion.category == cat).count()
    return [{"name": c, "question_count": counts[c]} for c in CATEGORIES]


@router.post("/start")
def start_quiz(
    data: schemas.StartQuizRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if data.num_questions not in (10, 20, 30):
        raise HTTPException(status_code=400, detail="num_questions must be 10, 20 or 30.")

    query = db.query(models.MCQQuestion).filter(
        models.MCQQuestion.category == data.category,
        models.MCQQuestion.difficulty == data.difficulty,
    )
    available = query.all()

    if not available:
        # fall back to any difficulty within the category so the quiz still works
        available = db.query(models.MCQQuestion).filter(models.MCQQuestion.category == data.category).all()

    if not available:
        raise HTTPException(status_code=404, detail="No questions available for this category yet.")

    random.shuffle(available)
    selected = available[: min(data.num_questions, len(available))]

    return {
        "category": data.category,
        "difficulty": data.difficulty,
        "total_questions": len(selected),
        "questions": [
            {
                "id": q.id,
                "question": q.question,
                "option_a": q.option_a,
                "option_b": q.option_b,
                "option_c": q.option_c,
                "option_d": q.option_d,
            }
            for q in selected
        ],
    }


@router.post("/submit")
def submit_quiz(
    data: schemas.SubmitQuizRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not data.answers:
        raise HTTPException(status_code=400, detail="No answers submitted.")

    question_ids = [a.question_id for a in data.answers]
    questions = {q.id: q for q in db.query(models.MCQQuestion).filter(models.MCQQuestion.id.in_(question_ids)).all()}

    correct_count = 0
    review = []
    attempt = models.QuizAttempt(
        user_id=current_user.id,
        category=data.category,
        difficulty=data.difficulty,
        total_questions=len(data.answers),
        time_taken_seconds=data.time_taken_seconds,
    )
    db.add(attempt)
    db.flush()  # get attempt.id without full commit

    for a in data.answers:
        q = questions.get(a.question_id)
        if not q:
            continue
        selected = (a.selected_answer or "").upper().strip() or None
        is_correct = selected == q.correct_answer
        if is_correct:
            correct_count += 1

        db.add(models.QuizAnswer(
            attempt_id=attempt.id,
            question_id=q.id,
            selected_answer=selected,
            is_correct=is_correct,
        ))
        review.append({
            "question": q.question,
            "options": {"A": q.option_a, "B": q.option_b, "C": q.option_c, "D": q.option_d},
            "correct_answer": q.correct_answer,
            "your_answer": selected,
            "is_correct": is_correct,
            "explanation": q.explanation,
        })

    total = len(data.answers)
    wrong = total - correct_count
    percent = round((correct_count / total) * 100, 1) if total else 0

    attempt.correct_answers = correct_count
    attempt.wrong_answers = wrong
    attempt.score_percent = percent
    db.commit()

    # Update the shared performance summary
    from routes.interview_routes import _update_performance
    _update_performance(db, current_user.id)

    if percent >= 80:
        performance_label = "Excellent"
    elif percent >= 50:
        performance_label = "Good"
    else:
        performance_label = "Needs Improvement"

    return {
        "attempt_id": attempt.id,
        "total_questions": total,
        "correct_answers": correct_count,
        "wrong_answers": wrong,
        "score_percent": percent,
        "performance_label": performance_label,
        "time_taken_seconds": data.time_taken_seconds,
        "review": review,
    }


@router.get("/history")
def quiz_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    attempts = (
        db.query(models.QuizAttempt)
        .filter(models.QuizAttempt.user_id == current_user.id)
        .order_by(models.QuizAttempt.created_at.desc())
        .all()
    )
    return [
        {
            "id": a.id,
            "category": a.category,
            "difficulty": a.difficulty,
            "total_questions": a.total_questions,
            "correct_answers": a.correct_answers,
            "score_percent": a.score_percent,
            "date": a.created_at.isoformat() if a.created_at else None,
        }
        for a in attempts
    ]
