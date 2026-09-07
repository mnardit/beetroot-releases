# Third-party Notices

The following assets retain their own licenses, independently of Beetroot's license:

- `public/model/model.json` and `public/model/group1-shard1of1.bin`: copied from `@vscode/vscode-languagedetection` 1.0.23, copyright Microsoft Corporation, MIT license. The weights are unchanged; the JSON is reformatted. Full notice: [public/model/LICENSE](public/model/LICENSE).
- Fonts in `src/fonts`: Inter, Open Sans, Montserrat, Noto Sans and JetBrains Mono. Copyright notices and SIL Open Font License text: [src/fonts/OFL.txt](src/fonts/OFL.txt).
- The language-detection runtime bundles TensorFlow components. Upstream notices and the Apache 2.0 text: [public/model/RUNTIME-NOTICES.txt](public/model/RUNTIME-NOTICES.txt).

These notices are also included as readable files in the installed application's `resources` directory.

JavaScript, Rust and native component licenses and copyright notices are collected in [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt), also installed in `resources`. This includes the Microsoft WebView2 SDK loader, Rust standard library, NSIS utilities and WiX UI components. Their licenses apply to those components, independently of Beetroot's Apache 2.0 license.

The [attribution manifest](licenses/third-party.json) records versions, source URLs and original texts. It conservatively includes build-only and target-specific dependencies and the TensorFlow dependency closure from the language detector's release. Inclusion is not a claim that every listed component is linked into every package format. Contributor checks and the update procedure are in [licenses/README.md](licenses/README.md).

## MPL Components

The locked Rust dependency graph includes the following components under the [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/). Their source code and upstream notices are available at the version-specific links below. Beetroot's own license does not replace or restrict their upstream source-code licenses.

| Component        | Version | Source and Notices                                             |
| ---------------- | ------- | -------------------------------------------------------------- |
| cssparser        | 0.29.6  | [Source](https://docs.rs/crate/cssparser/0.29.6/source/)       |
| cssparser-macros | 0.6.1   | [Source](https://docs.rs/crate/cssparser-macros/0.6.1/source/) |
| dtoa-short       | 0.3.5   | [Source](https://docs.rs/crate/dtoa-short/0.3.5/source/)       |
| option-ext       | 0.2.0   | [Source](https://docs.rs/crate/option-ext/0.2.0/source/)       |
| selectors        | 0.24.0  | [Source](https://docs.rs/crate/selectors/0.24.0/source/)       |
