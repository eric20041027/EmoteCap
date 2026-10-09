@echo off
if not exist "%~dp0python\python.exe" (
  echo EmoteCap package is missing its Python runtime. Obtain the complete candidate again.
  exit /b 1
)
"%~dp0python\python.exe" -I -S -B "%~dp0bootstrap.py" %*
exit /b %errorlevel%
