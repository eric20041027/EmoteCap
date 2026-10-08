# Supplemental material and source-access notice qualification

Plan/review BASE1507c0cf76e0a7bdd962a682d263c9c8206000d5. [Spec](../specs/2026-10-08-source-notices-design.md), [plan](../plans/2026-10-08-source-notices.md). Inline Native implementation; qualification and one fresh final Python review remain in progress. This is internal pending material, not completed redistribution approval or full M1–M5 acceptance.

## Implementation evidence

The existing material v1schema and five source/runtime/model/lock pins are preserved. Component sourceForms bind actual prepared directory/wheel files, observed versions, owner licensing references and hashes. Discovery requires every shipped certifi source copy to be declared. The validator reads source and ZIP members without importing/executing them, enforcing32forms/16files per form/2MiB source file/8MiB total,8wheels/32MiB each/4096entries/64MiB uncompressed contents. It rejects missing/extra/forged source declarations, unsafe/colliding/encrypted/linked wheel metadata and stale native associations. Admission and copying recheck prepared and staged sources.

An OpenSSL4.0.2supplement binds the verified cryptography50.0.1native file6a42262974f0e086c1f2defaff4ccd9fb25046cf193422135e2dda5b4b29b2a2. Exact original LICENSE bytes from the official OpenSSLtag have SHA2567d5450cb2d142651b8afa315b5f238efc805dad827d91ba367d8516bc9d49e7a/10,175bytes. The official PyPIcertifi2024.8.30sdist supplied989byteLICENSE/SHA256e93716da6b9c0d5a4a1df60fe695b370f0695603d21f6f83f053e42cfc10caf7. The downloaded source was not executed.

All prior114texts were independently rehashed unchanged. Current inventory:47components/116texts/479,831bytes/54native records/9SDKfiles; source declarations3copies/14preferred source files and1embedded native association. Index SHA25623f7533e6ee339e2a064e811fddddfd2aca6c616561feb2aba14f40b21643553. Broader SDK/native/owner/model/product/publication conditions remain pending.

## Watched tests and deviations

- Initial RED incorrectly used the existing exclusive manifest writer to mutate an owned test fixture:28setup errors were retained and not counted as product failures. The fixture writer was corrected.
- Meaningful RED:27failures/42pass/1Windows symlink skip. The original public validator ignored source/native statements and copier omitted the generated notice.
- Focused first GREEN:69pass/1skip, with a new regex-literal warning. That literal was corrected before the full suite.
- Full fast backend:814pass/1skip/18slow deselected,104.94s. Existing Starlette/httpxdeprecation warning retained; no dependency upgrade. Slow Blender checks were not repeated for this packaging-only change.
- Actual material admission exposed two nested `.py` files in production certifi that the earlier four-root-file source assumption omitted. A declared nested-source positive case was watched RED, then GREEN. The spec/plan now retain all bounded `.py`/`.pem` sources with the four core names required;14files instead of12. The first incomplete material attempt and all origin receipts remain retained.

Artifact, final affected/full tests, review findings and exhaustive effect-based rulings will be appended only after their gates actually run. No old candidate, scratch, model, runtime, source/pin or public branch was overwritten or deleted.

Final affected full fast backend after nested source integration:815pass/1skip/18slow deselected,114.66s; only existing Starlette/httpxwarning. A mistaken root-CWD run produced19collection/import-root errors; its log remains retained and is not a product test failure. The corrected server-CWD run above is authoritative. Pinned npm11.21.0types/model-cache/production build passed with184modules and unchanged Web output hashes; existing chunk-size advice remains.
