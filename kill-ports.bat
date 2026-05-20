@echo off
echo ========================================
echo  Omni - Close Application Services
echo ========================================
echo.

set PORTS=8088 8081 8082 8083 8084 8085 3000 3001

for %%p in (%PORTS%) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%p" ^| findstr /C:"LISTENING"') do (
        if not "%%a"=="0" (
            echo [port %%p] kill PID %%a
            taskkill /F /PID %%a >nul 2>&1
        )
    )
)

echo.
echo Nacos 8848 is not stopped by this script.
echo Start Nacos manually if needed:
echo   C:\nacos\bin\startup.cmd -m standalone
echo.
echo Done.
pause
