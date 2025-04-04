FROM node:20-alpine AS builder

WORKDIR /app

# 의존성 파일 복사 및 설치
COPY package*.json ./
RUN npm ci

# 소스 복사 및 빌드
COPY tsconfig.json ./
COPY src ./src

RUN npm run build
RUN chmod +x dist/index.js

FROM node:20-alpine AS release

WORKDIR /app

# 빌드된 파일과 필요한 패키지 정보 복사
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package*.json /app/

# 프로덕션 의존성만 설치
ENV NODE_ENV=production
RUN npm ci --omit=dev

# 실행 설정
ENTRYPOINT ["node", "/app/dist/index.js"]

# 환경 변수 기본값 설정 (실행 시 오버라이드 가능)
ENV SYNO_HOST=localhost
ENV SYNO_PORT=5000
ENV SYNO_USER=""
ENV SYNO_PASS=""
