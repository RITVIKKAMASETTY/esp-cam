@echo off
chcp 65001 >nul
echo =====================================
echo  Blindsist (TFLite CLI)
echo =====================================
echo.


:: Run detector
echo Starting java based detector...
echo Press Ctrl+C to stop
echo.
echo -------------------------------------

python mobilenet.py

echo.
echo -------------------------------------
echo Done.
pause