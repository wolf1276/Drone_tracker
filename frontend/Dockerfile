FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Expose Vite's default dev port
EXPOSE 5173

# Run Vite with --host to expose to Docker network
CMD ["npm", "run", "dev", "--", "--host"]
