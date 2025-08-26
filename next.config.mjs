import withBundleAnalyzer from '@next/bundle-analyzer';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
initOpenNextCloudflareForDev();


/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  eslint: {
    ignoreDuringBuilds: process.env.SKIP_LINTER === 'true'
  },
  typescript: {
    ignoreBuildErrors: process.env.SKIP_LINTER === 'true'
  },
  webpack: (config, { nextRuntime }) => {
    // Avoid bundling Cloudflare runtime-only modules in Next's webpack build
    // so that OpenNext/Wrangler can handle them later for the Worker build.
    if (nextRuntime === 'edge') {
      const externals = config.externals || [];
      externals.push(({ request }, callback) => {
        if (
          request &&
          (
            request.startsWith('cloudflare:') ||
            request === '@cloudflare/sandbox' ||
            request.startsWith('@cloudflare/containers')
          )
        ) {
          // Treat as a module external so the import stays for Wrangler/workerd to handle.
          return callback(null, `module ${request}`);
        }
        callback();
      });
      config.externals = externals;
    }
    return config;
  }
};

export default process.env.ANALYZE === 'true'
  ? withBundleAnalyzer()(nextConfig)
  : nextConfig;
