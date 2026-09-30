FROM python:3.12-slim

WORKDIR /app

# Copy app files (products.json will be in data volume, not baked in)
COPY server.py .
COPY index.html .

# Data directory for persistent files (mounted as volume)
RUN mkdir -p /data
ENV DIAFILM_DATA_DIR=/data
ENV DIAFILM_PORT=8765

EXPOSE 8765

CMD ["python3", "server.py"]