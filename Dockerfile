FROM apify/actor-node-chrome

COPY package.json ./

RUN npm --quiet set progress=false \
    && npm install --only=prod \
    && echo "Installed NPM packages:" \
    && npm list \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version

COPY . ./
