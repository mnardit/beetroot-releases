import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";

const repoRoot = cwd();

function readRepoFile(path) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("release hygiene", () => {
  it.each(["save_image", "db_upsert_image_item", "local_ai_chat", "get_jobs"])(
    "does not register the retired %s command",
    (command) => {
      const lib = readRepoFile("src-tauri/src/lib.rs");
      expect(lib).not.toContain(`commands::${command},`);
    },
  );

  it("keeps shell scripts LF regardless of contributor Git settings", () => {
    expect(readRepoFile(".gitattributes")).toMatch(/^\*\.sh text eol=lf$/m);
    for (const path of ["scripts/pre-release-check.sh", "packaging/msix/build-msix.sh"]) {
      expect(readRepoFile(path), path).not.toContain("\r");
    }
  });

  it("keeps native AI notifications in the active build profile", () => {
    const jobs = readRepoFile("src-tauri/src/jobs.rs");
    expect(jobs).toContain("Toast::new(crate::build_profile::identifier())");
    expect(jobs).not.toContain('Toast::new("com.beetroot.desktop")');
  });

  it("ships project and vendored asset licenses as readable installer resources", () => {
    const config = JSON.parse(readRepoFile("src-tauri/tauri.conf.json"));
    const resources = {
      "../LICENSE": "resources/LICENSE",
      "../NOTICE": "resources/NOTICE",
      "../THIRD_PARTY_NOTICES.md": "resources/THIRD_PARTY_NOTICES.md",
      "../THIRD_PARTY_LICENSES.txt": "resources/THIRD_PARTY_LICENSES.txt",
      "../src/fonts/OFL.txt": "resources/src/fonts/OFL.txt",
      "../public/model/LICENSE": "resources/public/model/LICENSE",
      "../public/model/RUNTIME-NOTICES.txt": "resources/public/model/RUNTIME-NOTICES.txt",
    };
    expect(config.bundle.resources).toEqual(resources);
    for (const source of Object.keys(resources)) {
      expect(readRepoFile(`src-tauri/${source}`).trim().length).toBeGreaterThan(0);
    }
    expect(readRepoFile("src/fonts/OFL.txt")).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(readRepoFile("public/model/LICENSE")).toContain("MIT License");
    const modelDirectory = "node_modules/@vscode/vscode-languagedetection/dist/lib";
    const upstreamNotices = readdirSync(resolve(repoRoot, modelDirectory)).filter((name) =>
      name.endsWith(".LICENSE.txt"),
    );
    expect(upstreamNotices.length).toBeGreaterThan(0);
    const shippedNotices = readRepoFile("public/model/RUNTIME-NOTICES.txt").replace(/\r\n/g, "\n");
    for (const notice of upstreamNotices) {
      expect(shippedNotices).toContain(
        readRepoFile(`${modelDirectory}/${notice}`).replace(/\r\n/g, "\n").trim(),
      );
    }
  });

  it("declares Apache-2.0 with author attribution and no extra license restrictions", () => {
    const pkg = JSON.parse(readRepoFile("package.json"));
    const lock = JSON.parse(readRepoFile("package-lock.json"));
    expect(pkg.license).toBe("Apache-2.0");
    expect(lock.packages[""].license).toBe(pkg.license);
    expect(readRepoFile("src-tauri/Cargo.toml")).toMatch(/^license = "Apache-2.0"$/m);

    const license = readRepoFile("LICENSE");
    expect(license).toContain("Version 2.0, January 2004");
    expect(license).toContain("END OF TERMS AND CONDITIONS");
    expect(license).not.toMatch(/Commons Clause|Proprietary License/);
    expect(readRepoFile("NOTICE")).toContain("Copyright 2026 Max Nardit");
    expect(readRepoFile("NOTICE")).toContain("https://max.nardit.com");
    expect(readRepoFile("TERMS.md")).toContain(
      "If this document conflicts with that license, the license controls.",
    );

    for (const name of readdirSync(repoRoot).filter((name) =>
      /^README(?:\.[a-z]+)?\.md$/.test(name),
    )) {
      const readme = readRepoFile(name);
      expect(readme, name).toContain("[Apache License 2.0](LICENSE)");
      expect(readme, name).toContain("[NOTICE](NOTICE)");
    }
  });

  it("pins package-manager license URLs to a commit or release tag", () => {
    for (const path of [
      "packaging/winget/MNardit.Beetroot.locale.en-US.yaml",
      "packaging/chocolatey/beetroot.nuspec",
    ]) {
      const manifest = readRepoFile(path);
      expect(manifest, path).not.toContain("/blob/main/LICENSE");
      expect(manifest, path).toMatch(/\/blob\/(?:[a-f0-9]{40}|v\d+\.\d+\.\d+)\/LICENSE/);
    }
  });

  it.each([
    [
      "1.6.7",
      "https://github.com/mnardit/beetroot-releases/releases/download/v1.6.7/Beetroot_1.6.7_x64-setup.exe",
    ],
    [
      "2.0.0",
      "https://github.com/mnardit/beetroot-releases/releases/download/v2.0.0/Beetroot_2.0.0_x64-setup.exe",
    ],
  ])(
    "resolves Scoop autoupdates for %s to the release tag and installer offline",
    (version, expectedUrl) => {
      const manifest = JSON.parse(readRepoFile("packaging/scoop/beetroot.json"));
      const nextUrl = manifest.autoupdate.architecture["64bit"].url.replaceAll("$version", version);

      expect(nextUrl).toBe(expectedUrl);
    },
  );

  it("builds fork PRs without signing secrets", () => {
    const ci = readRepoFile(".github/workflows/ci.yml");
    expect(ci).toContain("workflow_call:");
    expect(ci).toContain("--config src-tauri/tauri.unsigned.conf.json");
    expect(ci).not.toContain("secrets.");
    expect(ci).not.toContain("pull_request_target");
    const config = JSON.parse(readRepoFile("src-tauri/tauri.unsigned.conf.json"));
    expect(config.bundle.createUpdaterArtifacts).toBe(false);
    expect(config.plugins).toBeUndefined();
    expect(config.identifier).toBeUndefined();
  });

  it("gates release signing on checks and produces a draft in the current repository", () => {
    const workflow = readRepoFile(".github/workflows/release.yml");
    expect(workflow).toContain("uses: ./.github/workflows/ci.yml");
    expect(workflow).toContain("needs: checks");
    expect(workflow).toContain("environment: release");
    expect(workflow).toContain("RELEASE_TAG: ${{ github.ref_name }}");
    expect(workflow).toContain("$tag = $env:RELEASE_TAG");
    expect(workflow).toContain("$v = $env:RELEASE_TAG");
    expect(workflow).not.toMatch(/\$(?:tag|v)\s*=\s*["']\$\{\{\s*github\.ref_name/);
    expect(workflow).toContain("secrets.GITHUB_TOKEN");
    expect(workflow).not.toContain("RELEASE_REPO_TOKEN");
    expect(workflow).not.toMatch(/^\s+(owner|repo):/m);
    expect(workflow).toContain("releaseDraft: true");
    expect(workflow).toContain("updaterJsonPreferNsis: true");
  });

  it("keeps release preparation local and has no bypass switches", () => {
    const script = readRepoFile("scripts/release.sh");
    expect(script).toContain("bash scripts/pre-release-check.sh");
    expect(script).toContain('node scripts/prepare-version.mjs "$VERSION"');
    expect(script).not.toMatch(
      /git\s+(push|commit)|gh\s+release|--skip-build|--publish|PRE_CHECK_SKIP/,
    );
    expect(script).not.toContain("TAURI_SIGNING_PRIVATE_KEY");
  });

  it("uses the same formatting, attribution and coverage gates locally and in CI", () => {
    const pkg = JSON.parse(readRepoFile("package.json"));
    const preflight = readRepoFile("scripts/pre-release-check.sh");
    const ci = readRepoFile(".github/workflows/ci.yml");
    expect(pkg.scripts.format).toBe("prettier --write .");
    expect(pkg.scripts["format:check"]).toBe("prettier --check .");
    for (const script of ["format:check", "check:licenses", "check:model", "test:coverage"]) {
      expect(preflight, script).toContain(`npm run ${script}`);
      expect(ci, script).toContain(`npm run ${script}`);
    }
    expect(preflight).toContain("set -euo pipefail");
    expect(preflight).not.toMatch(/\|\|\s*true|--skip|PRE_CHECK_SKIP/);
  });

  it("keeps the MSIX source manifest version in sync with package.json", () => {
    const pkg = JSON.parse(readRepoFile("package.json"));
    const manifest = readRepoFile("packaging/msix/AppxManifest.xml");

    expect(manifest).toMatch(new RegExp(`Version="${pkg.version}\\.0"`));
  });

  it("preserves Windows SDK switches in Git Bash and passes native output paths", () => {
    const script = readRepoFile("packaging/msix/build-msix.sh");
    expect(script).toContain('MSYS2_ARG_CONV_EXCL="*" "$MAKEPRI" createconfig');
    expect(script).toContain('MSYS2_ARG_CONV_EXCL="*" "$MAKEPRI" new');
    expect(script).toContain('MSYS2_ARG_CONV_EXCL="*" "$MAKEAPPX" pack');
    expect(script).toContain('/d "$(cygpath -w "$MSIX_STAGING")"');
    expect(script).toContain('/p "$(cygpath -w "$OUTPUT")"');
    expect(script).toContain("Add-AppPackage -Path '$(cygpath -w \"$OUTPUT\")'");
  });

  it("patches and verifies the staged MSIX manifest version during packaging", () => {
    const script = readRepoFile("packaging/msix/build-msix.sh");

    expect(script).toContain('STAGED_MANIFEST="$MSIX_STAGING/AppxManifest.xml"');
    expect(script).toContain('Version=\\"$VERSION\\"');
    expect(script).toContain("MANIFEST_VERSION=");
    expect(script).toContain("Manifest version matches: $VERSION");
  });

  it("bumps the source MSIX manifest in the release script", () => {
    const script = readRepoFile("scripts/release.sh");

    expect(script).toContain("packaging/msix/AppxManifest.xml");
    expect(script).toContain('MSIX_VERSION="${VERSION}.0"');
    expect(script).toContain('Version=\\"$MSIX_VERSION\\"');
  });

  it("documents real MSIX sideloading for Store autostart verification", () => {
    const docs = readRepoFile("packaging/msix/README.md");
    const localTesting = docs.slice(
      docs.indexOf("## Local Testing"),
      docs.indexOf("## Store vs EXE Differences"),
    );

    expect(localTesting).toContain("Add-AppPackage -Path");
    expect(localTesting).toContain("(Get-Process Beetroot).Path");
    expect(localTesting).not.toMatch(/Add-AppxPackage\s+-Register/);
  });

  it("MSIX manifest patcher only updates Identity Version, not MinVersion or MaxVersionTested", () => {
    const manifest = readRepoFile("packaging/msix/AppxManifest.xml");
    const buildScript = readRepoFile("packaging/msix/build-msix.sh");
    const releaseScript = readRepoFile("scripts/release.sh");

    const originalMinMatch = manifest.match(/MinVersion="([^"]+)"/);
    const originalMaxMatch = manifest.match(/MaxVersionTested="([^"]+)"/);
    if (!originalMinMatch || !originalMaxMatch) {
      throw new Error(
        "AppxManifest.xml is missing MinVersion or MaxVersionTested — the manifest fixture changed shape.",
      );
    }
    const originalMin = originalMinMatch[1];
    const originalMax = originalMaxMatch[1];

    // Extract the sed substitution that targets either the staged or source AppxManifest.xml.
    // Accepts either an unanchored "s/.../.../" or an addressed "/<Identity/,/\/>/ s/.../.../".
    const findManifestSed = (script, label, target) => {
      const targetRe = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        `sed -i\\s+(?:-E\\s+)?"((?:\\/[^/"\\\\]*(?:\\\\.[^/"\\\\]*)*\\/,\\/[^/"\\\\]*(?:\\\\.[^/"\\\\]*)*\\/\\s+)?s\\/[^"\\\\]*(?:\\\\.[^"\\\\]*)*\\/[^"\\\\]*(?:\\\\.[^"\\\\]*)*\\/)"\\s+${targetRe}`,
      );
      const m = script.match(re);
      if (!m) throw new Error(`No sed pattern found targeting ${target} in ${label}`);
      return m[1];
    };

    // Emulate sed line-by-line. Without /g, sed replaces only the first match per
    // line. With an address range "/A/,/B/", sed only applies the substitution to
    // lines from the first match of A through the next match of B (inclusive).
    const applySed = (text, sedExpr, version) => {
      const rangeMatch = sedExpr.match(/^\/([^/]+)\/,\/([^/]+)\/\s+s\/([^/]+)\/([^/]+)\/$/);
      const plainMatch = sedExpr.match(/^s\/([^/]+)\/([^/]+)\/$/);

      let inRange = false;
      let startRe;
      let endRe;
      let fromRe;
      let to;

      if (rangeMatch) {
        startRe = new RegExp(rangeMatch[1].replace(/\\\//g, "/"));
        endRe = new RegExp(rangeMatch[2].replace(/\\\//g, "/"));
        fromRe = new RegExp(rangeMatch[3].replace(/\\"/g, '"'));
        to = rangeMatch[4].replace(/\\"/g, '"').replace(/\$VERSION/g, version);
      } else if (plainMatch) {
        fromRe = new RegExp(plainMatch[1].replace(/\\"/g, '"'));
        to = plainMatch[2].replace(/\\"/g, '"').replace(/\$VERSION/g, version);
      } else {
        throw new Error(`Unsupported sed expression shape: ${sedExpr}`);
      }

      return text
        .split("\n")
        .map((line) => {
          if (rangeMatch) {
            if (!inRange && startRe.test(line)) inRange = true;
            const apply = inRange;
            if (inRange && endRe.test(line)) inRange = false;
            return apply ? line.replace(fromRe, to) : line;
          }
          return line.replace(fromRe, to);
        })
        .join("\n");
    };

    const buildSed = findManifestSed(buildScript, "build-msix.sh", '"$STAGED_MANIFEST"');
    const releaseSed = findManifestSed(
      releaseScript,
      "release.sh",
      "packaging/msix/AppxManifest.xml",
    ).replace(/\$MSIX_VERSION/g, "$VERSION");

    for (const [label, sedExpr] of [
      ["build-msix.sh", buildSed],
      ["release.sh", releaseSed],
    ]) {
      const patched = applySed(manifest, sedExpr, "9.9.9.0");
      // Identity Version must be updated.
      expect(patched, `${label}: Identity Version`).toMatch(/^\s+Version="9\.9\.9\.0"$/m);
      // MinVersion must be preserved verbatim — the regression we are
      // guarding against was sed corrupting it. Use the value extracted
      // from the source manifest so a legitimate Windows-floor bump does
      // not break this test.
      expect(patched, `${label}: MinVersion preserved`).toContain(`MinVersion="${originalMin}"`);
      expect(patched, `${label}: MaxVersionTested preserved`).toContain(
        `MaxVersionTested="${originalMax}"`,
      );
    }
  });

  it("the MSIX README does not document a manual MakeAppx path that bypasses build-msix.sh", () => {
    const docs = readRepoFile("packaging/msix/README.md");
    // Manual MakeAppx invocations bypass the version patcher and the
    // TargetDeviceFamily preservation guard in build-msix.sh, re-introducing
    // the stale-manifest regression the sed fix closed.
    expect(docs).not.toMatch(/MakeAppx\.exe[\s\S]*?\bpack\b/);
    // The hardcoded sample filename indicated a stale package recipe. Even if
    // someone re-adds the recipe with a wildcard, this catches the original
    // shape.
    expect(docs).not.toMatch(/Beetroot_\d+\.\d+\.\d+\.\d+_x64\.msix/);
  });
});
