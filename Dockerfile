# Build context = repo 根目錄（才拿得到 index.html），跟 NTPU AI 一樣把前端一起打包
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app.py .
COPY index.html ./index.html

ENV PORT=8080
CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]
