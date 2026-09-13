"""
main.py
FastAPI application entry point. Wires up:
- CORS
- Database table creation (via SQLAlchemy, safe to run even if schema.sql already ran)
- All API routers
- Static frontend hosting (so the whole app runs from one server)
- Global error handling so raw stack traces are never shown to users
"""
import os
import sys
import traceback
import importlib.util

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from database import engine, Base, SessionLocal, check_database_connection
import models  # noqa: F401  (import so tables are registered with Base)
import ai_service

from routes import auth_routes, interview_routes, quiz_routes, resume_routes, performance_routes, admin_routes

APP_HOST = os.getenv("APP_HOST", "127.0.0.1")
APP_PORT = int(os.getenv("APP_PORT", "8000"))

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")


def seed_mcq_questions_if_empty():
    """Loads database/seed_data.py (120 MCQs) and inserts them if the
    mcq_questions table is empty. Works no matter which database backend is
    active, so free hosting with SQLite gets its question bank automatically
    without anyone needing to run seed.sql by hand."""
    db = SessionLocal()
    try:
        if db.query(models.MCQQuestion).count() > 0:
            return
        seed_path = os.path.join(PROJECT_ROOT, "database", "seed_data.py")
        if not os.path.isfile(seed_path):
            print("[startup] database/seed_data.py not found - skipping auto-seed.")
            return
        spec = importlib.util.spec_from_file_location("mcq_seed_data", seed_path)
        seed_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(seed_module)

        for category, difficulty, question, a, b, c, d, correct, explanation in seed_module.MCQ_SEED_DATA:
            db.add(models.MCQQuestion(
                category=category, difficulty=difficulty, question=question,
                option_a=a, option_b=b, option_c=c, option_d=d,
                correct_answer=correct, explanation=explanation,
            ))
        db.commit()
        print(f"[startup] Auto-seeded {len(seed_module.MCQ_SEED_DATA)} MCQ questions (table was empty).")
    except Exception as e:
        print(f"[startup] Could not auto-seed MCQ questions: {e}")
    finally:
        db.close()


app = FastAPI(title="InterviewAI", description="AI-Powered Interview Assistant", version="1.0.0")

# ---------------- CORS ----------------
# Frontend is served from the same origin, but CORS is enabled to allow
# local development (e.g. opening the HTML files directly) as well.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- Global error handler ----------------
# Never leak raw Python stack traces to the user.
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("=" * 60, file=sys.stderr)
    print(f"Unhandled error on {request.method} {request.url}", file=sys.stderr)
    traceback.print_exc()
    print("=" * 60, file=sys.stderr)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our end. Please try again in a moment."},
    )


# ---------------- Startup ----------------
@app.on_event("startup")
def on_startup():
    ok, message = check_database_connection()
    if not ok:
        print("!" * 70)
        print("DATABASE CONNECTION FAILED.")
        print(f"Reason: {message}")
        print("Check your .env DATABASE_* values and make sure MySQL is running.")
        print("The server will still start, but most features will not work")
        print("until the database connection is fixed.")
        print("!" * 70)
    else:
        try:
            Base.metadata.create_all(bind=engine)
            print("[startup] Database connected and tables verified.")
            seed_mcq_questions_if_empty()
        except Exception as e:
            print(f"[startup] Could not verify/create tables: {e}")

    if ai_service.FALLBACK_MODE:
        print("=" * 70)
        print("AI_API_KEY is not set. Running in FALLBACK / DEMO MODE.")
        print("AI Interview will use a predefined question bank and rule-based")
        print("scoring. MCQ quizzes are unaffected and always work.")
        print("Add AI_API_KEY to your .env file to enable full AI features.")
        print("=" * 70)
    else:
        print("[startup] AI API key detected. Full AI features enabled.")


# ---------------- API routers ----------------
app.include_router(auth_routes.router)
app.include_router(interview_routes.router)
app.include_router(quiz_routes.router)
app.include_router(resume_routes.router)
app.include_router(performance_routes.router)
app.include_router(admin_routes.router)


@app.get("/api/health")
def health_check():
    db_ok, db_message = check_database_connection()
    return {
        "status": "ok",
        "database_connected": db_ok,
        "database_message": db_message,
        "ai_mode": "fallback" if ai_service.FALLBACK_MODE else "live",
    }


# ---------------- Frontend hosting ----------------
# Serves index.html, login.html, dashboard.html, assets/, etc. from /frontend
# This must be mounted AFTER the API routers so /api/* always wins.
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:
    @app.get("/")
    def frontend_missing():
        return JSONResponse(
            status_code=500,
            content={"detail": f"Frontend folder not found at {FRONTEND_DIR}"},
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=APP_HOST, port=APP_PORT, reload=True)
