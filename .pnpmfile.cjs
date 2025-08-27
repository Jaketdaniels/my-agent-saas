module.exports = {
  hooks: {
    packageExtensions: {},
    readPackage(pkg) {
      // Remove unnecessary platform-specific binaries
      if (pkg.name && pkg.optionalDependencies) {
        const isMac = process.platform === 'darwin';
        const isArm64 = process.arch === 'arm64';
        
        // For Next.js SWC binaries
        if (pkg.name === 'next') {
          const swcPackages = Object.keys(pkg.optionalDependencies).filter(name => name.startsWith('@next/swc-'));
          swcPackages.forEach(swcPkg => {
            // Keep only the binary for current platform
            const shouldKeep = (isMac && isArm64 && swcPkg === '@next/swc-darwin-arm64') ||
                              (isMac && !isArm64 && swcPkg === '@next/swc-darwin-x64');
            if (!shouldKeep) {
              delete pkg.optionalDependencies[swcPkg];
            }
          });
        }
        
        // For Cloudflare workerd binaries
        if (pkg.name === 'workerd') {
          const workerdPackages = Object.keys(pkg.optionalDependencies).filter(name => name.startsWith('@cloudflare/workerd-'));
          workerdPackages.forEach(workerdPkg => {
            // Keep only the binary for current platform
            const shouldKeep = (isMac && isArm64 && workerdPkg === '@cloudflare/workerd-darwin-arm64') ||
                              (isMac && !isArm64 && workerdPkg === '@cloudflare/workerd-darwin-64');
            if (!shouldKeep) {
              delete pkg.optionalDependencies[workerdPkg];
            }
          });
        }
      }
      return pkg;
    }
  }
};