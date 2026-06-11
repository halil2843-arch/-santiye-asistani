FROM python:3.11-slim

WORKDIR /app

# Sistem bağımlılıkları (asyncpg, Pillow, vs. için)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Önce sadece requirements kopyala — layer cache için
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama kodunu kopyala
COPY . .

# Çalışma dizinleri
RUN mkdir -p uploads outputs

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
