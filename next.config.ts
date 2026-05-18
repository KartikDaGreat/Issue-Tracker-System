import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./src/generated/prisma/*.so.node"],
  },
};

export default nextConfig;
