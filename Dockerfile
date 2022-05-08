FROM node:lts
COPY . /app
WORKDIR /app
RUN yarn
CMD node main.js
