FROM node:18-alpine

RUN adduser -D executor || true && \
    mkdir -p /workspace && \
    chown executor:executor /workspace
    
USER executor
WORKDIR /workspace