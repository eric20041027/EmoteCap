"""Actual FBX reimport qualification; synthetic fixtures, no Unity/camera/provider."""
import copy
import hashlib
import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
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
    if shutil.which(load_settings().blender_path) is None:
        pytest.fail('Required Blender runtime is unavailable; qualification cannot be skipped')
    Clip.model_validate(clip);out=run_export([clip],tmp_path)
    clip_path=tmp_path/'probe-clip.json';result_path=tmp_path/'probe-result.json';clip_path.write_text(json.dumps(clip))
    command=[load_settings().blender_path,'-b','--factory-startup','--python-exit-code','1','-P',str(PROBE),'--',
        '--fbx',str(out/(clip['name']+'.fbx')),'--bones',str(REPO_ROOT/'contracts/bones.json'),
        '--clip',str(clip_path),'--result',str(result_path)]
    result=subprocess.run(command,cwd=REPO_ROOT,capture_output=True,text=True,timeout=120)
    assert result.returncode==0,(result.stdout+result.stderr)[-3000:]
    assert result_path.is_file(),'Blender probe did not write a result'
    report=json.loads(result_path.read_text())
    def finite(value):
        if isinstance(value,(float,int)) and not isinstance(value,bool):return math.isfinite(value)
        if isinstance(value,list):return all(finite(part) for part in value)
        if isinstance(value,dict):return all(finite(part) for part in value.values())
        return isinstance(value,str)
    assert finite(report),'Probe contains a nonfinite or unsupported measurement'
    assert isinstance(report.get('samples'),list) and report['samples']
    assert math.isfinite(report['durationSeconds']) and report['durationSeconds']>=0
    assert len(report['samples'])==len(clip['frames']),'Probe must check every original sample'
    assert all(sample['t']==frame['t'] for sample,frame in zip(report['samples'],clip['frames']))
    for key in ('bindErrorMeters','bindRotationErrorDegrees','bindScaleError'):
        assert isinstance(report[key],(float,int)) and report[key]>=0
    for sample in report['samples']:
        for key in ('maxAngleDegrees','maxPositionMeters'):
            assert isinstance(sample[key],(float,int)) and sample[key]>=0
        assert all(isinstance(sample[key],list) and len(sample[key])==3
                   for key in ('hips','head','leftHand','rightHand'))
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
    assert report['bindRotationErrorDegrees']<=.5
    assert report['bindScaleError']<=.00001
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

@pytest.mark.slow
@pytest.mark.parametrize('times',[[0,.015,1.7],[0,.415,1.7],[0,.01,.02]])
def test_real_fbx_keeps_fast_subframe_source_poses(tmp_path,times):
    clip=irregular_fixture(times);report=roundtrip(clip,tmp_path)
    assert_geometry(report,clip);assert_duration(report,clip)
    assert len(report['samples'])==len(clip['frames'])

@pytest.mark.slow
def test_geometry_probe_detects_a_wrong_head_rest_direction(tmp_path):
    clip=fixture('tpose.clip.json');contract=json.loads((REPO_ROOT/'contracts/bones.json').read_text())
    head=next(b for b in contract['skeleton'] if b['name']=='Head')
    head['tail']=[head['head'][0]+.2,head['head'][1],head['head'][2]]
    alternate=tmp_path/'alternate-bones.json';alternate.write_text(json.dumps(contract))
    inp=tmp_path/'clip.json';inp.write_text(json.dumps({'clips':[clip]}));out=tmp_path/'altered'
    export=subprocess.run([load_settings().blender_path,'-b','--factory-startup','--python-exit-code','1',
        '-P',str(REPO_ROOT/'server/blender/export_fbx.py'),'--','--in',str(inp),'--out',str(out),
        '--bones',str(alternate)],capture_output=True,text=True,timeout=120)
    assert export.returncode==0,export.stderr[-3000:]
    original=tmp_path/'original-clip.json';original.write_text(json.dumps(clip));result=tmp_path/'probe.json'
    probe=subprocess.run([load_settings().blender_path,'-b','--factory-startup','--python-exit-code','1',
        '-P',str(PROBE),'--','--fbx',str(out/(clip['name']+'.fbx')),'--bones',str(REPO_ROOT/'contracts/bones.json'),
        '--clip',str(original),'--result',str(result)],capture_output=True,text=True,timeout=120)
    assert probe.returncode==0,probe.stderr[-3000:]
    report=json.loads(result.read_text())
    assert report.get('bindRotationErrorDegrees',0)>.5,report

