"""
interview_routes.py
AI Mock Interview: start interview, generate questions, submit/evaluate
answers, finish interview and produce final results, plus history.
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
import ai_service
from auth import get_current_user

router = APIRouter(prefix="/api/interview", tags=["interview"])


@router.post("/start", response_model=schemas.StartInterviewResponse)
def start_interview(
    data: schemas.StartInterviewRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if data.num_questions not in (5, 10, 15):
        raise HTTPException(status_code=400, detail="num_questions must be 5, 10 or 15.")

    resume_context = None
    if data.resume_id:
        resume = db.query(models.Resume).filter(
            models.Resume.id == data.resume_id, models.Resume.user_id == current_user.id
        ).first()
        if resume:
            resume_context = (
                f"Skills: {resume.skills}\nExperience: {resume.experience}\n"
                f"Projects: {resume.projects}\nTechnologies: {resume.technologies}"
            )

    try:
        questions_text = ai_service.generate_interview_questions(
            interview_type=data.interview_type,
            job_role=data.job_role,
            difficulty=data.difficulty,
            num_questions=data.num_questions,
            resume_context=resume_context,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI question generation failed and fallback also failed: {e}")

    interview = models.Interview(
        user_id=current_user.id,
        interview_type=data.interview_type,
        job_role=data.job_role,
        difficulty=data.difficulty,
        total_questions=len(questions_text),
        status="in_progress",
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)

    question_objs: List[models.InterviewQuestion] = []
    for i, q_text in enumerate(questions_text, start=1):
        q = models.InterviewQuestion(interview_id=interview.id, question_number=i, question_text=q_text)
        db.add(q)
        question_objs.append(q)
    db.commit()
    for q in question_objs:
        db.refresh(q)

    return {
        "interview_id": interview.id,
        "total_questions": len(question_objs),
        "questions": [{"id": q.id, "question_number": q.question_number, "question_text": q.question_text} for q in question_objs],
    }


@router.post("/answer", response_model=schemas.AnswerEvaluationResponse)
def submit_answer(
    data: schemas.SubmitAnswerRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    question = db.query(models.InterviewQuestion).filter(models.InterviewQuestion.id == data.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")

    interview = db.query(models.Interview).filter(models.Interview.id == question.interview_id).first()
    if not interview or interview.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to answer this question.")

    evaluation = ai_service.evaluate_answer(
        question=question.question_text,
        answer=data.answer_text,
        job_role=interview.job_role,
        difficulty=interview.difficulty,
    )

    existing_answer = db.query(models.Answer).filter(models.Answer.question_id == question.id).first()
    if existing_answer:
        answer_row = existing_answer
    else:
        answer_row = models.Answer(question_id=question.id)
        db.add(answer_row)

    answer_row.answer_text = data.answer_text
    answer_row.score = evaluation["score"]
    answer_row.relevance = evaluation["relevance"]
    answer_row.technical_knowledge = evaluation["technical_knowledge"]
    answer_row.accuracy = evaluation["accuracy"]
    answer_row.communication = evaluation["communication"]
    answer_row.clarity = evaluation["clarity"]
    answer_row.confidence = evaluation["confidence"]
    answer_row.strengths = "|".join(evaluation["strengths"])
    answer_row.weaknesses = "|".join(evaluation["weaknesses"])
    answer_row.suggestions = "|".join(evaluation["suggestions"])
    answer_row.improved_answer = evaluation["improved_answer"]
    db.commit()

    return evaluation


@router.post("/{interview_id}/finish")
def finish_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    interview = db.query(models.Interview).filter(models.Interview.id == interview_id).first()
    if not interview or interview.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Interview not found.")

    questions = db.query(models.InterviewQuestion).filter(models.InterviewQuestion.interview_id == interview.id).all()
    answers = [q.answer for q in questions if q.answer is not None]

    if not answers:
        raise HTTPException(status_code=400, detail="No answers submitted for this interview yet.")

    def avg(attr):
        vals = [getattr(a, attr) for a in answers]
        return round(sum(vals) / len(vals), 1) if vals else 0

    interview.overall_score = avg("score")
    interview.technical_score = avg("technical_knowledge")
    interview.communication_score = avg("communication")
    interview.relevance_score = avg("relevance")
    interview.clarity_score = avg("clarity")

    summary = [
        {"question": q.question_text, "score": q.answer.score if q.answer else 0}
        for q in questions
    ]
    feedback = ai_service.generate_feedback(
        {
            "overall_score": interview.overall_score,
            "technical_score": interview.technical_score,
            "communication_score": interview.communication_score,
            "clarity_score": interview.clarity_score,
        },
        summary,
    )
    interview.strengths = "|".join(feedback["strong_areas"])
    interview.weaknesses = "|".join(feedback["areas_to_improve"])
    interview.recommendations = "|".join(feedback["recommendations"])
    interview.status = "completed"
    interview.completed_at = datetime.utcnow()
    db.commit()

    _update_performance(db, current_user.id)

    return {"message": "Interview completed.", "interview_id": interview.id}


@router.get("/{interview_id}/result")
def get_interview_result(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    interview = db.query(models.Interview).filter(models.Interview.id == interview_id).first()
    if not interview or interview.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Interview not found.")

    questions = db.query(models.InterviewQuestion).filter(models.InterviewQuestion.interview_id == interview.id).order_by(models.InterviewQuestion.question_number).all()

    review = []
    for q in questions:
        a = q.answer
        review.append({
            "question": q.question_text,
            "answer": a.answer_text if a else "",
            "score": a.score if a else 0,
            "strengths": (a.strengths.split("|") if a and a.strengths else []),
            "weaknesses": (a.weaknesses.split("|") if a and a.weaknesses else []),
            "suggestions": (a.suggestions.split("|") if a and a.suggestions else []),
            "improved_answer": a.improved_answer if a else "",
        })

    return {
        "id": interview.id,
        "interview_type": interview.interview_type,
        "job_role": interview.job_role,
        "difficulty": interview.difficulty,
        "status": interview.status,
        "overall_score": interview.overall_score,
        "technical_score": interview.technical_score,
        "communication_score": interview.communication_score,
        "relevance_score": interview.relevance_score,
        "clarity_score": interview.clarity_score,
        "strong_areas": (interview.strengths.split("|") if interview.strengths else []),
        "areas_to_improve": (interview.weaknesses.split("|") if interview.weaknesses else []),
        "recommendations": (interview.recommendations.split("|") if interview.recommendations else []),
        "created_at": interview.created_at.isoformat() if interview.created_at else None,
        "question_review": review,
    }


@router.get("/history")
def get_interview_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    interviews = (
        db.query(models.Interview)
        .filter(models.Interview.user_id == current_user.id)
        .order_by(models.Interview.created_at.desc())
        .all()
    )
    return [
        {
            "id": i.id,
            "date": i.created_at.isoformat() if i.created_at else None,
            "interview_type": i.interview_type,
            "job_role": i.job_role,
            "difficulty": i.difficulty,
            "score": i.overall_score,
            "status": i.status,
        }
        for i in interviews
    ]


def _update_performance(db: Session, user_id: int):
    """Recalculates the performance summary row for a user."""
    interviews = db.query(models.Interview).filter(
        models.Interview.user_id == user_id, models.Interview.status == "completed"
    ).all()
    quizzes = db.query(models.QuizAttempt).filter(models.QuizAttempt.user_id == user_id).all()

    perf = db.query(models.Performance).filter(models.Performance.user_id == user_id).first()
    if not perf:
        perf = models.Performance(user_id=user_id)
        db.add(perf)

    perf.total_interviews = len(interviews)
    perf.total_quizzes = len(quizzes)
    perf.avg_interview_score = round(sum(i.overall_score for i in interviews) / len(interviews), 1) if interviews else 0
    perf.avg_quiz_score = round(sum(q.score_percent for q in quizzes) / len(quizzes), 1) if quizzes else 0

    # Strongest / weakest quiz category by average score
    if quizzes:
        by_cat = {}
        for q in quizzes:
            by_cat.setdefault(q.category, []).append(q.score_percent)
        averages = {cat: sum(v) / len(v) for cat, v in by_cat.items()}
        perf.strongest_topic = max(averages, key=averages.get)
        perf.weakest_topic = min(averages, key=averages.get)

    db.commit()
