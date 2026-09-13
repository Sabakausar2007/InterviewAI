-- InterviewAI Database Schema
CREATE DATABASE IF NOT EXISTS interview_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE interview_ai;

-- ===================== USERS =====================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    education VARCHAR(255) DEFAULT NULL,
    skills TEXT DEFAULT NULL,
    target_role VARCHAR(150) DEFAULT NULL,
    default_interview_type VARCHAR(50) DEFAULT 'Technical',
    default_difficulty VARCHAR(20) DEFAULT 'Medium',
    theme VARCHAR(10) DEFAULT 'light',
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ===================== RESUMES =====================
CREATE TABLE IF NOT EXISTS resumes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    extracted_text LONGTEXT,
    skills TEXT,
    education TEXT,
    experience TEXT,
    projects TEXT,
    technologies TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ===================== INTERVIEWS =====================
CREATE TABLE IF NOT EXISTS interviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    interview_type VARCHAR(50) NOT NULL,
    job_role VARCHAR(150) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    total_questions INT NOT NULL,
    status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed
    overall_score FLOAT DEFAULT NULL,
    technical_score FLOAT DEFAULT NULL,
    communication_score FLOAT DEFAULT NULL,
    relevance_score FLOAT DEFAULT NULL,
    clarity_score FLOAT DEFAULT NULL,
    strengths TEXT,
    weaknesses TEXT,
    recommendations TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ===================== INTERVIEW QUESTIONS =====================
CREATE TABLE IF NOT EXISTS interview_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    interview_id INT NOT NULL,
    question_number INT NOT NULL,
    question_text TEXT NOT NULL,
    FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ===================== ANSWERS =====================
CREATE TABLE IF NOT EXISTS answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    answer_text TEXT,
    score FLOAT DEFAULT NULL,
    relevance FLOAT DEFAULT NULL,
    technical_knowledge FLOAT DEFAULT NULL,
    accuracy FLOAT DEFAULT NULL,
    communication FLOAT DEFAULT NULL,
    clarity FLOAT DEFAULT NULL,
    confidence FLOAT DEFAULT NULL,
    strengths TEXT,
    weaknesses TEXT,
    suggestions TEXT,
    improved_answer TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES interview_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ===================== MCQ QUESTIONS =====================
CREATE TABLE IF NOT EXISTS mcq_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    question TEXT NOT NULL,
    option_a VARCHAR(500) NOT NULL,
    option_b VARCHAR(500) NOT NULL,
    option_c VARCHAR(500) NOT NULL,
    option_d VARCHAR(500) NOT NULL,
    correct_answer CHAR(1) NOT NULL, -- A, B, C, D
    explanation TEXT
) ENGINE=InnoDB;

-- ===================== QUIZ ATTEMPTS =====================
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category VARCHAR(50) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    total_questions INT NOT NULL,
    correct_answers INT DEFAULT 0,
    wrong_answers INT DEFAULT 0,
    score_percent FLOAT DEFAULT 0,
    time_taken_seconds INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ===================== QUIZ ANSWERS =====================
CREATE TABLE IF NOT EXISTS quiz_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT NOT NULL,
    question_id INT NOT NULL,
    selected_answer CHAR(1),
    is_correct BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES mcq_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ===================== PERFORMANCE (aggregated snapshot, optional cache) =====================
CREATE TABLE IF NOT EXISTS performance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_interviews INT DEFAULT 0,
    total_quizzes INT DEFAULT 0,
    avg_interview_score FLOAT DEFAULT 0,
    avg_quiz_score FLOAT DEFAULT 0,
    strongest_topic VARCHAR(100),
    weakest_topic VARCHAR(100),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ===================== ADMIN USERS (flag based, but table kept for spec compliance) =====================
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
