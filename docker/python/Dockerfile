FROM python:3.11-slim

RUN useradd -m -u 1000 -s /bin/sh executor && \
    mkdir -p /workspace && \
    chown executor:executor /workspace

RUN pip install --no-cache-dir numpy

USER executor
WORKDIR /workspace