FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=3006
EXPOSE 3006
CMD ["node", "server.js"]
