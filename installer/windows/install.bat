@echo off
echo ============================================================
echo 🛡️  Installing CipherWatch Standalone Endpoint Agent (Windows)
echo ============================================================

set INSTALL_DIR=C:\Program Files\CipherWatch
set DATA_DIR=C:\ProgramData\CipherWatch

if not exist "..\..\dist\cipherwatch-agent.exe" (
    echo ❌ Executable binary dist\cipherwatch-agent.exe not found. Run build.bat first.
    exit /b 1
)

mkdir "%INSTALL_DIR%"
mkdir "%DATA_DIR%\logs"
mkdir "%DATA_DIR%\cache"
mkdir "%DATA_DIR%\keys"

copy /Y "..\..\dist\cipherwatch-agent.exe" "%INSTALL_DIR%\cipherwatch-agent.exe"

echo ⚙️ Registering Windows Service (CipherWatchAgent)...
sc create CipherWatchAgent binPath= "\"%INSTALL_DIR%\cipherwatch-agent.exe\" start --service" start= auto DisplayName= "CipherWatch Endpoint Agent"

echo ============================================================
echo ✅ Installation Completed!
echo Next steps:
echo 1. Open Command Prompt as Administrator and run enrollment:
echo    "C:\Program Files\CipherWatch\cipherwatch-agent.exe" setup
echo
echo 2. Start the Windows Service:
echo    net start CipherWatchAgent
echo ============================================================
