FROM python:3.13-slim-bookworm@sha256:5024f48ba9441d4b13a95d3945abc6365538e3a31109833367a1923523c6efed

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /runner
COPY trace.py /runner/trace.py
USER 65534:65534
ENTRYPOINT ["python", "-I", "-S", "/runner/trace.py"]
