import type { NextConfig } from "next";

// EPUB uploads go up to 50 MB (features/couple/books.ts); 1 MB covers the multipart overhead.
const uploadLimit = "51mb";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: uploadLimit },
    proxyClientMaxBodySize: uploadLimit,
  },
};

export default nextConfig;
