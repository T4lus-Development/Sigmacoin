FROM node:6

VOLUME /sigmacoin

WORKDIR /sigmacoin

ENTRYPOINT node bin/sigmacoin.js

EXPOSE 3001