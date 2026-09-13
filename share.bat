@echo off
title InterviewAI - Share Link
color 0E

echo ==========================================================
echo   InterviewAI - Create a Temporary Share Link
echo ==========================================================
echo.
echo This creates a temporary public web link to your app using
echo Cloudflare Tunnel (free, no signup, no account needed).
echo.
echo IMPORTANT:
echo   - Your laptop must stay ON and this window must stay open
echo     for the link to keep working.
echo   - Make sure run.bat is ALREADY RUNNING in another window
echo     before you continue here.
echo   - The link only lets people USE the app in their browser.
echo     It does NOT expose your code, .env file, or database.
echo   - Close this window any time to stop sharing instantly.
echo.
pause

if not exist "cloudflared.exe" (
    echo.
    echo cloudflared.exe was not found in this folder.
    echo Downloading it now (one-time, about 20MB)...
    echo.
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
    if errorlevel 1 (
        echo.
        echo ERROR: Could not download cloudflared automatically.
        echo Please download it manually from:
        echo https://github.com/cloudflare/cloudflared/releases/latest
        echo Save it as "cloudflared.exe" in this same folder, then run share.bat again.
        echo.
        pause
        exit /b 1
    )
    echo Download complete.
)

echo.
echo Starting the tunnel... your public link will appear below
echo as a line that looks like: https://random-words.trycloudflare.com
echo.
echo Share THAT link with your teacher/examiner. Nothing else is needed.
echo ==========================================================
echo.

cloudflared.exe tunnel --url http://127.0.0.1:8000

pause
