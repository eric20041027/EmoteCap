# Unity sample installation without developer test dependencies

The accepted M1–M5 product requires a usable Unity package and original starter rigs. The Mac return for source1093691 records NUnit/UnityTest compilation errors after copying the unchanged sample into a fresh project without Test Framework. Adding1.7.0 permits compilation, but ordinary sample users should not have to install development-only test dependencies.

Requirements:

1. A new Unity6000.5.9f1 Built-in project with the local0.2.0 package and imported Starter Rigs must compile and create both valid Humanoid rigs without com.unity.test-framework.
2. Test assemblies must be excluded when their Test Framework resource is absent. Preserve all test source and asmdef/meta identities; do not delete tests or force Test Framework into production package dependencies.
3. With the existing qualification manifest's Test Framework1.7.0 and testables setting, the original81Editor/37Play required test matrix must still execute without skips.
4. Preserve Newtonsoft3.2.2, Unity6000.5, UPM0.2.0, all sample animation/geometry/motion contracts and licenses. No animation curve or capture/solver change belongs to this repair.
5. Bind real Editor evidence to frozen source/package bytes, use fresh owned projects/output, retain RED and GREEN logs, and stop only spawned owned processes. Do not use JSON configuration checks alone to claim the compilation defect fixed.
6. Record the accepted Mac return and bounded results in public product progress without publishing private motion, images, account paths, pairing credentials or raw logs.
7. Correct documentation that implicitly assumes developer tests are present; distinguish sample playback from opt-in tests and Windows verification from future Mac regression.
8. Keep visibility interruption, retargeting warnings, clean Windows/new-user studies, redistribution and formal release pending. No new Mac execution is claimed here.

Unity's documented versionDefines and defineConstraints provide conditional compilation based on a package resource: [assembly definition format](https://docs.unity.com/en-us/engine/6000.0/manual/programming-environment/script-compilation/assembly-definition-files/file-format). Real Editor absence/presence tests are the acceptance authority.
