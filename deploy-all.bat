@echo off
setlocal enabledelayedexpansion
REM ==========================================================================
REM  deploy-all.bat  -  Compile + deploy every component in this monorepo.
REM
REM  Usage:
REM     deploy-all.bat                 Deploy using the DEFAULT snc profile
REM     deploy-all.bat australia       Deploy using the named profile "australia"
REM
REM  - Skips "component-template" (it's a copy-me scaffold, not a real component).
REM  - `snc ui-component deploy` compiles the component, then uploads it.
REM  - Requires the global ServiceNow CLI:  npm i -g @servicenow/cli
REM  - Configure the target instance first: snc configure profile set [--profile <name>]
REM ==========================================================================

set "ROOT=%~dp0"
set "COMPDIR=%ROOT%components"

REM ---- optional profile argument -> -p <profile> -----------------------------
set "PROFILE=%~1"
set "PFLAG="
if not "%PROFILE%"=="" set "PFLAG=-p %PROFILE%"

REM ---- ensure dependencies are installed (hoisted to the monorepo root) -------
if not exist "%ROOT%node_modules" (
    echo Installing dependencies ^(npm install^)...
    pushd "%ROOT%"
    call npm install
    popd
    if errorlevel 1 (
        echo [ERROR] npm install failed. Aborting.
        endlocal & exit /b 1
    )
)

set "OK_LIST="
set "FAIL_LIST="

for /d %%C in ("%COMPDIR%\*") do (
    set "NAME=%%~nxC"
    if /i "!NAME!"=="component-template" (
        echo Skipping !NAME! ^(scaffold template^)
    ) else (
        echo.
        echo ============================================================
        echo  Deploying !NAME!   %PFLAG%
        echo ============================================================
        pushd "%%C"
        call snc ui-component deploy %PFLAG%
        if errorlevel 1 (
            echo [FAILED] !NAME!
            set "FAIL_LIST=!FAIL_LIST! !NAME!"
        ) else (
            echo [OK] !NAME!
            set "OK_LIST=!OK_LIST! !NAME!"
        )
        popd
    )
)

echo.
echo ============================================================
echo  Summary
echo ============================================================
echo  Deployed:!OK_LIST!
if not "!FAIL_LIST!"=="" (
    echo  FAILED:  !FAIL_LIST!
    echo.
    echo  One or more components failed. See the log above.
    endlocal & exit /b 1
)
echo  All components deployed successfully.
endlocal & exit /b 0
