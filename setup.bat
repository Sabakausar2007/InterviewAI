@echo off
setlocal enabledelayedexpansion
title InterviewAI - One-Time Setup
color 0B

echo ==========================================================
echo   InterviewAI - One-Time Setup
echo ==========================================================
echo.
echo This will:
echo   1. Check Python installation
echo   2. Create a virtual environment
echo   3. Install all required packages
echo   4. Create your .env configuration file
echo   5. Create the MySQL database and tables
echo   6. Insert the 120+ seed MCQ questions
echo   7. Start the InterviewAI server
echo.
echo ==========================================================
echo.
pause

REM ----------------------------------------------------------
REM 1. Check Python installation (try 'python', fall back to 'py')
REM ----------------------------------------------------------
echo.
echo [1/7] Checking Python installation...

set PYTHON_CMD=
python --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python
) else (
    py --version >nul 2>&1
    if not errorlevel 1 (
        set PYTHON_CMD=py
    )
)

if "%PYTHON_CMD%"=="" (
    echo.
    echo ERROR: Python was not found on your system.
    echo Please install Python 3.10 or newer from https://www.python.org/downloads/
    echo IMPORTANT: During installation, check "Add Python to PATH".
    echo.
    pause
    exit /b 1
)

%PYTHON_CMD% --version
echo Python found successfully (using "%PYTHON_CMD%" command).

REM ----------------------------------------------------------
REM 2. Create required folders
REM ----------------------------------------------------------
echo.
echo [2/7] Creating required folders...
if not exist "uploads\resumes" mkdir "uploads\resumes"
if not exist "frontend\assets\images" mkdir "frontend\assets\images"
echo Folders ready.

REM ----------------------------------------------------------
REM 3. Create virtual environment
REM ----------------------------------------------------------
echo.
echo [3/7] Setting up Python virtual environment...
if not exist "venv" (
    %PYTHON_CMD% -m venv venv
    if errorlevel 1 (
        echo ERROR: Could not create the virtual environment.
        pause
        exit /b 1

    )
    echo Virtual environment created.
) else (
    echo Virtual environment already exists, skipping creation.
)

call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Could not activate the virtual environment.
    pause
    exit /b 1
)

echo Upgrading pip...
python -m pip install --upgrade pip >nul 2>&1

echo Installing required packages from requirements.txt...
pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo ERROR: Failed to install one or more Python packages.
    echo Check your internet connection and try running setup.bat again.
    echo.
    pause
    exit /b 1
)
echo All packages installed successfully.

REM ----------------------------------------------------------
REM 4. Create .env file if missing
REM ----------------------------------------------------------
echo.
echo [4/7] Checking environment configuration...
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo A new .env file was created from .env.example.
    echo.
    echo ==========================================================
    echo   IMPORTANT: Open the .env file now and set your
    echo   MySQL password (DATABASE_PASSWORD).
    echo   AI_API_KEY can stay empty - the app will run in
    echo   demo/fallback mode without it.
    echo ==========================================================
    echo.
    notepad .env
) else (
    echo .env file already exists, skipping.
)

REM ----------------------------------------------------------
REM 5. Check MySQL and create database + tables
REM ----------------------------------------------------------
echo.
echo [5/7] Checking MySQL and initializing the database...
where mysql >nul 2>&1
if errorlevel 1 (
    echo.
    echo WARNING: The 'mysql' command-line tool was not found in PATH.
    echo Please make sure MySQL Server is installed and running, then either:
    echo   a) Add MySQL's bin folder to your PATH and re-run setup.bat, or
    echo   b) Manually run database\schema.sql and database\seed.sql
    echo      using MySQL Workbench or phpMyAdmin.
    echo.
    goto skip_db_setup
)

echo Reading database credentials from .env...
for /f "tokens=1,2 delims==" %%A in ('findstr /b "DATABASE_HOST DATABASE_PORT DATABASE_USER DATABASE_PASSWORD DATABASE_NAME" .env') do (
    if "%%A"=="DATABASE_HOST" set DB_HOST=%%B
    if "%%A"=="DATABASE_PORT" set DB_PORT=%%B
    if "%%A"=="DATABASE_USER" set DB_USER=%%B
    if "%%A"=="DATABASE_PASSWORD" set DB_PASS=%%B
    if "%%A"=="DATABASE_NAME" set DB_NAME=%%B
)

echo Creating database and tables (database\schema.sql)...
mysql -h %DB_HOST% -P %DB_PORT% -u %DB_USER% -p%DB_PASS% < database\schema.sql
if errorlevel 1 (
    echo.
    echo ERROR: Could not run schema.sql. Check your MySQL credentials in .env.
    echo You can also run database\schema.sql manually in MySQL Workbench.
    echo.
    goto skip_db_setup
)
echo Database and tables created.

echo Inserting 120+ seed MCQ questions (database\seed.sql)...
mysql -h %DB_HOST% -P %DB_PORT% -u %DB_USER% -p%DB_PASS% < database\seed.sql
if errorlevel 1 (
    echo WARNING: Could not insert seed data automatically.
    echo You can run database\seed.sql manually later.
) else (
    echo Seed MCQ questions inserted successfully.
)

:skip_db_setup

REM ----------------------------------------------------------
REM 6. Done - final message
REM ----------------------------------------------------------
echo.
echo [6/7] Setup steps complete.
echo.
echo ==========================================================
echo   SETUP COMPLETE!
echo ==========================================================
echo.
echo You can now start the app anytime by double-clicking run.bat
echo.

REM ----------------------------------------------------------
REM 7. Start the server now
REM ----------------------------------------------------------
echo [7/7] Starting InterviewAI now...
echo.
call run.bat

endlocal
