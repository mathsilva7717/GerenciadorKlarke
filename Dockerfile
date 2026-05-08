FROM node:20-slim

WORKDIR /app

# Copia os arquivos de configuração
COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Instala as dependências
RUN npm install
RUN cd backend && npm install
RUN cd frontend && npm install

# Copia o restante do código
COPY . .

# Build do frontend
RUN cd frontend && npm run build

# Expõe a porta que o seu server.js usa
EXPOSE 3001

# Comando para iniciar
CMD ["npm", "start"]
