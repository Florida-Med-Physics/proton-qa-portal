FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app PROTON_QA_DB=/data/portal.db
WORKDIR /app
COPY requirements.txt requirements-deploy.txt ./
RUN pip install --no-cache-dir -r requirements-deploy.txt && groupadd -g 10001 portal && useradd -u 10001 -g portal -s /usr/sbin/nologin portal && mkdir /data && chown portal:portal /data
COPY portal ./portal
COPY deploy/serve.py ./deploy/serve.py
COPY run_portal.py ./
USER 10001:10001
EXPOSE 8790
CMD ["python", "deploy/serve.py"]
