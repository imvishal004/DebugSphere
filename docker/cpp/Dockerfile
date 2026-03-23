FROM gcc:12-bookworm

RUN useradd -m -u 1000 -s /bin/sh executor && \
    mkdir -p /workspace && \
    chown executor:executor /workspace

USER executor
WORKDIR /workspace