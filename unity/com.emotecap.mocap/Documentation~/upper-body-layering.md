# Upper-body clips over locomotion

Use this example for a wave, thumbs-up or door interaction while the base Animator continues locomotion. Capture **Upper body** or **Upper body + fingers**, then export the ordinary full Humanoid FBX. Upper-body capture fixes pelvis translation/rotation and suppresses inferred leg/jump/grounding motion; the exported rig still has52or22bones. Its fixed192-value world-delta frames are converted by the normal exporter/importer.

1. Keep the character's existing Humanoid Avatar and Animator Controller. Add a separate layer named **EmoteCap Gesture**, with blending **Override**, initial weight0 and a state using the imported EmoteCap Humanoid AnimationClip.
2. Select an Assets folder. Choose **Assets → Create → EmoteCap → Arms and Head Override Mask**, then assign the created mask to that layer. Existing assets/controllers are not replaced. The whole-body Starter Rigs Clip Player is a separate playback example that takes over its Animator; use the controller-layer approach for this example.
3. Transition into the gesture and raise its layer weight to1. Restore weight0 when returning to base locomotion. A game can blend the weight over a short interval suited to its animation style. Root motion remains the base controller/game's responsibility.

| Humanoid group | Arms and Head mask | Optional includes-torso mask |
|---|---|---|
| Head, arms, fingers | enabled | enabled |
| Body | disabled | enabled |
| Root | disabled | disabled |
| Left/right leg | disabled | disabled |
| Hand/foot IK | disabled | disabled |

The default deliberately keeps base torso/pelvis motion and uses the captured head/arms/fingers. For captured torso motion, create **Upper Body Override Mask (includes torso)** instead. Unity's Humanoid **Body** is a grouped mask; this option is not a guarantee that pelvis-related body muscles remain untouched. Inspect the target Avatar's gait/hips when enabling it. These masks target Humanoid groups; they are not a per-transform Generic-rig mask editor.

Use an **Override** layer. An exported world-delta motion is not an additive local-space animation authored against your controller's reference pose. The existing full-body playback sample and pairing/Live Link paths remain separate.

Automated Editor tests verify all mask flags, persistence, unique creation paths and preservation of an existing controller/mask. They do not qualify physical capture accuracy, every target Avatar's gait or the final game's animation transitions. See [Unity Avatar Mask reference](https://docs.unity3d.com/6000.0/Documentation/Manual/class-AvatarMask.html).
