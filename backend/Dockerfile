FROM node:18-bullseye

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    openjdk-17-jdk \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["sh", "-c", "node server.js & node worker.js"]