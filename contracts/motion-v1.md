# EmoteCap motion contract v2

Current contract for web, server, Blender export, and Unity. This historical
filename remains stable for existing links. `bones.json` is the machine-readable
source of truth. Coordinate or bone-order changes require a new contract version
and a coordinated migration across all consumers.

## Coordinates

Canonical space is right-handed, +Y up, character facing +Z, in meters.
MediaPipe positions become `(x, -y, -z)`. Unity positions become `(-x, y, z)`
and quaternions become `(x, -y, -z, w)`. Blender positions become `(x, -z, y)`
and its w-first quaternion is `(w, x, -z, y)`.
Detection inputs are not mirrored; mirroring is a preview-only operation.

## Bones

Version 2 has 48 driven bones: 18 body bones followed by 30 finger bones.
The full export skeleton has 52 bones. Body-only export has 22 bones, but its
input frames still carry all 192 rotation values. `bones.json.driven` defines
wire order; `bones.json.skeleton` defines the parent-first export skeleton.
`LeftShoulder`, `RightShoulder`, `LeftToeBase`, and `RightToeBase` are not driven.
The canonical hips rest height is 0.95 meters.

## Motion and clip

```typescript
interface MotionFrame {
  t: number;
  h: [number, number, number];
  r: number[];
}
interface Clip {
  name: string;
  loop: boolean;
  fps: number;
  frames: MotionFrame[];
  skeleton?: 'full' | 'body';
}
interface Segment {
  name: string;
  start: number;
  end: number;
  loop: boolean;
  description: string;
}
```

Each `r` has 192 finite numbers, grouped as `(x,y,z,w)` world-delta quaternions
relative to T-pose. Apply `boneWorld = delta * restWorld`, parents first.
Each quaternion norm differs from 1 by at most 0.02. All motion numbers must
be finite. This in-place contract requires `abs(h.x)` and `abs(h.z)` <= 0.000001.

Export clips start at `t=0`, with strictly increasing subsequent timestamps,
ending no later than 180 seconds. FPS is an integer from 1 through 120.
The inclusive maximum is 21601 frames. The export endpoint accepts at most
50 clips per request. Names match `^[A-Za-z0-9_]{1,24}$`.
Segments describe editable ranges inside a take; the Web app produces clips.

## HTTP

| Method | Path | Input / output |
|---|---|---|
| GET | `/api/health` | `{ok, blender, gemini}` |
| POST | `/api/export` | `{clips: Clip[]}` → `{files: [{name, url}]}` |
| GET | `/files/{name}.fbx` | FBX download |
| POST | `/api/takes` | Multipart video + duration → `{takeId, segments}` |

Uploads retain the current 100 MiB / 180 second limit. Supported decoding
depends on the browser and provider; a `video/*` MIME type alone is not a codec
guarantee. The video sent for semantic slicing is unmirrored.

422 rejects invalid input before Blender starts. Validation details expose
location, message, and error type, not raw payload values. Other current codes:
413 size/duration, 415 media type, 500 export failure, 503 Gemini unconfigured,
502 Gemini failure. The Web app can fall back to local motion-energy slicing.

## FBX sidecar

`<name>.emotecap.json` contains `name: string`, `loop: boolean`, `fps: number`.
Unity reads it to configure clip naming and looping. Publishing currently
allows same-name replacement; job-scoped non-overwriting output is a later
product milestone, not a guarantee of this contract revision.

## Live Link

Endpoint: `/ws/live?role=source|sink`. The source sends a hello with
`type="hello"`, `version=2`, and `bones` equal to `bones.json.driven`, then
frames with `type="frame"` and the MotionFrame fields. Live timestamps are
stream timestamps; export clip timestamp bounds do not constrain live uptime.
The current relay forwards text; protocol negotiation, origin/session checks,
and source ownership are separate M3 work. `clip_ready` is not a completed
delivery feature. Legacy v1 data is outside the current acceptance matrix.

## Acceptance fixtures

`fixtures/tpose.clip.json` and `fixtures/raise-right-arm.clip.json` are shared
regression inputs. A right-arm raise must remain a right-arm raise with the
head up in the browser, exported FBX, and Unity. Source parity tests are only
one part of that check; real Blender/Unity playback must also be verified.
