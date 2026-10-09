# Source-annotated observed motion proxies

The existing real-video pilot had empty stationary/contact annotations. This analysis adds source-selected labels and actual offline proxy values to immutable copies of its original/rebuilt preview packets. No new capture/inference or product/model/dependency/candidate change occurred. This is a short cold-start diagnostic, not completion of the real-motion/finger/laptop or full release gates.

## Source and annotation selection

The retained input is the previously authorized [Jumping jacks and burpees](https://commons.wikimedia.org/w/index.php?title=File:Jumping_jacks_and_burpees.webm&oldid=1182499913) excerpt by Taco fleur, [CC BY-SA4.0](https://creativecommons.org/licenses/by-sa/4.0/). Parent original SHA2561c8370a29c52b5b1538f03f8c63be6cdc9333dea3cbd77cc8f2af0dbe496d5b4and retained silent640x480excerpt SHA25602594035f595a2cd142d1f68be26ba2dfec8162ed2e36ea8d1fbde32cf6c450a remain unchanged. Exact excerpt duration4.198814s is distinct from the parent source's selected interval ending4.007s. Media, contact sheets and derived motions stay private; project MIT does not relicense them, and no endorsement is implied.

Two bounded native Edge decoder inspections sample the exact excerpt:0..4s/0.2s and initial0..0.8s/0.05s, with full640x480cells. Both owned trees finish exit0/terminal. Source labels are frozen before inspecting proxy scores: visually quiet initial standing0.05–0.20s, and visible left/right foot contact0.05–0.60s. Later jumping/landing/burpee motion is excluded. Quiet standing can include voluntary micro-motion/breathing; it is not frozen anatomy or a noise-only oracle. Sampled2Dfoot contact does not prove continuous physical heel contact. Logs record requested/player currentTime positions, not independently measured decoded-frame PTS. The coarse sheet inherits the old inspector's Original source caption despite reading the exact excerpt; the refined sheet explicitly says Retained excerpt, and file/code hashes bind both to the actual input.

## Immutable analysis and results

Original observed packets were collected at4e9a1dbe111a005165674fde427874835bb56899using genuine1.0.1Heavy+Hand assets/Accurate/medium/no crop/software SwiftShader, common current assets and the verified original713d349converter/solver. The original historical model environment was not reconstructed. This new analysis does not rerun or requalify current candidate inference or target hardware. Original files/run IDs remain untouched. New derived packet UUIDs and identical annotations are the only changed fields; samples, frame values, timings, sourceCommit, classification, source identity, settings/environment and authorization declaration remain exactly preserved. Sidecar lineage retains both original/derived identities and file hashes; new UUIDs identify analysis copies, not new captures.

Unchanged production evaluate_motion.py writes individual and comparison receipts. All126attempts remain successful in this pilot; original/rebuilt proxy results match exactly.

| Proxy | Label interval | Coverage | Original | Rebuilt |
|---|---|---|---:|---:|
| Head angular RMS departure from first valid pose |0.05–0.20s|5valid samples|1.077993degrees|1.077993degrees|
| Largest driven-bone RMS departure, LeftHand wrist bone |0.05–0.20s|5valid samples|3.430040degrees|3.430040degrees|
| Left canonical horizontal heel path |0.05–0.60s|17valid samples/16adjacent pairs|0.052123183m|0.052123183m|
| Right canonical horizontal heel path |0.05–0.60s|17valid samples/16adjacent pairs|0.064827254m|0.064827254m|

These are preview-phase canonical world-delta metrics, not final calibrated FBX/Unity values, anatomical error, net heel displacement, true sliding distance or a quality-improvement verdict. The five quiet samples span0.0666667–0.2s; the seventeen contact samples span0.0666667–0.6s. The short initial window has zero original warmup and can contain detector/solver startup and actual micro-motion. No hands were assigned in this pilot; wrist-bone variation/zero finger values do not qualify finger tracking. Historical timing deltas are retained unchanged: rebuilt-original effectiveFPS−0.00670028and p95detection-to-solver+8.40000001ms, not a comparative performance conclusion.

## Verification and limits

Read-only postflight rehashes all frozen originals/evaluator/contracts, both inspectors/drivers and actual image sheets; verifies decoder requested/player times/duration and owned terminal receipts; reverses only annotation/UUID changes to prove exact original packets; checks receipt input/evaluator hashes and comparison equality. An independent standard quaternion rotation-matrix FK/heel implementation reproduces both path sums within1e-12m; independent angular arithmetic reproduces all48RMS values within1e-6degrees. This arithmetic check does not authenticate physical annotations.

The first postflight looked up helper basename records at repository root instead of their private workspace and failed FileNotFoundError before any measurement judgment; resolving them within the workspace corrects the harness check. Original production/input data remain unchanged. Private evidence is .superpowers/sdd/2026-10-09-contact-proxy/. One fresh independent Native review follows actual task completion.

Rulings: use unchanged accepted evaluator/source inspection rather than invent a production RED (cost: proxy evidence is weaker than ground truth); retain original private media/packets/failures/workspace (cost: local disk/access requirements). No public-media action or unrelated CI is needed. The original22requirements remain intact; broader annotated motion/finger accuracy, Mac A–D/authenticated job input, actual target thresholds/support matrix, second Windows/five new users, complete vendor/Microsoft rights and final owner-approved release remain pending.
