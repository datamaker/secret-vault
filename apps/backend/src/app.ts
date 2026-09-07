import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import routes from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();

// Trust proxy (nginx)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// 웹 UI 를 같은 프로세스에서 서빙하므로 브라우저 입장에선 한 출처다 — CORS 를
// 탈 일이 없다. CORS_ORIGIN 을 준 경우에만 켠다(vite dev 서버로 따로 띄울 때).
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development',
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check — 컨테이너 헬스체크는 사내 서비스 전부 /healthz 로 맞춘다.
app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1', routes);

/**
 * 웹 UI.
 *
 * 예전에는 nginx 컨테이너가 정적 파일을 서빙하고 /api 를 여기로 프록시했다.
 * 프런트가 이미 상대경로(/api/v1)를 쓰고 있어서 한 이미지로 합쳐도 브라우저가
 * 보는 것은 그대로다 — 프록시 한 단계와 이미지 하나가 없어진다.
 *
 * 빌드 산출물이 없으면(개발 중 vite 를 따로 띄우는 경우) 아무것도 하지 않는다.
 */
const webDir = process.env.VAULT_WEB_DIR || path.resolve(__dirname, '../public');

if (existsSync(path.join(webDir, 'index.html'))) {
  // 파일명에 해시가 붙으므로 내용이 바뀌면 주소도 바뀐다 — 영구 캐시해도 안전하다.
  app.use(
    express.static(webDir, {
      index: false,
      maxAge: '1y',
      immutable: true,
      setHeaders(res, filePath) {
        // index.html 만은 캐시하면 안 된다. 새 배포를 영영 못 받는다.
        if (path.basename(filePath) === 'index.html') {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  // SPA 라우팅 — 주소창에 /projects/123 을 직접 쳐도 index.html 을 준다.
  // /api 는 제외한다. 없는 API 는 SPA 가 아니라 404 JSON 이어야 한다.
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    if (req.method !== 'GET') return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(webDir, 'index.html'));
  });
}

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
