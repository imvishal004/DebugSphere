FROM eclipse-temurin:17-jdk-alpine

RUN adduser -D -u 1000 executor && \
    mkdir -p /workspace && \
    chown executor:executor /workspace

USER executor
WORKDIR /workspace