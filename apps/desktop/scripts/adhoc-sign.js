'use strict';

/**
 * electron-builder afterPack hook: deep ad-hoc code signing for macOS.
 *
 * We don't have an Apple Developer ID certificate, so `mac.identity` is null and
 * electron-builder skips signing entirely. That leaves the .app with only the
 * linker's ad-hoc signature on the main executable — a bundle that claims sealed
 * resources but has none. Gatekeeper reports that bundle as "damaged and can't be
 * opened", which is a dead end for the user.
 *
 * A real ad-hoc signature (`codesign -s -`) seals the bundle properly. It is still
 * unnotarized, so a downloaded copy shows "Apple could not verify ..." — but that
 * dialog has an "Open Anyway" path in System Settings > Privacy & Security, and the
 * app runs normally from then on.
 *
 * Signing must happen bottom-up: nested Mach-O binaries first, then nested bundles
 * deepest-first, then the outer .app last. Signing a parent seals whatever its
 * children look like at that moment, so any later change to a child breaks the seal.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const MACHO_MAGIC = new Set([
  0xfeedface, 0xcefaedfe, // 32-bit
  0xfeedfacf, 0xcffaedfe, // 64-bit
  0xcafebabe, 0xbebafeca, // universal / fat
]);

function isMachO(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const head = Buffer.alloc(4);
    if (fs.readSync(fd, head, 0, 4, 0) < 4) return false;
    return MACHO_MAGIC.has(head.readUInt32BE(0));
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** Collect nested bundles and loose Mach-O binaries, skipping symlinks. */
function collect(dir, found) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name.endsWith('.app') || entry.name.endsWith('.framework')) {
        found.bundles.push(full);
      }
      collect(full, found);
    } else if (entry.isFile() && isMachO(full)) {
      found.binaries.push(full);
    }
  }
  return found;
}

/** Frameworks are signed at Versions/A, not at the .framework wrapper. */
function signTarget(bundle) {
  if (!bundle.endsWith('.framework')) return bundle;
  const versionA = path.join(bundle, 'Versions', 'A');
  return fs.existsSync(versionA) ? versionA : bundle;
}

const byDepthDesc = (a, b) => b.split(path.sep).length - a.split(path.sep).length;

function codesign(target) {
  execFileSync('codesign', ['--force', '--sign', '-', '--timestamp=none', target], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
}

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );
  if (!fs.existsSync(appPath)) {
    throw new Error(`adhoc-sign: no app bundle at ${appPath}`);
  }

  // Finder metadata and resource forks make codesign refuse to sign.
  execFileSync('xattr', ['-cr', appPath]);

  const { bundles, binaries } = collect(appPath, { bundles: [], binaries: [] });
  const targets = [
    ...binaries.sort(byDepthDesc),
    ...bundles.sort(byDepthDesc).map(signTarget),
    appPath,
  ];

  for (const target of targets) {
    try {
      codesign(target);
    } catch (err) {
      const detail = err.stderr ? err.stderr.toString().trim() : err.message;
      throw new Error(`adhoc-sign: failed on ${path.relative(appPath, target) || '.'}\n${detail}`);
    }
  }

  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath]);
  console.log(`  • ad-hoc signed ${targets.length} items, signature verified`);
};
