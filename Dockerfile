# Use a single stage since we're not building
FROM oven/bun:latest
WORKDIR /app

# Install OS dependencies needed for Playwright
# See: https://playwright.dev/docs/docker#system-dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package.json bun.lock ./

# Install bun dependencies
RUN bun install --frozen-lockfile

# Install Playwright browsers using bunx
# This installs them in /root/.cache/ms-playwright by default
RUN bunx playwright install --with-deps chromium

# Set path for Playwright browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

# Copy the rest of the application code needed at runtime
COPY src ./src
COPY flows ./flows

# Use the default non-root 'bun' user
USER bun

# Set the entrypoint to run the source application directly
# Arguments should be passed when running the container: 
# docker run <image_name> <url> <name> <date> <time> <guests> [--ui]
ENTRYPOINT ["bun", "run", "src/index.ts"]
