# Current-source Windows candidate qualification

The previously accepted Windows builder was used without implementation changes at clean source `79ce9871bc5d404e2ca54d5109c77573f820a21d`. Application code remains `c51d318`; the intervening commits document observed SDK behavior. This is an internal local candidate with `releaseGate=pending`. Full M1–M5 remains unachieved.

## Reproducible artifact and integrity

A fresh pinned npm11.21.0 build passed types, model-cache verification and the production Vite build (184modules). The unchanged verified preparation has receipt SHA256 `716284f1597cb4afec84f7ce3d9140eae7e58e46388c2cff8ce90518d0eb2973`; its server locks/runtime pins were checked by the accepted builder. Both fresh candidate builds completed successfully:

- Source: `79ce9871bc5d404e2ca54d5109c77573f820a21d`.
- Each ZIP:87,613,336bytes; SHA256 `f116ab212a2e372c5fe74450062dc8445da5f445e5757137368089f88217af7c`.
- Each manifest:5,385payload files, with5,386ZIP entries including the manifest.
- Each archive independently checked for exact entry inventory, every file length/SHA256, sorted entries, fixed1980timestamps, deflate compression and regular-file0644permissions. Both manifest objects and ZIP hashes are identical.
- All114licensing texts match committed source bytes exactly;468,667text bytes/54native file records. Source index SHA256 is `5f04de638c18d687b5ec02c505d8b831452889d6beac71c82bb868fcf3ba4288`. Licensing assessment remains pending.

The source-linked manifest and ZIP receipts identify the candidate bytes. This proves reproducibility for these inputs; it does not provide a publisher signature or licensing approval. The earlier5572c88candidate remains retained as a historical qualification.

## Actual packaged application

The completed production probe started the bundled Python through the same `-I -S -B` bootstrap as `start.cmd`, with only WindowsSystem32 on the service PATH, a deliberately poisoned PYTHONPATH and fresh private data/settings paths outside the package. The real service returned `{ok:true,blender:true,gemini:false,exportJobs:1}`. There were no API mocks or development proxy; Node/Playwright belonged only to the external QA harness.

Owned Edge154.0.4258.62 ran the actual built Studio at an unused loopback port. Explicit SwiftShader flags and the actual unmasked renderer verified software WebGL before inference. Only `getUserMedia` was replaced with an owned640x480stream replaying the existing self-generated mannequin WebM (43,977bytes; SHA256 `a2f65e0edf8248b666386488c92f8d968bee80a32b88e6557dd08e44e4cc80c2`). No physical camera opened, and no model factory, model result, solver or persistence implementation was mocked.

Observed gates:

- SDK admission started unchecked. Default-denied and grant-only windows had0model/external page requests and0source starts. The explicit Startcamera action loaded the real Full+Hand/WASM graphs.
- Actual recording persisted a19frame checkpoint. Withdrawal preserved that exact original prefix in45complete frames; native IndexedDB reload restored the45frames exactly. Source media was not persisted, the owned track stopped, the SDK choice reset unchecked and both actual graphs closed successfully.
- The25,089byte `.emotecap` backup (SHA256 `0923cdba59e0d0e888ebd6de494f4830ebe24a005f5d63b8743ea55e5f214731`) imported into a different project namespace with all45frames exactly preserved.
- The real browser/service pairing acknowledged a session and revoked it on stop. This did not exercise the still-unqualified Unity consumer.
- The sample project exported through the real durable worker and separately installed Blender4.5.14. The595,388byte binary FBX has SHA256 `8b561702978f1824daa58660a4bdca13cc6fa8b9dc53c2dcb3eac7a89ee1e77b`. Blender is not bundled.
-0uncaught page errors. Desktop and390px screenshots were inspected; no horizontal overflow was observed. Captured motion had noT-pose calibration and the corresponding warning remained visible.

The bounded network log contains50records, including5local model/WASM requests and2actual Google protobuf POSTs of142bytes each during withdrawal. This confirms queued SDK metrics can flush on model close after the choice is unchecked; it does not establish network-wide absence of other payloads or provider retention. No Gemini upload occurred.

Both owned services were confirmed absent, with0listeners on their respective ports after teardown. A null exit code paired withSIGTERM was not treated as sufficient terminal proof. No unrelated process was stopped.

## Harness corrections and retained evidence

The first production probe completed the actual SDK/checkpoint/withdrawal/reload gates (19original frames within44complete/reloaded frames), then its assertion dereferenced the imported project before the new IndexedDB row existed. This was a QA waiting error, with0application page errors. Its logs, completed motion, downloaded backup, screenshot and exact executed helper remain retained. A fresh run waited for the persisted imported namespace and passed the complete workflow above.

The first independent ZIP assertion expected only0644permission bits. Actual archive metadata and the accepted builder include the regular-file type (`0100644`). The read-only check was corrected to verify both type and permissions; no archive bytes were changed. Neither correction changed product source or required a new implementation review.

All private evidence is under `.superpowers/sdd/2026-10-08-candidate-refresh-6715b3e3/`: inputs/source-build log; candidate-a/b directories, ZIPs and receipts; archive-check script/log/verification; qualification-harness notes; first `packaged-qa` and complete `packaged-qa-import-wait` runs; ownership/completion and independent cleanup receipts. Prior outputs and partial build workspaces are preserved.

## Remaining release gates

This qualifies the observed packaged Windows production/service/actual SDK path on a synthetic software stream. It does not qualify physical camera/Fast720p performance, authorized real actors/video, target laptop, correctly calibrated motion, a clean second machine, Unity Editor compilation/two redistributable rigs or the required5new-user study. Those gates, owner/contributor/four-media rights, complete native/vendor redistribution assessment and publication authorization remain pending.

The pending public CI proposal stays fixed at `c51d318`; this local candidate and later documentation do not enlarge that permission request. M1's draftPR remains separate. Rebuild final release artifacts only after the remaining source and release gates are settled; this report does not approve a public tag or release.
