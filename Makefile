.PHONY: help install run-backend run-frontend build test docker-up docker-down

help:
	@echo "Comandos disponibles:"
	@echo "  make install        - Instala dependencias de backend y frontend"
	@echo "  make run-backend    - Inicia el servidor FastAPI en http://localhost:8000"
	@echo "  make run-frontend   - Inicia el servidor Vite en http://localhost:5173"
	@echo "  make test           - Ejecuta pruebas del backend y endpoints"
	@echo "  make build          - Compila el bundle de frontend para producción"
	@echo "  make docker-up      - Levanta toda la suite con docker-compose"
	@echo "  make docker-down    - Detiene los contenedores Docker"

install:
	uv pip install -r backend/requirements.txt --python backend/.venv/Scripts/python.exe
	cd frontend && npm install

run-backend:
	backend/.venv/Scripts/python.exe -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

run-frontend:
	cd frontend && npm run dev

test:
	backend/.venv/Scripts/python.exe backend/test_api_endpoints.py

build:
	cd frontend && npm run build

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down
