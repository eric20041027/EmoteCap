@echo off
uv run --directory "%~dp0server" --frozen --python 3.12.14 python -m emotecap_server.launcher %*
exit /b %errorlevel%
