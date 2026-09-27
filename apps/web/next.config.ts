import type { NextConfig } from "next";

// Em produção o ingress manda /api/* para o NestJS no mesmo domínio. Em dev o rewrite
// imita isso, para o cookie dp_rt (SameSite=Strict, Path=/api/v1/auth) funcionar igual.
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` }];
  },
};

export default nextConfig;
