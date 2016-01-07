FROM node
COPY . /src
WORKDIR /src
RUN npm install
EXPOSE 3000
CMD ["/src/index.js"]