@pytest.mark.slow
def test_real_fbx_preserves_moving_fingers_and_quaternion_sign_equivalence(tmp_path):
    clip=irregular_fixture([0,.415,1.7]);clip['name']='Finger_signs'
    contract=json.loads((REPO_ROOT/'contracts/bones.json').read_text())
    finger=contract['driven'].index('RightIndexProximal')*4
    for index,frame in enumerate(clip['frames']):
        angle=index*math.pi/6
        frame['r'][finger:finger+4]=[0,0,math.sin(angle/2),math.cos(angle/2)]
        if index%2:frame['r']=[-value for value in frame['r']]
    report=roundtrip(clip,tmp_path);assert_geometry(report,clip);assert_duration(report,clip)
    assert len(report['samples'])==len(clip['frames'])

@pytest.mark.slow
@pytest.mark.parametrize('fps',[1,120])
def test_source_time_sampling_keeps_pose_at_supported_fps_extremes(tmp_path,fps):
    clip=irregular_fixture([0,.415,1.7]);clip['fps']=fps
    report=roundtrip(clip,tmp_path);assert_geometry(report,clip);assert_duration(report,clip)

@pytest.mark.slow
def test_blender_rejects_timestamps_it_cannot_represent_without_losing_samples(tmp_path):
    clip=irregular_fixture([0,1e-6,1.7]);Clip.model_validate(clip)
    with pytest.raises(AssertionError,match='Source timestamps are too close'):
        run_export([clip],tmp_path)

def test_mandatory_qualification_fails_instead_of_skipping_a_missing_runtime(tmp_path,monkeypatch):
    monkeypatch.setenv('BLENDER_PATH',str(tmp_path/'missing-blender.exe'))
    try:
        with pytest.raises(pytest.fail.Exception,match='Required Blender runtime'):
            roundtrip(fixture('tpose.clip.json'),tmp_path)
    except pytest.skip.Exception as error:
        raise AssertionError('Mandatory qualification was incorrectly skipped') from error

def fake_probe(tmp_path,monkeypatch,report,*,code=0,error=None):
    import test_blender_quality as module
    out=tmp_path/'out';out.mkdir();clip=fixture('tpose.clip.json')
    (out/(clip['name']+'.fbx')).write_bytes(b'FBX')
    monkeypatch.setattr(module,'run_export',lambda *args:out)
    monkeypatch.setattr(module,'load_settings',lambda:SimpleNamespace(blender_path=sys.executable))
    def run(*args,**kwargs):
        if error:raise error
        if report is not None:(tmp_path/'probe-result.json').write_text(report)
        return SimpleNamespace(returncode=code,stdout='',stderr='diagnostic'*1000)
    monkeypatch.setattr(module.subprocess,'run',run)
    return clip

@pytest.mark.parametrize('kind',['nonzero','timeout','absent','malformed','nonfinite'])
def test_probe_failure_cannot_be_reported_as_qualified(tmp_path,monkeypatch,kind):
    report='{}' if kind not in ('absent','malformed','nonfinite') else {
        'absent':None,'malformed':'not JSON',
        'nonfinite':'{"samples":[{}],"durationSeconds":NaN}'}[kind]
    clip=fake_probe(tmp_path,monkeypatch,report,code=1 if kind=='nonzero' else 0,
                    error=subprocess.TimeoutExpired('probe',120) if kind=='timeout' else None)
    with pytest.raises((AssertionError,KeyError,json.JSONDecodeError,subprocess.TimeoutExpired,pytest.fail.Exception)):
        roundtrip(clip,tmp_path)

@pytest.mark.parametrize('field',['maxAngleDegrees','maxPositionMeters'])
def test_nonfinite_geometry_does_not_pass_probe_validation(tmp_path,monkeypatch,field):
    sample={'t':0,'maxAngleDegrees':0,'maxPositionMeters':0,'hips':[0,0,.95],
            'head':[0,0,1.5],'leftHand':[0,0,1],'rightHand':[0,0,1]}
    sample[field]=float('nan')
    clip=fake_probe(tmp_path,monkeypatch,json.dumps({'samples':[sample],'durationSeconds':1,
        'bones':52,'bindErrorMeters':0,'blenderVersion':'4.5.14'}))
    with pytest.raises((AssertionError,pytest.fail.Exception)):
        roundtrip(clip,tmp_path)
