"""
schemas.py
Pydantic models used for request validation and response serialization.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any


# ---------- AUTH ----------
class SignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    confirm_password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=100)


# ---------- PROFILE / SETTINGS ----------
class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    education: Optional[str] = None
    skills: Optional[str] = None
    target_role: Optional[str] = None


class SettingsUpdateRequest(BaseModel):
    default_interview_type: Optional[str] = None
    default_difficulty: Optional[str] = None
    theme: Optional[str] = None


# ---------- INTERVIEW ----------
class StartInterviewRequest(BaseModel):
    interview_type: str
    job_role: str
    difficulty: str = "Medium"
    num_questions: int = 5
    resume_id: Optional[int] = None


class InterviewQuestionOut(BaseModel):
    id: int
    question_number: int
    question_text: str


class StartInterviewResponse(BaseModel):
    interview_id: int
    total_questions: int
    questions: List[InterviewQuestionOut]


class SubmitAnswerRequest(BaseModel):
    question_id: int
    answer_text: str


class AnswerEvaluationResponse(BaseModel):
    score: float
    relevance: float
    technical_knowledge: float
    accuracy: float
    communication: float
    clarity: float
    confidence: float
    strengths: List[str]
    weaknesses: List[str]
    suggestions: List[str]
    improved_answer: str


# ---------- QUIZ ----------
class StartQuizRequest(BaseModel):
    category: str
    difficulty: str = "Medium"
    num_questions: int = 10


class QuizAnswerSubmit(BaseModel):
    question_id: int
    selected_answer: Optional[str] = None  # A/B/C/D or None if skipped


class SubmitQuizRequest(BaseModel):
    category: str
    difficulty: str = "Medium"
    answers: List[QuizAnswerSubmit]
    time_taken_seconds: int = 0
