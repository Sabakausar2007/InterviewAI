"""
performance_routes.py
Aggregated performance analytics: score trends, strongest/weakest topics,
totals used by the Dashboard and Performance pages.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/api/performance", tags=["performance"])


@router.get("/summary")
def performance_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    perf = db.query(models.Performance).filter(models.Performance.user_id == current_user.id).first()
    if not perf:
        return {
            "total_interviews": 0,
            "total_quizzes": 0,
            "avg_interview_score": 0,
            "avg_quiz_score": 0,
            "strongest_topic": None,
            "weakest_topic": None,
        }
    return {
        "total_interviews": perf.total_interviews,
        "total_quizzes": perf.total_quizzes,
        "avg_interview_score": perf.avg_interview_score,
        "avg_quiz_score": perf.avg_quiz_score,
        "strongest_topic": perf.strongest_topic,
        "weakest_topic": perf.weakest_topic,
    }


@router.get("/trends")
def performance_trends(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Returns chronological score series for charting."""
    interviews = (
        db.query(models.Interview)
        .filter(models.Interview.user_id == current_user.id, models.Interview.status == "completed")
        .order_by(models.Interview.completed_at.asc())
        .all()
    )
    quizzes = (
        db.query(models.QuizAttempt)
        .filter(models.QuizAttempt.user_id == current_user.id)
        .order_by(models.QuizAttempt.created_at.asc())
        .all()
    )

    interview_trend = [
        {
            "date": i.completed_at.isoformat() if i.completed_at else i.created_at.isoformat(),
            "score": i.overall_score,
            "job_role": i.job_role,
        }
        for i in interviews
    ]
    quiz_trend = [
        {
            "date": q.created_at.isoformat() if q.created_at else None,
            "score": q.score_percent,
            "category": q.category,
        }
        for q in quizzes
    ]

    technical_scores = [i.technical_score for i in interviews if i.technical_score is not None]
    communication_scores = [i.communication_score for i in interviews if i.communication_score is not None]

    avg_technical = round(sum(technical_scores) / len(technical_scores), 1) if technical_scores else 0
    avg_communication = round(sum(communication_scores) / len(communication_scores), 1) if communication_scores else 0

    # Strongest / weakest MCQ topics by average score
    by_cat = {}
    for q in quizzes:
        by_cat.setdefault(q.category, []).append(q.score_percent)
    topic_averages = {cat: round(sum(v) / len(v), 1) for cat, v in by_cat.items()}
    sorted_topics = sorted(topic_averages.items(), key=lambda x: x[1], reverse=True)

    return {
        "interview_trend": interview_trend,
        "quiz_trend": quiz_trend,
        "avg_technical_performance": avg_technical,
        "avg_communication_performance": avg_communication,
        "topic_averages": topic_averages,
        "strongest_topics": [t[0] for t in sorted_topics[:3]],
        "weakest_topics": [t[0] for t in sorted_topics[-3:]] if sorted_topics else [],
    }
