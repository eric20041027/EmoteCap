"""Actual FBX reimport qualification; synthetic fixtures, no Unity/camera/provider."""
import copy
import hashlib
import json
import math
import os
import subprocess
from pathlib import Path
from uuid import uuid4
import pytest
from emotecap_server.config import REPO_ROOT,load_settings
from emotecap_server.contract import Clip
from test_blender_export import run_export

PROBE=Path(__file__).with_name('blender_roundtrip.py')
def fixture(name):return json.loads((REPO_ROOT/'contracts/fixtures'/name).read_text())
def irregular_fixture(times):
    original=fixture('raise-right-arm.clip.json');indices=[0,len(original['frames'])//2,len(original['frames'])-1]
    result={**original,'name':'Irregular','frames':[copy.deepcopy(original['frames'][indices[min(i,2)]]) for i in range(len(times))]}
    for frame,t in zip(result['frames'],times):frame['t']=t
    return result
def roundtrip(clip,tmp_path):
    Clip.model_validate(clip);out=run_export([clip],tmp_path)
    clip_path=tmp_path/'probe-clip.json';result_path=tmp_path/'probe-result.json';clip_path.write_text(json.dumps(clip))
    command=[load_settings().blender_path,'-b','--factory-startup','--python-exit-code','1','-P',str(PROBE),'--',
        '--fbx',str(out/(clip['name']+'.fbx')),'--bones',str(REPO_ROOT/'contracts/bones.json'),
        '--clip',str(clip_path),'--result',str(result_path)]
    result=subprocess.run(command,cwd=REPO_ROOT,capture_output=True,text=True,timeout=120)
    assert result.returncode==0,(result.stdout+result.stderr)[-3000:]
    assert result_path.is_file(),'Blender probe did not write a result'
    report=json.loads(result_path.read_text())
    assert isinstance(report.get('samples'),list) and report['samples']
    assert math.isfinite(report['durationSeconds']) and report['durationSeconds']>=0
    report['inputSha256']=hashlib.sha256(clip_path.read_bytes()).hexdigest()
    report['fbxSha256']=hashlib.sha256((out/(clip['name']+'.fbx')).read_bytes()).hexdigest()
    report['exporterSha256']=hashlib.sha256((REPO_ROOT/'server/blender/export_fbx.py').read_bytes()).hexdigest()
    report['contractSha256']=hashlib.sha256((REPO_ROOT/'contracts/bones.json').read_bytes()).hexdigest()
    if qualification:=os.environ.get('EMOTECAP_QUALIFICATION_DIR'):
        root=Path(qualification).resolve()
        assert root.is_relative_to((REPO_ROOT/'.superpowers').resolve()),'Qualification evidence must stay in owned scratch'
        destination=root/str(uuid4());destination.mkdir(parents=True)
        report={**report,'clipName':clip['name'],'skeleton':clip.get('skeleton','full'),'fps':clip['fps'],'inputEnd':clip['frames'][-1]['t']}
        with (destination/'result.json').open('x',encoding='utf-8') as artifact:json.dump(report,artifact,allow_nan=False)
    return report
def assert_geometry(report,clip):
    assert report['bones']==(22 if clip.get('skeleton')=='body' else 52)
    assert report['bindErrorMeters']<=.001
    assert all(sample['maxAngleDegrees']<=.5 and sample['maxPositionMeters']<=.001 for sample in report['samples']),report
    assert all(sample['head'][2]>sample['hips'][2] for sample in report['samples'])
def assert_duration(report,clip):assert abs(report['durationSeconds']-clip['frames'][-1]['t'])<=1/clip['fps']+1e-6

@pytest.mark.slow
@pytest.mark.parametrize('name',['tpose.clip.json','raise-right-arm.clip.json'])
@pytest.mark.parametrize('mode',['full','body'])
def test_real_fbx_preserves_canonical_pose_scale_and_timing(tmp_path,name,mode):
    clip={**fixture(name),'skeleton':mode};report=roundtrip(clip,tmp_path);assert_geometry(report,clip);assert_duration(report,clip)
    if name.startswith('raise'):
        assert report['samples'][-1]['rightHand'][2]>report['samples'][0]['rightHand'][2]+.1
        assert abs(report['samples'][-1]['leftHand'][2]-report['samples'][0]['leftHand'][2])<=.001

@pytest.mark.slow
@pytest.mark.parametrize('times',[[0,.4,1.7],[0,.4,1.7152],[0]])
def test_real_fbx_keeps_irregular_fractional_and_single_frame_timelines(tmp_path,times):
    clip=irregular_fixture(times);report=roundtrip(clip,tmp_path);assert_duration(report,clip);assert_geometry(report,clip)

@pytest.mark.slow
def test_a_clip_starting_in_a_pose_still_exports_the_original_tpose_skeleton(tmp_path):
    original=fixture('raise-right-arm.clip.json');frames=copy.deepcopy(original['frames'][30:])
    first=frames[0]['t']
    for frame in frames:frame['t']=round(frame['t']-first,4)
    clip={**original,'name':'Raised_start','frames':frames}
    report=roundtrip(clip,tmp_path);assert_geometry(report,clip);assert_duration(report,clip)
