@echo off
cd /d "%~dp0"
if exist "App\MD Hawk.exe" (
  start "" "App\MD Hawk.exe" %*
) else if exist "release\win-unpacked\MD Hawk.exe" (
  start "" "release\win-unpacked\MD Hawk.exe" %*
) else (
  call npm run dev
)
