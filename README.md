# InterviewAI — AI-Powered Interview Assistant

A complete, self-contained AI interview preparation platform: AI mock interviews with
detailed scoring, a 120+ question MCQ practice system, resume-based question generation,
and performance analytics — built with FastAPI, MySQL, and plain HTML/CSS/JavaScript.

The app runs entirely from one FastAPI server (it also serves the frontend), so there is
nothing else to configure or deploy separately.

---

## Project Structure

```
InterviewAI/
├── setup.bat              <- Run this ONCE to set everything up
├── run.bat                <- Run this every time you want to start the app
├── share.bat              <- Optional: creates a temporary public link to demo the app
├── .gitignore             <- Keeps secrets (.env) and local files out of GitHub
├── requirements.txt
├── .env.example
├── .env                   <- Created automatically by setup.bat
│
├── backend/
│   ├── main.py             FastAPI app entry point (also serves the frontend)
│   ├── database.py         SQLAlchemy engine/session setup
│   ├── models.py           Database table models
│   ├── schemas.py          Request/response validation
│   ├── auth.py              Password hashing + JWT auth
│   ├── ai_service.py        AI integration (with built-in fallback/demo mode)
│   ├── resume_service.py    PDF/DOCX text extraction
│   └── routes/
│       ├── auth_routes.py
│       ├── interview_routes.py
│       ├── quiz_routes.py
│       ├── resume_routes.py
│       ├── performance_routes.py
│       └── admin_routes.py
│
├── frontend/                Plain HTML/CSS/JS — no build step required
│   ├── index.html, login.html, signup.html, dashboard.html, ...
│   └── assets/{css,js,images}/
│
├── database/
│   ├── schema.sql              All 10 tables (used for local MySQL setup)
│   ├── seed.sql                 120 MCQ questions, MySQL format
│   └── seed_data.py             Same 120 MCQs as plain Python data — used to
│                                 auto-seed the database on startup no matter
│                                 which database backend is active (MySQL or
│                                 the automatic SQLite fallback used for free
│                                 online hosting)
└── uploads/resumes/           Uploaded resume files are stored here
```

---

## Requirements

Before running `setup.bat`, make sure you have:

1. **Python 3.10+** — download from https://www.python.org/downloads/
   During installation, check **"Add Python to PATH"**.
2. **MySQL Server 8.0+** (MySQL Workbench or XAMPP both work) — download from
   https://dev.mysql.com/downloads/mysql/
   Make sure the MySQL service is **running** before you run `setup.bat`.
3. **VS Code** (or any editor) — optional, only needed if you want to look at the code.

You do **not** need Node.js, npm, or any frontend build tools.

---

## One-Time Setup

1. Open the `InterviewAI` folder in VS Code (or File Explorer).
2. Double-click **`setup.bat`**.
3. The script will automatically:
   - Check that Python is installed
   - Create a Python virtual environment (`venv/`)
   - Install all required packages from `requirements.txt`
   - Create a `.env` file from `.env.example` (and open it in Notepad so you can
     set your MySQL password)
   - Create the `interview_ai` database and all tables (`database/schema.sql`)
   - Insert the 120+ seed MCQ questions (`database/seed.sql`)
   - Start the server automatically

When Notepad opens during setup, update this line with your real MySQL password,
then save and close Notepad so the script can continue:

```
DATABASE_PASSWORD=YOUR_PASSWORD
```

That's it — you only need to do this once.

---

## How to Run (every time after setup)

Double-click **`run.bat`**. It will:
- Activate the virtual environment
- Start the FastAPI server
- Automatically open your browser to the app

To stop the server, close the terminal window or press `CTRL+C` inside it.

---

## Sharing a Live Link (for your presentation/demo)

If your teacher or examiner needs to open the app from **their own device**
(phone, another laptop, etc.), you can create a temporary public link:

1. Make sure `run.bat` is already running (the app works at `http://127.0.0.1:8000`).
2. Keep that window open, and double-click **`share.bat`** in a **second** window.
3. The first time, it downloads a small free tool called `cloudflared`
   (no account, no signup, ~20MB, one time only).
4. After a few seconds you'll see a link like:
   ```
   https://random-words.trycloudflare.com
   ```
5. Send that link to your teacher/examiner. They open it in any browser and
   use the full app exactly like you do — login, dashboard, AI interview,
   MCQs, everything.

**Important things to know:**
- **Your laptop must stay ON**, and both `run.bat` and `share.bat` windows
  must stay open, for the link to keep working. Closing either window ends
  the demo link immediately (nothing stays running in the background).
