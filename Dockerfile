FROM apify/actor-node-puppeteer-chrome:16

COPY package.json ./

RUN npm --quiet set progress=false \
    && npm install --only=prod \
    && echo "Installed NPM packages:" \
    && (npm list --all) || true \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version

COPY . ./
