@echo off
title Klarke Repair - Servidor Local
cd /d "%~dp0"
echo.
echo   ====================================================
echo      KLARKE REPAIR  -  iniciando utilitario portable
echo   ====================================================
echo.
echo   Abrindo no seu navegador padrao...
echo   MANTENHA ESTA JANELA ABERTA enquanto usa a ferramenta.
echo   (Fechar esta janela encerra o Klarke Repair)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0klarke-repair.ps1"
echo.
echo   Klarke Repair encerrado. Pode fechar esta janela.
pause >nul
