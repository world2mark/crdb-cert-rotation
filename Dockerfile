FROM node:23.7.0-alpine3.21

WORKDIR /usr/src/app

COPY . .

RUN npm install && npm run

ENTRYPOINT ["npm"]

CMD ["start"]
