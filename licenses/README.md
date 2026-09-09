# Third-party Attribution

`third-party.json` is the reviewed source/version inventory and deduplicated upstream license texts. `../THIRD_PARTY_LICENSES.txt` is its generated, readable distribution artifact. Generation omits trailing spaces and tabs without changing the original inventory texts or their hashes. Neither changes Beetroot's Apache 2.0 license.

## Normal Checks

```sh
npm run check:licenses
npm run build
```

The first command is offline and needs only Node. It verifies the inventory, original text hashes, dependency fingerprints, licensed assets and generated notice file. Vite additionally checks the actual rendered npm modules, including nested versions and packages marked `dev` in package-lock. A Beetroot-only version bump does not invalidate the dependency fingerprints.

Use `npm run build:desktop -- --config src-tauri/tauri.unsigned.conf.json -- --locked` for an unsigned Windows candidate. This wraps the ordinary Tauri build and verifies the actual native dependency graph, Rust version, WebView2 static loader and downloaded installer components before succeeding. Cargo metadata may download missing locked packages on a fresh machine, including development dependencies not fetched by the release build. CI and the release action use this wrapper; failed native attribution prevents the release action from uploading build artifacts. Development through `npm run tauri dev` is unchanged.

## Dependency Changes

1. Review the dependency diff, including transitive packages and prebundled code. Keep the Windows MSVC target in scope. The existing Cargo inventory deliberately includes a conservative normal/build metadata closure; not every listed crate is linked into the executable.
2. Update the affected `components` in `third-party.json` with their exact ecosystem/name/version, declared license, version-specific source URL and applicable notice IDs. For new notice texts, preserve the upstream wording and copyright statements, normalize CRLF to LF, trim boundary whitespace and set the ID to the SHA-256 of that UTF-8 text. Record the original versioned source URL in `sources`. Shared identical texts may be reused.
3. Preserve obligations joined by `AND` and any upstream NOTICE files. Where alternatives are offered, retain the original alternatives or explicitly document the one used. A scanner's generic MIT/BSD copyright template is not a replacement for a real upstream notice. The current declaration-based exceptions are explicitly identified inside their notice text; do not extend those exceptions without checking the published source and recorded commit.
4. Run `cargo fetch --locked --target x86_64-pc-windows-msvc --manifest-path src-tauri/Cargo.toml`, then `npm run licenses:write -- --refresh-inputs`. Refresh checks the current npm production graph and conservative Cargo metadata closure before recording fingerprints. It does not decide legal compatibility or silently fetch missing license texts.
5. Run `npm run check:licenses`, `npm test`, `npm run build` and the desktop build. Review the generated notice diff. Do not replace a failed check by blindly changing a fingerprint.

For a notice-only correction, use `npm run licenses:write` without refreshing inputs. No scanner or extra global Node dependency is required for the normal workflow. An optional discovery tool is cargo-about 0.9.2; its output still needs review against original files and source headers.

## Assets And Native Components

- Font/model changes require reviewing their upstream rights and updating `assets` hashes. Text asset hashes normalize CRLF to LF; binary hashes do not. Keep the existing font, model and model-runtime license files.
- The ML inventory conservatively follows TensorFlow dependencies from vscode-languagedetection 1.0.23's [release lockfile](https://github.com/microsoft/vscode-languagedetection/blob/db2a0c35fe36d0fc2f658169b838b68708ff58d3/package-lock.json). It includes type/build-only packages, not a claim that all modules survive bundling. Original runtime notices and seedrandom source-header notices are retained.
- Rust is pinned by `rust-toolchain.toml` and the workflows. A toolchain update must also refresh its standard-library copyright/license material and `native.rust`; changing just a version string is insufficient.
- Native hashes identify the exact WebView2 loader, NSIS stub/plugins, Tauri helper and WiX UI extension used by the current Windows build. They were matched against upstream artifacts pinned by Tauri CLI 2.10.0. An installer-toolchain update needs a separate notice/source/hash review.
- The NSIS helper's upstream release has no Cargo.lock. Its versioned binary and source commit are pinned; the dependency ranges are recorded honestly rather than presented as exact resolved versions. Applicable semver/windows and Rust library notices are included conservatively.
- MPL sources and native installer sources are available through the version-specific URLs in the notice bundle. Keep these links available to recipients and retain a source archive with private release evidence. The NSIS LZMA linking exception and WiX's generated-output clarification do not relicense Beetroot.

## Distribution Check

Every distributed NSIS/MSI/MSIX must contain readable `resources/THIRD_PARTY_LICENSES.txt` matching the checked source artifact, alongside LICENSE, NOTICE and the existing font/model notices. Inspect the final packages without installing them on a production machine. MSIX uses the same resource tree; package inspection does not substitute for native installation/startup testing.
