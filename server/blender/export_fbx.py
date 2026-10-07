"""Export EmoteCap clips to Humanoid-ready FBX files (one FBX per clip).

Run from the repo root:
  $BLENDER_PATH -b --factory-startup -P server/blender/export_fbx.py -- \
      --in clips.json --out out_dir --bones contracts/bones.json

clips.json holds {"clips": [Clip, ...]} as defined in contracts/motion-v1.md.
Writes <out>/<name>.fbx and <out>/<name>.emotecap.json for every clip.
"""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Export EmoteCap clips to FBX")
    parser.add_argument("--in", dest="inp", required=True)
    parser.add_argument("--out", dest="out", required=True)
    parser.add_argument("--bones", dest="bones", required=True)
    return parser.parse_args(argv)


def to_blender_vec(v) -> Vector:
    """Canonical (x, y, z) -> Blender (x, -z, y)."""
    return Vector((v[0], -v[2], v[1]))


def to_blender_quat(x: float, y: float, z: float, w: float) -> Quaternion:
    """Canonical quaternion (x, y, z, w) -> Blender Quaternion (w, x, -z, y)."""
    return Quaternion((w, x, -z, y))


BODY_BONE_COUNT = 18  # contracts/motion-v1.md: driven bones after the first 18 are fingers


def select_skeleton(contract: dict, mode: str) -> dict:
    """Contract copy whose export skeleton drops the finger bones when mode is "body"."""
    if mode != "body":
        return contract
    fingers = set(contract["driven"][BODY_BONE_COUNT:])
    return {**contract, "skeleton": [bone for bone in contract["skeleton"] if bone["name"] not in fingers]}


def reset_scene(fps: int, frame_count: int) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.fps = fps
    scene.frame_start = 0
    scene.frame_end = max(frame_count - 1, 0)


def build_armature(skeleton: list[dict]) -> bpy.types.Object:
    data = bpy.data.armatures.new("Armature")
    obj = bpy.data.objects.new("Armature", data)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    fbx_names = {bone["name"]: bone["fbx"] for bone in skeleton}
    for bone in skeleton:
        edit_bone = data.edit_bones.new(bone["fbx"])
        edit_bone.head = to_blender_vec(bone["head"])
        edit_bone.tail = to_blender_vec(bone["tail"])
        edit_bone.roll = 0.0
        if bone["parent"]:
            edit_bone.parent = data.edit_bones[fbx_names[bone["parent"]]]
            edit_bone.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def solve_frame(frame: dict, skeleton: list[dict], driven_index: dict, rest: dict) -> dict:
    """Return {bone name: 4x4 armature-space pose matrix} for one MotionFrame."""
    pose: dict[str, Matrix] = {}
    for bone in skeleton:
        name, parent = bone["name"], bone["parent"]
        rest_b = rest[name]
        if parent is None:
            head = to_blender_vec(frame["h"])
            offset_pose = None
        else:
            offset_pose = pose[parent] @ rest[parent].inverted() @ rest_b
            head = offset_pose.translation
        if name in driven_index:
            i = driven_index[name] * 4
            delta = to_blender_quat(*frame["r"][i : i + 4]).to_matrix()
            rotation = delta @ rest_b.to_3x3()
        elif offset_pose is not None:
            rotation = offset_pose.to_3x3()
        else:
            rotation = rest_b.to_3x3()
        pose[name] = Matrix.Translation(head) @ rotation.to_4x4()
    return pose


def key_clip(obj: bpy.types.Object, contract: dict, clip: dict) -> None:
    skeleton = contract["skeleton"]
    driven_index = {name: i for i, name in enumerate(contract["driven"])}
    fbx_names = {bone["name"]: bone["fbx"] for bone in skeleton}
    rest = {bone["name"]: obj.data.bones[bone["fbx"]].matrix_local.copy() for bone in skeleton}
    previous: dict[str, Quaternion] = {}
    for frame_index, frame in enumerate(clip["frames"]):
        pose = solve_frame(frame, skeleton, driven_index, rest)
        for bone in skeleton:
            name, parent = bone["name"], bone["parent"]
            if parent is None:
                basis = rest[name].inverted() @ pose[name]
            else:
                basis = (rest[parent].inverted() @ rest[name]).inverted() @ pose[parent].inverted() @ pose[name]
            pose_bone = obj.pose.bones[fbx_names[name]]
            pose_bone.rotation_mode = "QUATERNION"
            q = basis.to_quaternion()
            if name in previous and q.dot(previous[name]) < 0:
                q.negate()
            previous[name] = q
            pose_bone.rotation_quaternion = q
            pose_bone.keyframe_insert("rotation_quaternion", frame=frame_index)
            if parent is None:
                pose_bone.location = basis.translation
                pose_bone.keyframe_insert("location", frame=frame_index)


def export_fbx(path: Path) -> None:
    bpy.ops.export_scene.fbx(
        filepath=str(path),
        use_selection=False,
        object_types={"ARMATURE"},
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_ALL",
        axis_forward="-Z",
        axis_up="Y",
        add_leaf_bones=False,
        primary_bone_axis="Y",
        secondary_bone_axis="X",
        armature_nodetype="NULL",
        bake_anim=True,
        bake_anim_use_all_bones=True,
        bake_anim_use_nla_strips=False,
        bake_anim_use_all_actions=False,
        bake_anim_force_startend_keying=True,
        bake_anim_step=1.0,
        bake_anim_simplify_factor=0.0,
    )


def main() -> None:
    args = parse_args()
    contract = json.loads(Path(args.bones).read_text())
    clips = json.loads(Path(args.inp).read_text())["clips"]
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    for completed, clip in enumerate(clips, start=1):
        clip_contract = select_skeleton(contract, clip.get("skeleton", "full"))
        reset_scene(clip["fps"], len(clip["frames"]))
        armature = build_armature(clip_contract["skeleton"])
        key_clip(armature, clip_contract, clip)
        armature.animation_data.action.name = clip["name"]
        export_fbx(out_dir / f"{clip['name']}.fbx")
        sidecar = {"name": clip["name"], "loop": clip["loop"], "fps": clip["fps"]}
        (out_dir / f"{clip['name']}.emotecap.json").write_text(json.dumps(sidecar))
        print(f"EMOTECAP exported {clip['name']} ({len(clip['frames'])} frames)")
        print(f"EMOTECAP_PROGRESS:{completed}:{len(clips)}", flush=True)


if __name__ == "__main__":
    main()
