"""Independent real-FBX probe; never imports the export implementation."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix,Quaternion,Vector

def main():
    parser=argparse.ArgumentParser()
    for name in ('fbx','bones','clip','result'):parser.add_argument('--'+name,required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    contract=json.loads(Path(args.bones).read_text());clip=json.loads(Path(args.clip).read_text())
    bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.render.fps=clip['fps']
    bpy.ops.import_scene.fbx(filepath=args.fbx,anim_offset=0,use_anim=True,automatic_bone_orientation=False)
    armatures=[obj for obj in scene.objects if obj.type=='ARMATURE']
    if len(armatures)!=1:raise RuntimeError('Expected one imported armature')
    obj=armatures[0];action=obj.animation_data.action
    if action is None:raise RuntimeError('Imported animation is missing')
    skeleton=[b for b in contract['skeleton'] if b['fbx'] in obj.data.bones]
    rest={b['name']:obj.matrix_world@obj.data.bones[b['fbx']].matrix_local for b in skeleton}
    driven={name:i for i,name in enumerate(contract['driven'])}
    vector=lambda xyz:Vector((xyz[0],-xyz[2],xyz[1]))
    bind_errors=[(rest[b['name']].translation-vector(b['head'])).length for b in skeleton]
    results=[]
    for index in sorted({0,len(clip['frames'])//2,len(clip['frames'])-1}):
        frame=clip['frames'][index];time=frame['t']*clip['fps'];scene.frame_set(math.floor(time),subframe=time%1)
        expected={};angles=[];positions=[];world={}
        for bone in skeleton:
            name,parent=bone['name'],bone['parent'];bind=rest[name]
            inherited=expected[parent]@rest[parent].inverted()@bind if parent else None
            head=inherited.translation if inherited is not None else vector(frame['h'])
            if name in driven:
                x,y,z,w=frame['r'][driven[name]*4:driven[name]*4+4]
                rotation=Quaternion((w,x,-z,y))@bind.to_quaternion()
            else:rotation=inherited.to_quaternion() if inherited is not None else bind.to_quaternion()
            expected[name]=Matrix.LocRotScale(head,rotation,bind.to_scale())
            actual=obj.matrix_world@obj.pose.bones[bone['fbx']].matrix
            difference=actual.to_quaternion().rotation_difference(rotation).angle
            angles.append(math.degrees(min(difference,2*math.pi-difference)))
            positions.append((actual.translation-head).length);world[name]=list(actual.translation)
        results.append({'t':frame['t'],'maxAngleDegrees':max(angles),'maxPositionMeters':max(positions),
                        'hips':world['Hips'],'head':world['Head'],'rightHand':world['RightHand'],'leftHand':world['LeftHand']})
    result={'durationSeconds':float(action.frame_range[1]-action.frame_range[0])/clip['fps'],
            'bones':len(skeleton),'bindErrorMeters':max(bind_errors),'samples':results,
            'blenderVersion':bpy.app.version_string}
    Path(args.result).write_text(json.dumps(result,allow_nan=False),encoding='utf-8')
if __name__=='__main__':main()
