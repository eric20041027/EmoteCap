# Native Rust source and licensing evidence

Inspected the actual prepared Windows payload and clean sourcefbba5631027d91e102ebb3d301ac484c0d158566. This read-only increment produced [portable public source-evidence records](../../../third_party/rust-source-evidence.json). It does not approve redistribution, enumerate every linked binary dependency, change application/package code or adopt a project LICENSE. Existing corrected candidatef9d5fc2remains source-specific qualified material.

## Verified published inputs

All10production DLL/PYD entries were independently rehashed against the original prepared receipt. Three contain Rust source/version markers. Exact official wheels and source distributions were downloaded from the URLs already pinned in server/uv.lock, checked against its SHA256/size and the versioned PyPIregistry metadata. Every native member in those three wheels matches the actually shipped native bytes. No archive source or native dependency was executed.

| Distribution | Native input | Version tokens observed | Frozen source-lock registry packages |
|---|---|---|---|
| cryptography50.0.1 | deps/cryptography/hazmat/bindings/_rust.pyd, SHA2566a422629…b2a2 |11 |32 |
| pydantic-core2.46.5 | deps/pydantic_core/_pydantic_core.cp312-win_amd64.pyd, SHA25628fd1266…558b |26 |103 |
| watchfiles1.3.0 | deps/watchfiles/_rust_notify.pyd, SHA256ab938b66…5962 |10 |46 |

The versioned [cryptography documentation](https://cryptography.io/en/50.0.1/installation/) describes its Windows wheel as statically linked. The three published wheels supply their outer project licensing texts; they do not supply the collected crate-level corpus below. PyPIversioned primary records: [cryptography50.0.1](https://pypi.org/project/cryptography/50.0.1/), [pydantic-core2.46.5](https://pypi.org/project/pydantic-core/2.46.5/), [watchfiles1.3.0](https://pypi.org/project/watchfiles/1.3.0/).

Native markers are positive observations; stripped or absent strings do not prove a dependency is absent. The other seven production extensions have no marker under the bounded crate/version pattern used here. That result does not clear their separate C/native/vendor obligations. Private build paths were neither printed nor committed; retained observation records contain only crate/version tokens, known native records and public Rust compiler source commits.

## Rust standard-library correspondence

Each native extension also contains a Rust compiler-source commit. Cryptography and pydantic-core identify88d9e12ae178fab0fb5cc050a94da85685d449ea; watchfiles identifies48a229ceaefd4985c50990b14116b6d856af0985. At both official [Rust repository commits](https://github.com/rust-lang/rust/tree/88d9e12ae178fab0fb5cc050a94da85685d449ea), exact root LICENSE-MIT/LICENSE-APACHE/COPYRIGHT, root Cargo.lock, library/Cargo.lock and selected library manifests/backtrace source were retained with SHA256. All20requested public files were available and byte-verified.

Hashbrown0.17.1andrustc-demangle0.1.27appear in all three native files but not in those projects' Cargo locks. Their exact versions/checksums are present in the corresponding Rustlibrary/Cargo.lock. Combining the project and standard-library source locks maps all39distinct observed native crate/version tokens. This association does not authenticate the full compiler build or establish a complete selected-feature dependency graph.

## Collected source licensing material

The project locks contain169distinct registry package/version pairs. Adding the two Rustlibrarylocks yields196unique pairs. The checksum-pinned archives were read directly from static.crates.io without extracting executable/source trees or installing Cargo/Rust. Combined archives total27,000,974bytes.

-196archive SHA256values match the corresponding source locks.
-192archives supply358license/notice/copyright/authorship text files totaling1,855,940bytes. Every saved text's length/SHA256and original archive-member bytes were independently rechecked. Repeated text bytes were retained as supplied;103distinct text digests occur in this corpus.
-All39observed native tokens map to archives with supplied licensing text.
-Four additional source-lock entries contain licensing declarations but no supplied license text: fortanix-sgx-abi0.6.1, vex-sdk0.27.1, wasip11.0.0andwit-bindgen-rt0.39.0. Their normalized manifests and exact archives remain retained; no substitute license text was invented. None is in the observed native-token set; that alone is not proof they are unlinked.

The corpus is a source-lock superset containing build/development/other-target dependencies. Declared expressions include Unicode conjunctive terms, LLVM exceptions, MPL2and multiple alternative-license expressions. Preserve the original expressions and attribution/source requirements; do not silently rewrite them all to MIT/Apache. The [Cargo metadata documentation](https://doc.rust-lang.org/cargo/commands/cargo-metadata.html) distinguishes declared license/license-file metadata and resolved dependency/feature data. Cargo/rustc were unavailable on this host, so no feature/platform resolution or rebuilt-wheel comparison is claimed.

## Decisions and next integration

- Ruling: freeze official source/wheel URLs and hashes from the existing server lock; compare actual native members against official wheel bytes — cost if wrong: any hash/version mismatch requires new assessment rather than associating a same-named source release.
- Ruling: include standard-library source locks in research when native markers identify their commits — cost if wrong: the positive39token correspondence remains evidence only; it cannot replace full build provenance or a selected-feature graph.
- Ruling: retain the entire196entry source-lock superset as research with explicit scope — cost if wrong: future notices must distinguish source-evidence coverage from actual linked dependencies and cannot claim all196ship in Windows.
- Ruling: retain the four manifest-only cases as unresolved material; do not infer absence from missing binary strings — cost if wrong: complete corresponding attribution/source obligations need supplier/source/target evidence before that subset can be cleared.
- Ruling: keep the research corpus outside the current committed116text candidate inventory and current package — cost if wrong: this turn does not satisfy recipient delivery of the newly collected Rust material; package integration must be a separately tested increment.

The current material inventory remains47components/116texts/54native/9SDKprebuilt, and every existing license/pin/candidate byte is unchanged. Adding358crate texts plus the six compiler LICENSE/COPYRIGHTcopies would yield480texts, within the existing512text ceiling; actual integration must retain unique ownership, exact source pins, component/version/license-byte correspondence and clear source-access notices for applicable source forms. The 480count is a prospective integration count, not a current candidate count.

Next implementation should copy verified material, bind a portable source-evidence manifest to the current native and source pins, and test changed/foreign/omitted licensing pointers, native mismatch, aggregate budgets and copied/staged correspondence before rebuilding the internal candidate. It must preserve the explicit incomplete linked-component/SDK/Microsoft/owner assessment. Unity activation, authorized actors/physical camera/target laptop/two rigs/clean-machine/new-user/publication remain separate outstanding gates.

Ignored evidence is retained under `.superpowers/sdd/2026-10-08-native-rust-assessment-f920e922/`: native observations, lock pins, three source archives/wheels/registry records and exact member comparison, two compiler source snapshots,196crate archives/receipts,358original text copies, aggregate inventories and independent byte-verification results. No API/provider/camera/GPU/Unity process was run or stopped, no system runtime installed, no external message sent and no public write performed.

Final publication-data check: all196portable archive records and358text hashes match retained sources; all116current candidate texts and the five existing context pins are unchanged; actual existing material admission still reports3certifi forms/14sources/1native binding. All46local links in the four affected documents resolve. Only public source-evidence JSON and documentation are changed; existing830backend/qualifiedf9d5fc2evidence is retained without claiming a new runtime or package test.
