FROM python:3.12-slim

# Install system dependencies needed by PyMuPDF and FAISS
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the full project
COPY . .

# Hugging Face Spaces runs on port 7860
EXPOSE 7860

# Tell FastAPI to serve the built React frontend
ENV SERVE_FRONTEND=true

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
