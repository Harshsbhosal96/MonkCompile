FROM node:latest
WORKDIR /app
COPY ./code/main.js /app/
CMD ["node", "main.js"]
