/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["xlsx"],
  // FastComet shared hosting enforces a low per-account process limit.
  // Keep production builds inside that limit without changing runtime logic.
  experimental: {
    cpus: 1,
    webpackBuildWorker: false,
  },
};

export default nextConfig;
