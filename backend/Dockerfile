FROM python:3.12-slim

WORKDIR /app

# Prevent Python from writing .pyc and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/app ./backend/app

# Ensure persistent data directory exists
RUN mkdir -p /app/data && chmod 777 /app/data

# Expose port
EXPOSE 8000

# Run FastAPI with uvicorn
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
