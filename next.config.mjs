// Self-hosted media server (replaces Cloudinary). Set NEXT_PUBLIC_MEDIA_BASE_URL, e.g. https://media.bakaloo.in
const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE_URL
const mediaPatterns = [{ protocol: "https", hostname: "media.bakaloo.in" }]
if (mediaBase) {
  const u = new URL(mediaBase)
  mediaPatterns.push({ protocol: u.protocol.replace(":", ""), hostname: u.hostname, ...(u.port ? { port: u.port } : {}) })
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Pre-existing lint errors in other modules should not block production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...mediaPatterns,
    ],
  },
  // Proxy API requests to backend (optional — can also use direct CORS)
  async rewrites() {
    return [
      // Uncomment below to proxy API calls through Next.js:
      // {
      //   source: "/api/v1/:path*",
      //   destination: "http://localhost:3000/api/v1/:path*",
      // },
    ];
  },
};

export default nextConfig;
