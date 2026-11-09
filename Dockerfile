# NORD 3D — Production Dockerfile
FROM node:20-alpine

WORKDIR /app

# Копируем package.json и устанавливаем окружение (зависимостей нет, но сохраняем стандарты)
COPY package.json ./

# Копируем все файлы проекта
COPY . .

# Создаем папку для сохранения постоянной базы данных
RUN mkdir -p /app/data

# Экспортируем порт
ENV PORT=3000
EXPOSE 3000

# Запуск сервера
CMD ["node", "server.js"]