- The link only gives access to the **running app in the browser** — it does
  **not** expose your source code, `.env` file, database, or any passwords.
  It's a plain HTTPS proxy straight to your local app.
- The link is temporary and random each time you run `share.bat` — it's not
  a permanent public website, which is intentional for a class demo.
- No API keys or MySQL credentials are ever sent to Cloudflare or shown to
  the visitor; they only interact with your app's normal web pages.

This is the simplest option because there's no cloud deployment, no server
rental, and no configuration beyond running one extra `.bat` file.

**Downside of this method:** your laptop must stay on and connected to the
internet the whole time. If you want a permanent link that works even when
your laptop is off, use the free Render deployment below instead.

---

## Deploying Online for Free (Render) — a real public link, laptop can be OFF

This gives you a permanent HTTPS link like `https://your-app-name.onrender.com`
that works even after you shut your laptop down. It's free and takes about
10 minutes the first time.

The project already auto-detects this situation: when no MySQL settings are
provided, it automatically uses a small built-in SQLite database instead, and
automatically fills it with the 120 MCQ questions the first time it starts.
You don't need to set up any database by hand.

### Step 1 — Put the project on GitHub (no coding required)

1. Go to https://github.com and create a free account if you don't have one.
2. Click the **+** icon (top right) → **New repository**.
3. Name it `interviewai`, keep it **Public** (or Private, both work), then
   click **Create repository**.
4. On the new repository page, click **uploading an existing file**.
5. Open your `InterviewAI` project folder, select **everything inside it**
   (all folders and files — `backend`, `frontend`, `database`, `requirements.txt`,
   `README.md`, etc.) and drag them into the browser upload area.
   - **Do NOT upload the `venv` folder or your `.env` file** if they exist —
     they aren't needed online and `.env` contains your local secrets.
6. Scroll down and click **Commit changes**.

### Step 2 — Create your free Render account

1. Go to https://render.com and click **Get Started** → sign up with GitHub
   (simplest option — one click, no separate password to create).
2. Authorize Render to access your GitHub account when asked.

### Step 3 — Create the Web Service

1. On the Render dashboard, click **New +** → **Web Service**.
2. Choose **Build and deploy from a Git repository**, then select the
   `interviewai` repository you uploaded → click **Connect**.
