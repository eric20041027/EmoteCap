import importlib.util
import hashlib
import json
from pathlib import Path
import pytest
from emotecap_server.contract import Clip

spec=importlib.util.spec_from_file_location('unity_quality',Path(__file__).resolve().parents[2]/'scripts/unity-quality.py')
quality=importlib.util.module_from_spec(spec)
spec.loader.exec_module(quality)

def test_real_export_fixtures_include_valid_and_actual_negative_motion_controls():
    fixtures=quality.clips()
    assert len(fixtures)==9
    for fixture in fixtures:Clip.model_validate(fixture)
    by_name={fixture['name']:fixture for fixture in fixtures}
    raised=by_name['Sample_Raise_Right_Arm'];mirrored=by_name['Negative_Mirrored'];frozen=by_name['Negative_Frozen']
    assert len(raised['frames'])==60
    assert any(abs(frame['r'][9*4+2])>.1 for frame in raised['frames'])
    assert all(frame['r'][9*4:12*4]==[0,0,0,1]*3 for frame in mirrored['frames'])
    assert any(abs(frame['r'][6*4+2])>.1 for frame in mirrored['frames'])
    assert all(frame['r']==[0,0,0,1]*48 for frame in frozen['frames'])
    assert by_name['Quality_Single']['frames'][0]['t']==0
    assert by_name['Quality_Body']['skeleton']=='body'

@pytest.mark.parametrize('path',['../foreign','.superpowers/sdd/2026-10-07-unity-receiver/result',
    '.superpowers/sdd/2026-10-08-unity-quality/child/../../foreign','.superpowers/sdd/2026-10-08-unity-quality'])
def test_runner_rejects_foreign_sibling_traversal_and_workspace_root(path):
    with pytest.raises(ValueError):quality.owned_output(str(quality.ROOT/path))

def test_runner_rejects_existing_output_before_mutating_it(tmp_path,monkeypatch):
    monkeypatch.setattr(quality,'WORK',tmp_path)
    target=tmp_path/'existing';target.mkdir()
    (target/'qualification-inputs.json').write_bytes(b'original evidence')
    before=(target/'qualification-inputs.json').read_bytes()
    with pytest.raises(ValueError):quality.owned_output(str(target))
    assert (target/'qualification-inputs.json').read_bytes()==before

def test_sample_material_requires_all_declared_bytes(tmp_path):
    path=tmp_path/'provenance.json'
    path.write_text(json.dumps({'schema':'emotecap-original-sample-animation-v1',
        'files':[{'path':'Sample_Raise_Right_Arm.fbx','bytes':3,'sha256':'0'*64}]}))
    (tmp_path/'Sample_Raise_Right_Arm.fbx').write_bytes(b'bad')
    with pytest.raises(ValueError):quality.verify_material(tmp_path)

def test_complete_sample_material_verifies_and_rejects_one_changed_byte(tmp_path):
    records=[]
    for suffix in ('.fbx','.emotecap.json','.fixture.json'):
        name='Sample_Raise_Right_Arm'+suffix;data=b'original synthetic material'+suffix.encode()
        (tmp_path/name).write_bytes(data);records.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    proof={'schema':'emotecap-original-sample-animation-v1','files':records}
    (tmp_path/'provenance.json').write_text(json.dumps(proof))
    assert quality.verify_material(tmp_path)==proof
    path=tmp_path/'Sample_Raise_Right_Arm.fbx';data=path.read_bytes();path.write_bytes(bytes([data[0]^1])+data[1:])
    with pytest.raises(ValueError):quality.verify_material(tmp_path)

@pytest.mark.parametrize('skipped,classname,count',[('1','Required',1),('0','Other',1),('0','EmoteCap.Tests.LiveRelayInteropTests',1)])
def test_xml_gate_rejects_skipped_missing_or_incomplete_original_test_classes(tmp_path,skipped,classname,count):
    path=tmp_path/'results.xml'
    path.write_text('<test-run result="Passed" failed="0" skipped="'+skipped+'" passed="1">'+
        '<test-case classname="'+classname+'" result="Passed" />'*count+'</test-run>')
    required='EmoteCap.Tests.LiveRelayInteropTests' if classname.startswith('EmoteCap.') else 'Required'
    with pytest.raises(ValueError):quality.assert_xml(path,[required])

@pytest.mark.parametrize('name',['../outside.fbx','C:/outside.fbx','sub/../../outside.fbx'])
def test_sample_material_rejects_escaping_file_records(tmp_path,name):
    (tmp_path/'provenance.json').write_text(json.dumps({'schema':'emotecap-original-sample-animation-v1',
        'files':[{'path':name,'bytes':1,'sha256':'0'*64}]}))
    with pytest.raises(ValueError):quality.verify_material(tmp_path)
