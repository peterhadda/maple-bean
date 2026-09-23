@echo off
rem Maple Bean: one-time install of the two Visual Studio pieces Unreal needs to compile the C++
rem (.NET Framework 4.8.1 SDK + MSVC 14.38), then builds the editor module.
rem Double-click this file and click "Yes" on the Windows admin prompt.

net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Closing Visual Studio if it is open (the installer refuses to run while it is)...
taskkill /IM devenv.exe >nul 2>&1

echo Installing .NET Framework 4.8.1 SDK and MSVC v14.38 (5-15 minutes)...
rem setup.exe does not accept --wait (exit 87); "start /wait" blocks instead.
start "" /wait "C:\Program Files (x86)\Microsoft Visual Studio\Installer\setup.exe" modify ^
  --installPath "C:\Program Files\Microsoft Visual Studio\2022\Community" ^
  --add Microsoft.Net.Component.4.8.1.SDK ^
  --add Microsoft.VisualStudio.Component.VC.14.38.17.8.x86.x64 ^
  --passive --norestart --force
echo Installer exit code: %errorlevel%

rem setup.exe can hand off to a child process; wait until it is gone (max ~30 min).
set /a N=0
:waitinst
tasklist /FI "IMAGENAME eq setup.exe" 2>nul | find /I "setup.exe" >nul
if %errorlevel% equ 0 (
  set /a N+=1
  if %N% lss 180 ( timeout /t 10 /nobreak >nul & goto waitinst )
)
if exist "C:\Program Files (x86)\Windows Kits\NETFXSDK" (echo .NET Framework SDK: installed) else (echo .NET Framework SDK: STILL MISSING)

rem One Unreal/UBT process at a time: share the agents' lock (Scripts/ue_run.sh).
if not exist "%~dp0Saved" mkdir "%~dp0Saved"
:waitlock
mkdir "%~dp0Saved\ue.lock" 2>nul || (echo Waiting for another Unreal task to finish... & timeout /t 20 /nobreak >nul & goto waitlock)
echo FinishSetup build > "%~dp0Saved\ue.lock\owner"

echo Building the Maple Bean editor module (log: Saved\Logs\FinishSetup_build.log)...
if not exist "%~dp0Saved\Logs" mkdir "%~dp0Saved\Logs"
call "C:\Program Files\Epic Games\UE_5.6\Engine\Build\BatchFiles\Build.bat" mb_unreal_engineEditor Win64 Development -Project="%~dp0mb_unreal_engine.uproject" -WaitMutex -NoHotReload > "%~dp0Saved\Logs\FinishSetup_build.log" 2>&1
echo Build exit code: %errorlevel%
rmdir /s /q "%~dp0Saved\ue.lock"
echo.
echo Done. You can close this window.
timeout /t 60 >nul
