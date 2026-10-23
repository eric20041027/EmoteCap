# EmoteCap portable project container v1 (project schemas1/2)

File extension: `.emotecap`; MIME: `application/x-emotecap`. A project file is a standard ZIP, independent of the browser's IndexedDB recovery cache. The current motion contract remains [v2](motion-v1.md).

## Entries and manifest

Exactly `manifest.json`, `project.json`, and zero to twenty `media/<take UUID>.source` files. No directories, unknown paths, encryption, split files or duplicate/case-variant names. Stored and deflate compression and bounded ZIP64 records are accepted. Strict ZIP checks reject CRC errors, inconsistent local filenames/headers, overlapping entries and ambiguous archive layouts.

```json
{
  "format": "emotecap-archive",
  "version": 1,
  "project": "project.json",
  "projectSchema": 2,
  "contractVersion": 2,
  "media": []
}
```

With media, each manifest item is exactly `{"takeId":"<UUID>","path":"media/<UUID>.source"}`. It must match a project take's media descriptor and an actual ZIP entry. Descriptors carry source name, video MIME type and exact byte size; filenames in the archive use UUIDs. Every included payload is referenced exactly once. JSON is strict UTF-8, validated as data, with unsupported versions/fields rejected. API keys and arbitrary credential fields are not project data.

`project.json` contains the schema2 ProjectDocument defined in `web/src/project/types.ts`: project identity/revision/name/times/selection; identifiable takes; immutable motion frames and capture provenance; clip ranges/names/loops/descriptions; clip-edit revision and bounded undo history; optional media descriptors. It preserves finite numeric values, including signed zero encoded as `-0.0`.

Readers accept matching archive/project schema1 or2; header/document mismatch is rejected before migration. Schema1 migrates only the document schema to2 in memory, preserving old take frames and provenance without injecting metadata. New backups write schema2; old readers reject them explicitly. Motion wire remains contract2 with192rotation values and valid52/22-bone Humanoid rigs.

New takes record optional provenance `processing`: `{version:"indie-mocap-v1",region:"full-body"|"upper-body",root:"grounded-in-place"|"fixed-pelvis",hands:"off"|"available"|"unavailable"}`. Region/root must agree. Body skeleton requires hands off and no hand-model entry; full skeleton requires available/unavailable matching initial hand-model setup and its model list. These are model setup states, not a claim that hands were visible on every frame. Absence means legacy full-body semantics with the original skeleton/finger mapping. Schema1 cannot carry new processing metadata. Completed-take provenance remains immutable.

Upper-body frames keep pelvis `[0,H0,0]`, suppress leg/jump/grounding observations and use the shoulder line plus canonical upright reference. This cannot reliably recover forward torso lean. Active driven channels are derived from the fixed bone list (upper41with fingers/11without; full48/18); export hierarchy remains52/22. Import/export does not shrink frame arrays or delete rig legs.

## Limits

| Resource | Maximum |
|---|---|
| Input file / actual total decoded data | 512 MiB each |
| Project JSON | 256 MiB |
| Manifest JSON | 64 KiB |
| Entries | 22 |
| Source video | 100 MiB/take, 200 MiB/project |
| Input stream chunk / metadata read request | 64 KiB / 128 KiB |
| Operation deadline | 30 seconds |
| JSON nesting / fields per object | 8 / 16 |
| Encoded JSON string / structural values | 4096 characters / 10 million |

Declared sizes are checked before decoding; independent counters check actual decoded bytes and size agreement. Structural JSON limits apply before object construction. Input reads are bounded before allocating metadata; long JSON scans yield for cancellation. Caller limits may decrease these caps, never increase them.

The project itself permits 20 takes, 21601 frames/take, 43202 frames/project and 180 seconds/take; 50 clips/take and 20 undo snapshots. Frame timelines, finite values, in-place hips and quaternion norms retain the existing v2 rules. Names/provenance/text limits are enforced by the schema parser.

## Source choices and restore behavior

Source inclusion defaults off and does not access the video loader. Choosing inclusion adds available video from memory or retained browser data to an export copy; it does not change the original take or browser-retention choice. A referenced retained source that cannot be read produces a visible error. Motion-only takes are valid without video.

Import fully validates before returning anything. It creates a fresh project UUID, preserving take/clip identities within that namespace, so an existing project is not overwritten. Recording checkpoints restore as interrupted takes with their original frames. Included videos return as separate in-memory sources; browser-retention flags are cleared until the user explicitly chooses Keep source video. Import/export does not grant Gemini upload consent or contact a cloud service.

Cancellation, timeout, malformed files, missing sources and size failures return errors without publishing a partial archive or installing a project. The codec does not write to IndexedDB; Studio must save only a successful, fully validated result.

## Synthetic fixture and regeneration

`fixtures/sample-project.emotecap` is the preserved schema1 fixture containing shared synthetic right-arm motion, fixed take/clip identities and synthetic provenance, with no camera recording or source video. Opening it exercises migration; its bytes stay unchanged. It is not evidence of physical tracking quality. Explicit regeneration now writes a separate `sample-project-v2.emotecap`; the original onboarding fixture remains available.

From `web/`, after installing the committed dev dependencies, regenerate using the existing Vitest/Vite resolver. PowerShell:

```powershell
$env:EMOTECAP_GENERATE_FIXTURE = '1'
try { npm test -- src/project/archive/fixture.test.ts }
finally { Remove-Item Env:EMOTECAP_GENERATE_FIXTURE -ErrorAction SilentlyContinue }
```

On POSIX shells:

```text
EMOTECAP_GENERATE_FIXTURE=1 npm test -- src/project/archive/fixture.test.ts
```

Ordinary `npm test -- src/project/archive/fixture.test.ts` reads the committed artifact without generating it and also checks two identical generations on the pinned runtime. ZIP dates, IDs, timestamps and entry ordering are fixed. The native compression/runtime and host ZIP date representation can affect byte identity across platforms; semantic decoding is the compatibility requirement. M5 distribution artifacts retain their own source commit and SHA256.
