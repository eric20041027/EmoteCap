# Portable Project Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce portable, bounded .emotecap backups and restore them without overwriting existing work or implicitly retaining source video.

**Architecture:** A strict archive manifest and existing project parser define data; a ZIP adapter bounds lazy input reads and streaming decoded output. Export/decode are pure with respect to IndexedDB. UI supplies media sources and installs only a fully validated result.

**Tech Stack:** Existing TypeScript/Vitest, Blob/Web Streams, pinned @zip.js/zip.js 2.23.0.

**Spec:** docs/superpowers/specs/2026-10-07-project-archive-design.md

## Global Constraints

- Schema1, contractv2; all approved domain limits remain unchanged.
- 512 MiB input and total decoded; 256 MiB project JSON; 64 KiB manifest; 22 entries; 100 MiB media/take, 200 MiB/project.
- 64 KiB decoder chunks, 128 KiB maximum input read request, 30-second timeout. Limits can only decrease.
- Optional source inclusion defaults off; importing source data never implies browser retention or cloud consent.
- Runtime dependency exact @zip.js/zip.js 2.23.0; preserve all existing package records.
- No remote push, main integration or publication. Full M1–M5 goal remains active.

## Review Focus

1. A forged size or many central-directory records must fail before unbounded allocation/extraction.
2. Invalid UTF-8, duplicated/traversal/overlapping entries and mismatched local filenames must never install data.
3. A cancelled/failed import must leave the existing project and original source untouched.
4. Include-source backup must work when the source is only in memory; import must require a separate retention choice.
5. A recovered checkpoint must keep its original frames and stable take/clip identities within a new project namespace.

---

### Task 1: Versioned bounded ZIP export and decode

**Files:** Create `web/src/project/archive/limits.ts`, `operation.ts`, `json.ts`, `zip.ts`, `manifest.ts`, `codec.ts`, `codec.test.ts`; modify `web/package.json`, `web/package-lock.json`.

**Interfaces:**
- Consumes `parseProject`, `recoverProject`, frozen ProjectDocument, and MediaDescriptor from the approved storage foundation.
- `ArchiveMediaSource {name:string;blob:Blob}`; `ArchiveLimits {fileBytes:number;jsonBytes:number;manifestBytes:number;decodedBytes:number;entries:number;readBytes:number}`.
- `archiveLimits(overrides?:Partial<ArchiveLimits>):Readonly<ArchiveLimits>` rejects raised/invalid limits; exports frozen hard defaults.
- `writeZip(entries:ReadonlyMap<string,Blob>,limits,signal?:AbortSignal):Promise<Blob>`.
- `readZip(blob:Blob,limits,signal?:AbortSignal):Promise<ReadonlyMap<string,Blob>>` validates names, entry sizes/counts/compression/encryption and actual decoded totals; no writes outside memory.
- `parseManifest(value:unknown)` strictly validates the six fields and each `{takeId,path}` tuple, schema/contract/paths/duplicate IDs.
- `encodeProject(project,{includeMedia?:boolean,readMedia?:(takeId:string)=>Promise<ArchiveMediaSource|null>,signal?:AbortSignal,limits?:Partial<ArchiveLimits>}={}):Promise<Blob>`.
- `decodeProject(blob,{signal?:AbortSignal,limits?:Partial<ArchiveLimits>}={}):Promise<{project:ProjectDocument;media:ReadonlyMap<string,ArchiveMediaSource>}>` creates a new namespace, recovers checkpoints and clears retention flags.
- `ProjectArchiveError` distinguishes invalid/corrupt/limit/cancelled/missing-media without exposing raw payloads.

- [x] **Step 1: Add the pinned runtime dependency and inspect its real APIs.**

Run `npm install --save --save-exact @zip.js/zip.js@2.23.0 --ignore-scripts` in web. Expected: only this new runtime package record added; audit clean. Read its installed declaration/source for BlobReader.readUint8Array, ZipReader.getEntriesGenerator, FileEntry.getData WritableStream support, strict checks, chunk size and native compression configuration. Rule on any documented API drift before coding.

- [x] **Step 2: Write failing portable behavior tests.**

Initial characterization:

```typescript
const source = readyProject();
const archive = await encodeProject(source);
const restored = await decodeProject(archive);
expect(restored.project.id).not.toBe(source.id);
expect(restored.project.takes).toEqual(source.takes);
expect(restored.media.size).toBe(0);
```

Use actual zip.js fixtures, not a mocked codec. Test explicit media on/off and zero loader calls when excluded; in-memory source with retention off; missing retained video error; imported media in memory with null retention; recording recovery; Unicode names; corrupt/unsupported manifest/project, unknown credential fields, missing/extra/duplicate/traversal/case filenames, invalid UTF-8, unsupported compression/encryption; CRC/local-header tampering; lower input/JSON/decoded/entry/read limits; pre-abort and abort during source load. A forged compressed project entry with a tiny claimed size must fail against actual byte counts. Test an entry larger than 128 KiB to confirm payload reads remain streamed despite the metadata read cap.

- [x] **Step 3: Observe RED, then implement strict helpers.**

Run `node node_modules/vitest/vitest.mjs run src/project/archive/codec.test.ts`; use a minimal loaded codec if necessary to obtain a clean failed roundtrip assertion rather than counting a missing module as RED.

Implement exact field/path/version checks and lowered-limit validation. Source data is accessed lazily through a BlobReader subclass:

