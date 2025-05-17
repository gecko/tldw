@echo off

REM Start first program
start "Backend" cmd /k "cd /d C:\Users\danie\Desktop\Code\tldw && .\venv\Scripts\activate.bat && python backend.py --model llama3.2:latest"

REM Start second program
start "Frontend" cmd /k "cd /d C:\Users\danie\Desktop\Code\tldw\youtube-summarizer && yarn dev --port 80"
