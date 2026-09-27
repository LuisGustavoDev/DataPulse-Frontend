import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Em produção o ingress manda /api/* para a API e /sse/* para o serviço realtime, no
// mesmo domínio. Em dev os rewrites imitam isso, para o cookie dp_rt (SameSite=Strict,
// Path=/api/v1/auth) funcionar igual. Em produção só valem se a variável for definida.
const apiOrigin = process.env.API_ORIGIN ?? (isDev ? "http://localhost:3001" : undefined);
const sseOrigin = process.env.SSE_ORIGIN ?? (isDev ? "http://localhost:3002" : undefined);

// O navegador envia as partes direto ao MinIO (ADR 03) e baixa dele o CSV de anomalias.
const storageOrigin = process.env.STORAGE_ORIGIN ?? "";

// §11.3: CSP restrita. 'unsafe-inline' em script-src é exigência do bootstrap do Next
// sem nonce; 'wasm-unsafe-eval' é para o SHA-256 do hash-wasm no Web Worker.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${storageOrigin}`.trim(),
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // As libs do monorepo são publicadas como TypeScript puro.
  transpilePackages: ["@datapulse/contracts", "@datapulse/csv-rules"],
  poweredByHeader: false,
  // A compressão gzip do servidor do Next bufferiza respostas em stream: com o rewrite
  // de /sse ativo, o EventSource do navegador (que aceita gzip) não recebia nenhum
  // evento. Em produção o ingress entrega /sse direto ao realtime e comprime o resto.
  compress: !sseOrigin,
  // O dev server gera AGENTS.md/CLAUDE.md por padrão; o projeto optou por não ter.
  agentRules: false,

  async rewrites() {
    return [
      ...(apiOrigin ? [{ source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` }] : []),
      ...(sseOrigin ? [{ source: "/sse/v1/:path*", destination: `${sseOrigin}/sse/v1/:path*` }] : []),
    ];
  },

  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    // O dev server do Next usa eval e websocket de HMR, que a CSP bloquearia.
    if (!isDev) security.push({ key: "Content-Security-Policy", value: csp });
    return [{ source: "/:path*", headers: security }];
  },
};

export default nextConfig;