```typescript
override async readUint8Array(index:number,length:number) {
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(length) || index<0 || length<0
      || index+length>this.archiveBlob.size || length>this.limit) throw new ProjectArchiveError('limit','Archive read exceeds its safe limit.');
  return new Uint8Array(await this.archiveBlob.slice(index,index+length).arrayBuffer());
}
```

Use the entries generator, reject forbidden names/duplicates/counts and declared limits before extracting. Stream each entry into Blob parts with an independent running byte count, expected-size check and global total; throw before retaining a chunk that exceeds a cap. Use CRC32, local filename/structure/overlap and strictness options actually available in the installed package. Cleanup/abort on every failure, including malformed archive detection.

- [x] **Step 4: Implement pure project encode/decode.**

Encode builds a validated copy; excluding media clears its references without calling readMedia. Including media uses matching retained or in-memory sources, adds descriptors only to the export copy, checks totals and writes manifest/project/media entries in deterministic order. Decode validates ZIP then strict UTF-8/JSON/manifest/project, verifies exact media references/sizes and returns separate media sources. Use a new project UUID (avoid collisions with its existing take/clip IDs), recover recording takes and clear browser media retention in the returned document.

```typescript
const newDocument = parseProject({...parsed, id:crypto.randomUUID(),
  takes:parsed.takes.map(t=>({...t,media:null}))});
const project = recoverProject(newDocument);
```

Use AbortSignal plus a 30-second deadline for reading/writing; if loading a source ignores the signal, race it against abort so the codec still terminates. Never change a caller document or publish partial results.

- [x] **Step 5: Verify codec, all project tests, types and locks, then commit.**

Run all src/project tests and TypeScript. Expected: all cases pass; explicit source decisions honored, metadata allocation bounded, cancellation terminates, no repository changes during a failed import. Compare parsed dependency records to the baseline; only the new package allowed.

```text
git add web/src/project/archive web/package.json web/package-lock.json
git commit -m "feat: add bounded portable EmoteCap archives"
```

Task completion command: `bash -c 'cd web && node node_modules/vitest/vitest.mjs run src/project && node node_modules/typescript/bin/tsc --noEmit'` from root.

### Task 2: Format fixture, documentation and full qualification

**Files:** Create `contracts/emotecap-project-v1.md`, `contracts/fixtures/sample-project.emotecap`, `web/scripts/make-project-fixture.ts`, `web/src/project/archive/fixture.test.ts`, `docs/superpowers/reports/2026-10-07-project-archive.md`; update `docs/release-progress.md`.

**Interfaces:** Consumes Task1 codec and current motion v2 fixtures; produces a deterministic synthetic motion-only .emotecap that later Studio acceptance can import without a camera/model.

- [x] **Step 1: Write the fixture consumer test before generating it.**

Test reads the committed binary via Node file tools, wraps in Blob, decodes with the production codec and asserts synthetic provenance, shared right-arm motion, stable take/clip identity, no included media/retention and schema1/contractv2. Expected RED: fixture absent until the generator runs. Read-only fixture generation is not a claim of real camera quality.

- [x] **Step 2: Generate a reproducible fixture.**

The script imports `encodeProject`, current raise-right-arm.clip.json and schema types, uses fixed UUIDs/timestamps and synthetic provenance (models empty, quality fixture, calibration synthetic), then writes the Blob bytes to contracts/fixtures/sample-project.emotecap. Run through the existing Vitest/Vite TypeScript runtime with EMOTECAP_GENERATE_FIXTURE=1, so frontend extensionless/JSON imports use their normal resolver. Generate twice into memory/files and compare SHA256; exact ZIP dates and entry ordering must make them identical. Commit only the synthetic portable file; no raw personal recording.

- [x] **Step 3: Document the format and actual limits.**

Describe manifest/project/media paths, exact versions/bounds, compression, CRC/strict parsing, default no-media export and no-retention import, new project identity, snapshot recovery and readable failures. Include commands to regenerate/read the synthetic fixture, and distinguish archive codec acceptance from full Studio/browser/hardware acceptance.

- [x] **Step 4: Run full Web qualification and record evidence.**

Run full Web tests, 8 asset/security tests, types, model hashes and build. Expected all pass; archive fixture consumer passes; parsed locks show only allowed package changes. Record exact counts, RED/GREEN, code commit range and pending real-browser/performance/remaining full M1–M5 gates in the report/ledger.

- [x] **Step 5: Commit.**

```text
git add contracts/emotecap-project-v1.md contracts/fixtures/sample-project.emotecap web/scripts/make-project-fixture.ts web/src/project/archive/fixture.test.ts docs/release-progress.md docs/superpowers/reports/2026-10-07-project-archive.md
git commit -m "docs: qualify and document portable project format"
```

Task completion command: `bash -c 'cd web && node node_modules/vitest/vitest.mjs run && node --test scripts/asset-integrity.test.mjs scripts/dependency-security.test.mjs && node node_modules/typescript/bin/tsc --noEmit && node --use-system-ca --use-env-proxy scripts/fetch-mediapipe.mjs && node node_modules/vite/bin/vite.js build'` from root.

## Final Review

One fresh most-capable-model Native reviewer checks the whole plan range from 6184b1f, with spec, ledger rulings and five Review Focus lines. One TDD fix pass for Critical/Important; record minor/declined scopes. Retain verification scratch after the earlier cleanup rejection. Continue actual Studio wiring and browser acceptance; M2 and the full M1–M5 goal remain active until all gates are proven.
