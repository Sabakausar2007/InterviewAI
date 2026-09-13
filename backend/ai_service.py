"""
ai_service.py

Isolated AI integration layer. Every AI-powered feature in the app goes
through the functions in this file, so the AI provider can be swapped out
later without touching any route code.

If AI_API_KEY is not set in .env, all functions fall back to
predefined/rule-based logic (FALLBACK MODE) so the whole app keeps working.
"""
import os
import json
import re
import requests
from dotenv import load_dotenv

load_dotenv()

AI_API_KEY = os.getenv("AI_API_KEY", "").strip()
AI_MODEL = os.getenv("AI_MODEL", "claude-sonnet-4-6")
AI_API_URL = "https://api.anthropic.com/v1/messages"

FALLBACK_MODE = len(AI_API_KEY) == 0


# =========================================================
# Low level call to the AI API. Returns text or None on failure.
# =========================================================
def _call_ai(system_prompt: str, user_prompt: str, max_tokens: int = 1200):
    if FALLBACK_MODE:
        return None
    try:
        headers = {
            "x-api-key": AI_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": AI_MODEL,
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        }
        resp = requests.post(AI_API_URL, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        text_parts = [b["text"] for b in data.get("content", []) if b.get("type") == "text"]
        return "\n".join(text_parts).strip()
    except Exception as e:
        print(f"[ai_service] AI API call failed, using fallback. Reason: {e}")
        return None


def _extract_json(text: str):
    """Best-effort extraction of a JSON object/array from model output."""
    if not text:
        return None
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"(\[.*\]|\{.*\})", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except Exception:
                return None
    return None


# =========================================================
# FALLBACK QUESTION BANK (used when AI is not configured)
# =========================================================
_FALLBACK_QUESTIONS = {
    "HR": [
        "Tell me about yourself.",
        "What are your greatest strengths and weaknesses?",
        "Why do you want to work for this company?",
        "Where do you see yourself in five years?",
        "Describe a challenge you faced at work and how you handled it.",
        "Why should we hire you?",
        "What motivates you to do your best work?",
        "How do you handle stress and pressure?",
    ],
    "Behavioral": [
        "Tell me about a time you disagreed with a teammate. How did you resolve it?",
        "Describe a situation where you had to meet a tight deadline.",
        "Tell me about a time you failed and what you learned from it.",
        "Give an example of when you showed leadership.",
        "Describe how you handled receiving critical feedback.",
        "Tell me about a time you had to learn something new quickly.",
    ],
    "Technical": [
        "Explain the difference between a list and a tuple in Python.",
        "What is the difference between SQL and NoSQL databases?",
        "Explain how a hash table works.",
        "What is the time complexity of binary search and why?",
        "Explain the concept of object-oriented programming with an example.",
        "What is the difference between synchronous and asynchronous programming?",
        "Explain how REST APIs work.",
        "What is normalization in databases?",
    ],
    "Coding": [
        "How would you reverse a linked list? Explain your approach.",
        "How would you find duplicate elements in an array efficiently?",
        "Explain how you would design a rate limiter.",
        "How would you check if a string is a palindrome?",
        "Explain the approach to detect a cycle in a linked list.",
    ],
    "Resume Based": [
        "Walk me through a project mentioned on your resume.",
        "What technologies did you use in your most recent project and why?",
        "Describe a technical challenge you faced in one of your listed projects.",
        "How did you apply the skills listed on your resume in a real scenario?",
    ],
}


def generate_interview_questions(interview_type: str, job_role: str, difficulty: str,
                                  num_questions: int, resume_context: str = None,
                                  previous_weak_areas: str = None):
    """Returns a list[str] of interview questions."""
    if not FALLBACK_MODE:
        system_prompt = (
            "You are an expert technical interviewer. Generate interview questions as a "
            "JSON array of plain strings only, with no extra commentary."
        )
        user_prompt = (
            f"Generate exactly {num_questions} {difficulty} difficulty {interview_type} "
            f"interview questions for a {job_role} role. "
        )
        if resume_context:
            user_prompt += f"Base some questions on this candidate resume summary: {resume_context}. "
        if previous_weak_areas:
            user_prompt += f"Focus extra attention on these weak areas from past performance: {previous_weak_areas}. "
        user_prompt += "Respond with ONLY a JSON array of question strings."

        result = _call_ai(system_prompt, user_prompt)
        parsed = _extract_json(result) if result else None
        if isinstance(parsed, list) and len(parsed) > 0:
            return [str(q) for q in parsed[:num_questions]]

    # ---- Fallback ----
    pool = list(_FALLBACK_QUESTIONS.get(interview_type, _FALLBACK_QUESTIONS["Technical"]))
    if len(pool) < num_questions:
        pool = pool * ((num_questions // max(len(pool), 1)) + 1)
    return pool[:num_questions]


def evaluate_answer(question: str, answer: str, job_role: str, difficulty: str = "Medium"):
    """
    Returns a dict:
    { score, relevance, technical_knowledge, accuracy, communication, clarity, confidence,
      strengths[], weaknesses[], suggestions[], improved_answer }
    All numeric sub-scores are 0-100.
    """
    if not FALLBACK_MODE:
        system_prompt = (
            "You are an expert interview evaluator. Score the candidate's answer fairly on "
            "relevance, technical knowledge, accuracy, communication, clarity and confidence "
            "(each 0-100), plus an overall score (0-100). "
            "Respond with ONLY valid JSON in this exact shape: "
            '{"score": 0, "relevance": 0, "technical_knowledge": 0, "accuracy": 0, '
            '"communication": 0, "clarity": 0, "confidence": 0, '
            '"strengths": ["..."], "weaknesses": ["..."], "suggestions": ["..."], "improved_answer": "..."}'
        )
        user_prompt = (
            f"Job role: {job_role}\nDifficulty: {difficulty}\n"
            f"Question: {question}\nCandidate answer: {answer}\n\n"
            "Evaluate this answer and respond with only the JSON object described."
        )
        result = _call_ai(system_prompt, user_prompt)
        parsed = _extract_json(result) if result else None
        if isinstance(parsed, dict) and "score" in parsed:
            for key in ["score", "relevance", "technical_knowledge", "accuracy",
                        "communication", "clarity", "confidence"]:
                parsed[key] = max(0, min(100, float(parsed.get(key, parsed.get("score", 0)))))
            parsed.setdefault("strengths", [])
            parsed.setdefault("weaknesses", [])
            parsed.setdefault("suggestions", [])
            parsed.setdefault("improved_answer", "")
            return parsed

    # ---- Rule-based fallback ----
    return _rule_based_evaluation(question, answer)


def _rule_based_evaluation(question: str, answer: str):
    answer = (answer or "").strip()
    word_count = len(answer.split())

    if word_count == 0:
        zero = {k: 0 for k in ["score", "relevance", "technical_knowledge", "accuracy",
                                "communication", "clarity", "confidence"]}
        zero.update({
            "strengths": [],
            "weaknesses": ["No answer was provided."],
            "suggestions": ["Attempt to answer every question, even partially."],
            "improved_answer": "Try to structure your answer with a clear explanation and an example.",
        })
        return zero

    score = 40
    strengths, weaknesses, suggestions = [], [], []

    if word_count >= 15:
        score += 15
        strengths.append("Answer has good detail and length.")
    else:
        weaknesses.append("Answer is quite short.")
        suggestions.append("Expand your answer with more explanation and examples.")

    if any(k in answer.lower() for k in ["example", "for instance", "such as"]):
        score += 15
        strengths.append("Includes a concrete example.")
    else:
        suggestions.append("Add a real-world example to strengthen your answer.")

    question_words = set(w.lower().strip(".,?") for w in question.split())
    answer_words = set(w.lower().strip(".,?") for w in answer.split())
    if question_words & answer_words:
        score += 10
        strengths.append("Answer appears relevant to the question.")

    if word_count > 5:
        score += 10
        strengths.append("Communicates the idea clearly.")

    score = max(10, min(90, score))  # rule-based scoring is capped below AI-level confidence

    if not strengths:
        strengths.append("Attempted a relevant response.")
    if not weaknesses:
        weaknesses.append("Could add more technical depth.")

    # Rule-based mode can't truly separate the six dimensions, so we derive
    # small variations around the overall score to keep the UI meaningful.
    def near(base, delta):
        return max(0, min(100, base + delta))

    return {
        "score": score,
        "relevance": near(score, 5),
        "technical_knowledge": near(score, -5),
        "accuracy": near(score, 0),
        "communication": near(score, 5),
        "clarity": near(score, -5),
        "confidence": near(score, 0),
        "strengths": strengths,
        "weaknesses": weaknesses,
        "suggestions": suggestions or ["Practice structuring answers using a clear beginning, middle and end."],
        "improved_answer": (
            f"{answer} In addition, you could mention a specific example or metric to "
            "make the answer more convincing to an interviewer."
        ),
    }


def generate_feedback(score_summary: dict, question_summary: list = None):
    """
    score_summary: {overall_score, technical_score, communication_score, clarity_score, ...}
    question_summary: optional list of {question, score} dicts for extra AI context.
    Returns dict: {strong_areas[], areas_to_improve[], recommendations[]}
    """
    if not FALLBACK_MODE:
        system_prompt = (
            "You are an interview coach. Summarize the candidate's overall interview "
            "performance. Respond with ONLY valid JSON: "
            '{"strong_areas": ["..."], "areas_to_improve": ["..."], "recommendations": ["..."]}'
        )
        user_prompt = f"Score summary: {json.dumps(score_summary)}\nPer-question results: {json.dumps(question_summary or [])}"
        result = _call_ai(system_prompt, user_prompt)
        parsed = _extract_json(result) if result else None
        if isinstance(parsed, dict):
            parsed.setdefault("strong_areas", [])
            parsed.setdefault("areas_to_improve", [])
            parsed.setdefault("recommendations", [])
            return parsed

    overall = score_summary.get("overall_score", 0) or 0
    strong_areas, areas_to_improve, recommendations = [], [], []
    if overall >= 75:
        strong_areas.append("Strong overall performance across most questions.")
    elif overall >= 50:
        strong_areas.append("Solid foundation with room to grow.")
    else:
        areas_to_improve.append("Overall performance needs significant improvement.")

    if (score_summary.get("technical_score", 0) or 0) < 60:
        areas_to_improve.append("Technical depth could be improved.")
        recommendations.append("Review core concepts for your target role and practice explaining them out loud.")
    if (score_summary.get("communication_score", 0) or 0) < 60:
        areas_to_improve.append("Communication clarity could be improved.")
        recommendations.append("Practice structuring answers using the STAR method.")
    if not recommendations:
        recommendations.append("Keep practicing regularly to maintain consistency under pressure.")
    if not strong_areas:
        strong_areas.append("Willingness to attempt every question.")

    return {"strong_areas": strong_areas, "areas_to_improve": areas_to_improve, "recommendations": recommendations}


def analyze_resume(resume_text: str):
    """Returns dict: {skills, education, projects, experience, technologies} each as a string."""
    if not FALLBACK_MODE:
        system_prompt = (
            "You extract structured information from resumes. Respond with ONLY valid JSON: "
            '{"skills": "...", "education": "...", "projects": "...", "experience": "...", "technologies": "..."}'
        )
        user_prompt = f"Resume text:\n{resume_text[:6000]}"
        result = _call_ai(system_prompt, user_prompt)
        parsed = _extract_json(result) if result else None
        if isinstance(parsed, dict):
            for k in ["skills", "education", "projects", "experience", "technologies"]:
                parsed.setdefault(k, "Not clearly detected.")
            return parsed

    # ---- Simple keyword-based fallback ----
    text_lower = resume_text.lower()
    tech_keywords = ["python", "java", "javascript", "react", "flask", "django", "fastapi",
                      "mysql", "sql", "mongodb", "html", "css", "aws", "docker", "git",
                      "c++", "node", "linux", "kubernetes", "machine learning"]
    found_tech = [t for t in tech_keywords if t in text_lower]

    education_match = re.findall(r"(b\.?tech|bachelor|master|m\.?tech|b\.?sc|m\.?sc|degree|university|college)[^\n]{0,60}", text_lower)
    experience_match = re.findall(r"(intern|experience|worked at|developer|engineer)[^\n]{0,60}", text_lower)
    project_match = re.findall(r"(project[^\n]{0,80})", text_lower)

    return {
        "skills": ", ".join(found_tech) if found_tech else "Not clearly detected.",
        "education": "; ".join(set(education_match[:3])) if education_match else "Not clearly detected.",
        "projects": "; ".join(set(project_match[:3])) if project_match else "Not clearly detected.",
        "experience": "; ".join(set(experience_match[:3])) if experience_match else "Not clearly detected.",
        "technologies": ", ".join(found_tech) if found_tech else "Not clearly detected.",
    }


def generate_resume_questions(resume_analysis: dict, num_questions: int = 5):
    """Generate interview questions personalized to a parsed resume."""
    tech = resume_analysis.get("technologies") or resume_analysis.get("skills") or ""
    if not FALLBACK_MODE:
        system_prompt = (
            "Generate resume-based interview questions as a JSON array of plain strings only."
        )
        user_prompt = (
            f"Candidate resume summary -> Skills: {resume_analysis.get('skills')}, "
            f"Projects: {resume_analysis.get('projects')}, Experience: {resume_analysis.get('experience')}, "
            f"Technologies: {tech}. Generate exactly {num_questions} personalized interview questions."
        )
        result = _call_ai(system_prompt, user_prompt)
        parsed = _extract_json(result) if result else None
        if isinstance(parsed, list) and len(parsed) > 0:
            return [str(q) for q in parsed[:num_questions]]

    techs = [t.strip() for t in tech.split(",") if t.strip() and t.strip() != "Not clearly detected."]
    if not techs:
        return _FALLBACK_QUESTIONS["Resume Based"][:num_questions]
    questions = [f"I see you have experience with {t}. Can you explain a project where you used it?" for t in techs]
    questions += _FALLBACK_QUESTIONS["Resume Based"]
    return questions[:num_questions]


def generate_improved_answer(question: str, answer: str):
    """Standalone helper to produce a model answer, used by evaluate_answer's fallback too."""
    result_dict = evaluate_answer(question, answer, job_role="General", difficulty="Medium")
    return result_dict.get("improved_answer", "")