3. Fill in these fields exactly:

   | Field | Value |
   |---|---|
   | **Name** | `interviewai` (or anything you like — this becomes part of your URL) |
   | **Region** | Any region close to you |
   | **Root Directory** | *(leave empty)* |
   | **Runtime** | `Python 3` |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn main:app --app-dir backend --host 0.0.0.0 --port $PORT` |
   | **Instance Type** | `Free` |

4. Scroll to **Environment Variables** and click **Add Environment Variable**
   to add these two (do **not** add any `DATABASE_*` variables — leaving
   them out is what triggers the automatic SQLite mode):

   | Key | Value |
   |---|---|
   | `SECRET_KEY` | Any long random text you make up (e.g. mash your keyboard for 30+ characters) |
   | `AI_API_KEY` | Your AI API key, if you have one — leave it **blank/unset** to run in demo/fallback mode, which still works fully for MCQs and mock interviews |

5. Click **Create Web Service**.

### Step 4 — Wait for it to build, then get your link

1. Render will show a live build log. The first deploy takes 2–5 minutes.
2. Once you see `Your service is live 🎉` (or the status dot turns green),
   look at the **top of the page** — your public link is shown right under
   your service name, looking like:
   ```
   https://interviewai.onrender.com
   ```
3. Click that link (or copy it into any browser, on any device) — it opens
   your actual InterviewAI website directly, fully working: signup, login,
   dashboard, AI interview, MCQs, resume upload, performance analytics,
   everything.

### Notes about the free Render tier

- **Laptop can be OFF** — the app runs on Render's servers, not yours.
- The free tier "sleeps" after 15 minutes with no visitors. The next visitor
  waits about 30–50 seconds for it to wake up — perfectly fine for a
  presentation (open the link a minute before you start).
- The database is a small SQLite file that lives with the app. It resets
  (goes back to empty + auto-reseeds the 120 MCQs) whenever Render restarts
  or redeploys your service — fine for a demo, but don't rely on it as
  permanent storage for real user data.
- Uploaded resumes are stored the same way — they work perfectly during a
  live session, but aren't guaranteed to survive a redeploy.
- To update the live site later, upload your changed files to the same
  GitHub repository (drag-and-drop again) — Render redeploys automatically.

---

## MySQL Setup (manual alternative)

If `setup.bat` could not find the `mysql` command automatically, you can set up the
database manually:

1. Open MySQL Workbench (or phpMyAdmin).
2. Open and run `database/schema.sql` — this creates the `interview_ai` database
   and all 10 tables.
3. Open and run `database/seed.sql` — this inserts the 120+ MCQ questions.
4. Make sure your `.env` file's `DATABASE_*` values match your MySQL server
   (host, port, username, password, database name).

---

## AI API Setup

The AI features (dynamic question generation, answer scoring, resume analysis) use
an AI API called through `backend/ai_service.py`.

**To enable full AI features:**
1. Open `.env`.
2. Set `AI_API_KEY=your_key_here`.
3. Restart the app with `run.bat`.

**Without an API key (Fallback / Demo Mode):**
The app is fully usable even with `AI_API_KEY` left blank:
- AI Mock Interviews use a built-in question bank per interview type.
- Answers are scored using rule-based heuristics (relevance, length, structure).
- Resume analysis uses keyword-matching instead of AI.
- **MCQ quizzes are unaffected either way** — they never depend on the AI API.

You'll see a "Demo mode" badge in the top bar whenever fallback mode is active, and
the server console will print a clear notice on startup.

---

## Login Credentials for Testing

There are no pre-created accounts — sign up your own:

1. Go to the **Sign Up** page and create a normal user account.
2. To test the **Admin Dashboard**, you need to promote a user to admin. After
   signing up, run this in MySQL:

   ```sql
   USE interview_ai;
   UPDATE users SET is_admin = 1 WHERE email = 'your_signup_email@example.com';
   ```

3. Then use the **Admin Login** tab on the Login page with that same account.

---

## Common Errors and Fixes

**"Python was not found"**
Install Python from python.org and make sure "Add Python to PATH" was checked
during installation. Restart your terminal/VS Code afterward.

**"Could not run schema.sql" / MySQL connection errors**
- Make sure the MySQL service is running (check Windows Services, or open
  MySQL Workbench and confirm you can connect).
- Double-check `DATABASE_USER` and `DATABASE_PASSWORD` in `.env` match your
  actual MySQL login.
- If `mysql` isn't recognized as a command, add MySQL's `bin` folder to your
  system PATH, or run `schema.sql` / `seed.sql` manually in MySQL Workbench.

**The app starts but pages show "Can't reach the InterviewAI server"**
The backend isn't running or MySQL isn't reachable. Check the terminal window
opened by `run.bat` for error messages — it will tell you exactly what's wrong
without ever showing a raw Python crash to the browser.

**Signup/login fails immediately with a server error**
This is almost always a database connection issue. Check the terminal log —
on startup, the server prints whether the database connected successfully.

**AI features aren't generating dynamic content**
Check that `AI_API_KEY` is set correctly in `.env` and restart with `run.bat`.
If it's intentionally blank, this is expected — you're in fallback/demo mode.

**Port 8000 already in use**
Change `APP_PORT` in `.env` to a different port (e.g. `8080`), save, and run
`run.bat` again.

**MCQ quiz says "No questions available for this category"**
The seed data didn't load. Re-run `database/seed.sql` manually in MySQL
Workbench, or re-run `setup.bat`. (This doesn't apply to the free Render
deployment — it seeds itself automatically on first startup.)

**Render shows "Application failed to respond" or the build fails**
- Double-check the **Start Command** is exactly:
  `uvicorn main:app --app-dir backend --host 0.0.0.0 --port $PORT`
  (the `$PORT` part must be included exactly like that — Render assigns the
  port automatically and the app must listen on it).
- Make sure `requirements.txt` is at the top level of the GitHub repository,
  not inside a subfolder.
- Check the **Logs** tab on Render for the exact error message.

**Render app opens but login/signup gives a server error**
Make sure you added the `SECRET_KEY` environment variable in Render's
dashboard — the app needs it to issue login tokens.

---

## Notes

- Passwords are hashed with bcrypt — never stored in plain text.
- All SQL queries use SQLAlchemy's parameterized queries (no manual string
  concatenation), which protects against SQL injection.
- Resume uploads are validated for file type (PDF/DOCX only) and size
  (5MB max by default, configurable via `MAX_RESUME_SIZE_MB` in `.env`).
- Unhandled server errors are always caught and shown as a friendly message —
  raw Python stack tracebacks are never sent to the browser (they're logged to
  the server console instead, for debugging).
