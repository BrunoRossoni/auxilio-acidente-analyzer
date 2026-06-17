@echo off
chcp 65001 > nul
echo.
echo ============================================================
echo    ANALISADOR DE AUXILIO-ACIDENTE - Instalação e Início
echo ============================================================
echo.

:: Verifica Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado!
    echo Baixe e instale em: https://www.python.org/downloads/
    echo Marque a opcao "Add Python to PATH" durante a instalacao.
    pause
    exit /b 1
)

echo [1/3] Python encontrado. Instalando dependencias...
pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
)

echo [2/3] Dependencias instaladas com sucesso!
echo.

:: Verifica se a chave da API foi configurada
findstr /C:"sua_chave_aqui" .env >nul 2>&1
if %errorlevel% equ 0 (
    echo [ATENÇÃO] Você precisa configurar sua chave da API Claude!
    echo.
    echo 1. Abra o arquivo .env com o Bloco de Notas
    echo 2. Substitua "sua_chave_aqui" pela sua chave da Anthropic
    echo    Obtenha em: https://console.anthropic.com/
    echo.
    pause
    exit /b 1
)

echo [3/3] Iniciando o servidor...
echo.
echo ============================================================
echo  Sistema rodando em: http://localhost:8000
echo  Abra este link no seu navegador!
echo  Para parar: feche esta janela ou pressione CTRL+C
echo ============================================================
echo.
start http://localhost:8000
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

pause
