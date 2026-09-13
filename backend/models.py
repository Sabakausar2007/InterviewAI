"""
models.py
SQLAlchemy ORM models — one class per database table.
Column names here MUST match database/schema.sql exactly.
"""
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, TIMESTAMP, ForeignKey, CHAR
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    education = Column(String(255), nullable=True)
    skills = Column(Text, nullable=True)
    target_role = Column(String(150), nullable=True)
    default_interview_type = Column(String(50), default="Technical")
    default_difficulty = Column(String(20), default="Medium")
    theme = Column(String(10), default="light")
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="user", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")


class Resume(Base):
    __tablename__ = "resumes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    extracted_text = Column(Text, nullable=True)
    skills = Column(Text, nullable=True)
    education = Column(Text, nullable=True)
    experience = Column(Text, nullable=True)
    projects = Column(Text, nullable=True)
    technologies = Column(Text, nullable=True)
    uploaded_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="resumes")


class Interview(Base):
    __tablename__ = "interviews"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    interview_type = Column(String(50), nullable=False)
    job_role = Column(String(150), nullable=False)
    difficulty = Column(String(20), nullable=False)
    total_questions = Column(Integer, nullable=False)
    status = Column(String(20), default="in_progress")
    overall_score = Column(Float, nullable=True)
    technical_score = Column(Float, nullable=True)
    communication_score = Column(Float, nullable=True)
    relevance_score = Column(Float, nullable=True)
    clarity_score = Column(Float, nullable=True)
    strengths = Column(Text, nullable=True)
    weaknesses = Column(Text, nullable=True)
    recommendations = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    completed_at = Column(TIMESTAMP, nullable=True)

    user = relationship("User", back_populates="interviews")
    questions = relationship("InterviewQuestion", back_populates="interview", cascade="all, delete-orphan")


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"
    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False)
    question_number = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)

    interview = relationship("Interview", back_populates="questions")
    answer = relationship("Answer", back_populates="question", uselist=False, cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("interview_questions.id", ondelete="CASCADE"), nullable=False)
    answer_text = Column(Text, nullable=True)
    score = Column(Float, nullable=True)
    relevance = Column(Float, nullable=True)
    technical_knowledge = Column(Float, nullable=True)
    accuracy = Column(Float, nullable=True)
    communication = Column(Float, nullable=True)
    clarity = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    strengths = Column(Text, nullable=True)
    weaknesses = Column(Text, nullable=True)
    suggestions = Column(Text, nullable=True)
    improved_answer = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    question = relationship("InterviewQuestion", back_populates="answer")


class MCQQuestion(Base):
    __tablename__ = "mcq_questions"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), nullable=False)
    difficulty = Column(String(20), nullable=False)
    question = Column(Text, nullable=False)
    option_a = Column(String(500), nullable=False)
    option_b = Column(String(500), nullable=False)
    option_c = Column(String(500), nullable=False)
    option_d = Column(String(500), nullable=False)
    correct_answer = Column(CHAR(1), nullable=False)
    explanation = Column(Text, nullable=True)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(50), nullable=False)
    difficulty = Column(String(20), nullable=False)
    total_questions = Column(Integer, nullable=False)
    correct_answers = Column(Integer, default=0)
    wrong_answers = Column(Integer, default=0)
    score_percent = Column(Float, default=0)
    time_taken_seconds = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="quiz_attempts")
    quiz_answers = relationship("QuizAnswer", back_populates="attempt", cascade="all, delete-orphan")


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(Integer, ForeignKey("mcq_questions.id", ondelete="CASCADE"), nullable=False)
    selected_answer = Column(CHAR(1), nullable=True)
    is_correct = Column(Boolean, default=False)

    attempt = relationship("QuizAttempt", back_populates="quiz_answers")


class Performance(Base):
    __tablename__ = "performance"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    total_interviews = Column(Integer, default=0)
    total_quizzes = Column(Integer, default=0)
    avg_interview_score = Column(Float, default=0)
    avg_quiz_score = Column(Float, default=0)
    strongest_topic = Column(String(100), nullable=True)
    weakest_topic = Column(String(100), nullable=True)
    updated_at = Column(TIMESTAMP, server_default=func.now())


class AdminUser(Base):
    """Kept for schema compliance with the spec. Admin status is actually
    driven by users.is_admin; this table just records who was promoted."""
    __tablename__ = "admin_users"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
