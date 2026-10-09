# Observed Unity pilot and hand diagnostic

Verified product source: clean `4e7e0ae456e2c029b2eeb816696e3cc443ab22bf`. This report extends the [real-person pilot](2026-10-08-public-video-pilot.md); it does not complete M4 or release acceptance.

## Actual Unity playback

The retained real-person export `Public_Jacks_Pilot.fbx` (SHA256 `6e502f3c62c90be3b0008409459a472d31a06d3a37b9b843ef7efefef3e99135`) was imported by the unchanged production importer in Unity 6000.5.9f1. Its 126-frame export job is pinned to SHA256 `aff52507d24f7ad83dc2f2d178d128ffce65cc88d3e2793a8912b944e944e963`.

The private PlayMode test used the actual `EmoteCapClipPlayer` on both original distributable Starter Rigs, Standard and Tall, with root angles 0 and 37 degrees. It manually sampled each production player's graph at all 126 source timestamps: 504 evaluated rig poses. It verified a valid Humanoid avatar/clip, source name and loop setting, finite joints and baked mesh vertices, the initial upright orientation, and non-static hand movement. Six images captured frames 0/30/60 after ordinary rendered-frame yields; both characters rendered and each later colored geometry mask differed by more than 100 pixels from frame 0. These are playback/render checks, not continuous real-time playback throughput or motion-accuracy measurements.

- Actual focused XML: one required test passed, zero failed/skipped. This is separate from the previously qualified 81 Editor/37 Play synthetic/sample suite.
- Source duration 4.166666666666667s; imported duration 4.20000029s. Difference is one 30Hz output frame within 1 microsecond float tolerance.
- Right-hand maximum displacement: Standard 0.778686m, Tall 0.831846m, essentially identical at the two root angles. Displacement establishes movement, not ground-truth accuracy.
- Actual graphics device: NVIDIA GeForce RTX 5070 Ti. This does not qualify the specified target laptop or camera.
- Editor PID 48312 exited 0, owned process tree terminal. Source package and exact consumed package/test/FBX/sidecar/fixture bytes were checked before/after execution; prepared rig assets matched the earlier immutable receipt.

Local evidence remains under `.superpowers/sdd/2026-10-08-unity-quality/observed-pilot-4e7e0ae-v4/`: XML, graphics images, all sampled measurements, per-segment diagnostics, input hashes and owned-process receipts. Raw media and derived animation were not published.

## Failures and decisions retained

1. The first attempt executed zero tests because an Editor-only assembly was classified outside PlayMode. The verifier rejected it despite Unity's exit 0 and empty XML marked Passed. The corrected assembly follows the established PlayMode test configuration.
2. The second attempt failed the earlier synthetic fixture's 1mm segment-length invariant: 0.439956337m versus 0.43886131m. That failure remains evidence. The final diagnostic records every segment's maximum absolute/relative change and frame/time; it does not replace the failed bound with a looser passing stability threshold. Maximum change was 11.7841363mm; maximum relative change was 2.34390181%. Humanoid metadata permits stretch, but this alone does not prove the cause or acceptable motion accuracy. **Proportional accuracy and segment stability remain unqualified.** Cost if this diagnostic interpretation is wrong: a genuine deformation issue remains unresolved before release.
3. The third attempt failed an unconditional head-above-hips check near the end. The [original source](https://commons.wikimedia.org/w/index.php?title=File:Jumping_jacks_and_burpees.webm&oldid=1182499913) visibly bends into a burpee at 4 seconds. The diagnostic retains initial-upright orientation and records head-minus-hips height at every timestamp, including one negative sample per rig/angle. It does not classify the bending pose as a standing-orientation pass. Cost if this interpretation is wrong: an inversion at that sample requires further comparison to annotated source motion.

One fresh independent Unity/C# harness review identified two Important evidence issues: synchronize render captures, and verify consumed copies rather than only original repository sources. Both were corrected in one pass. The actual final PlayMode run and six changing rendered masks verify the synchronized implementation; the stale-image risk itself was not reproduced as a RED claim. A separate negative control executed the old original-source-only check on a changed temporary FBX copy (watched failure: expected rejection absent), then the actual new consumed-input verifier (pass: changed copy rejected). No product code was changed or re-reviewed. No Minor findings were deferred.

## Hand-model positive control

Five independent exercise-video samples at 0.5/1/2/3/4s each yielded one pose and zero raw SDK hands. Both actual assignment and the diagnostic without its optional pixel guard yielded zero hands. This is five samples, not a replay of the earlier 126-frame tracking history.

The unchanged [CC0 Human hand photo by FrognerSvart](https://commons.wikimedia.org/w/index.php?title=File:Human_hand.jpg&oldid=1277670825), 2,535,228 bytes, SHA256 `db3f4e71440bab140ce5b6db2022990474bdc1e2d2afa851f5a975bf140456f9`, was a static positive control. The actual production factory/Hand VIDEO model returned one hand, 21 image/world landmarks, label Left at confidence 0.9890365601 and knuckle span 1123.443px; production assignment without a body pose retained it with the unchanged 28px guard. GPU delegate used SwiftShader software rendering in Edge 154.0.4258.62. Explicit SDK consent preceded setup and was revoked in cleanup; zero page errors and the owned tree terminated. Independent review found zero Critical/Important/Minor findings.

This proves functionality on this clear static image. It does not establish temporal finger quality, full-body wrist matching, or the cause of the video misses. Label confidence is not independently measured handedness accuracy. Camera/laptop performance, wider annotated motion cases, clean-machine/new-user qualification and project/redistribution rights still gate M4/M5.
