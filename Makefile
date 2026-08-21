.PHONY: up dev down build logs migrate makemigrations test psql

up:
	docker compose up -d

dev:
	docker compose up --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f cubicle-api

migrate:
	docker compose exec cubicle-api alembic upgrade head

makemigrations:
	docker compose exec cubicle-api alembic revision --autogenerate -m "$(m)"

test:
	docker compose exec cubicle-api pytest --cov=app --cov-report=term-missing

psql:
	docker compose exec postgres psql -U cubicle -d cubicle
