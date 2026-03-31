FROM node:18-bullseye

WORKDIR /app

# Install all required runtimes
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    openjdk-17-jdk \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Verify installations (important)
RUN python3 --version
RUN java -version
RUN javac -version
RUN g++ --version

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["sh", "-c", "node server.js & node worker.js"]