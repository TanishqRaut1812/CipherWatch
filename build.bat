@echo off
echo ============================================================
echo 🛠️  Building CipherWatch Standalone Endpoint Agent (Windows)
echo ============================================================

pip install pyinstaller httpx psutil watchdog pydantic

if exist dist rmdir /s /q dist
if exist build rmdir /s /q build

pyinstaller --clean cipherwatch-agent.spec

if exist dist\cipherwatch-agent.exe (
    echo ============================================================
    echo ✅ Build Successful!
    echo    • Binary Executable: dist\cipherwatch-agent.exe
    echo ============================================================
) else (
    echo ❌ Build failed! Executable dist\cipherwatch-agent.exe was not generated.
    exit /b 1
)
