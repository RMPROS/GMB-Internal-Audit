/** @type {import('next').NextConfig} */
const nextConfig = {
  // This project uses Pages Router only — no App Router
  reactStrictMode: true,
  // Disable Next.js telemetry during build
  env: {
    NEXT_TELEMETRY_DISABLED: '1',
  },
};
module.exports = nextConfig;
