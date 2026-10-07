"""Owned analytic packets; no cameras, models, hardware claims or network."""
import copy
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import uuid

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import evaluate_motion as cli
import motion_measurements as measurements


def frame(t):
    return {'t':t, 'h':[0,.95,0], 'r':[0,0,0,1]*48}


def sample(t, start, end, status='ok'):
    return {'inputTimeS':t, 'startedMs':start, 'finishedMs':end,
            'status':status, 'frame':frame(t) if status=='ok' else None}


@pytest.fixture
def packet():
    return {'schema':'emotecap-measurement-v1', 'runId':str(uuid.uuid4()),
            'sourceCommit':'a'*40, 'classification':'synthetic',
            'localProcessingAuthorized':True, 'inputSha256':'b'*64, 'sourceKind':'video',
            'environment':{'kind':'desktop', 'os':'Windows 11', 'cpu':'Owned synthetic CPU',
                           'gpu':'Owned synthetic GPU', 'browser':'Synthetic 1'},
            'settings':{'quality':'fast', 'width':1280, 'height':720, 'crop':'none',
                        'smoothing':'medium', 'skeleton':'full', 'sdkVersion':'1.0.1',
                        'modelSha256':'c'*64, 'delegate':'CPU', 'handPolicy':'every-other-150ms'},
            'measurement':{'clock':'performance-monotonic', 'latencyDefinition':'detection-to-solver',
                           'startedMs':0, 'finishedMs':5000, 'warmupMs':1000},
            'samples':[sample(0,0,10), sample(1,1000,1010), sample(2,2000,2030),
                       sample(4,4000,4050,'no-pose')], 'annotations':[]}


def test_dropouts_idle_and_warmup_are_not_hidden(packet):
    before=copy.deepcopy(packet)
    result=measurements.summarize(packet)
    assert result['metrics']['effectiveFps']==.5
    assert result['metrics']['failureRate']==pytest.approx(1/3)
    assert result['metrics']['p95DetectionToSolverMs']==50
    assert result['counts']['warmupAttempts']==1
    assert result['counts']['measuredStatuses']=={'ok':2,'no-pose':1,'detector-error':0,'solver-error':0}
    assert result['qualification']=='pending' and result['classification']=='synthetic'
    assert packet==before


@pytest.mark.parametrize('statuses',[[],['no-pose','detector-error','solver-error']])
def test_empty_and_all_failed_are_not_perfect_results(packet,statuses):
    packet['measurement']['warmupMs']=0
    packet['samples']=[sample(i,1000*i,1000*i+10,status) for i,status in enumerate(statuses)]
    result=measurements.summarize(packet)
    assert result['metrics']['effectiveFps']==0
    assert result['metrics']['failureRate']==(1 if statuses else None)
    assert result['metrics']['p95DetectionToSolverMs']==(10 if statuses else None)
    assert result['annotations']==[]


def test_quaternion_sign_is_not_stationary_jitter(packet):
    packet['samples'][2]['frame']['r']=[-v for v in packet['samples'][2]['frame']['r']]
    packet['annotations']=[{'id':'still','kind':'stationary','startS':1,'endS':4}]
    result=measurements.summarize(packet)['annotations'][0]
    assert max(result['rmsDegreesByBone'].values())==pytest.approx(0)
    assert result['validSamples']==2 and result['attempts']==3


def test_stationary_and_heel_drift_have_analytic_units(packet):
    packet['samples'][2]['frame']['r'][56:60]=[math.sqrt(.5),0,0,math.sqrt(.5)]
    packet['annotations']=[{'id':'still','kind':'stationary','startS':1,'endS':4},
                           {'id':'stance','kind':'left-stance','startS':1,'endS':4}]
    still,stance=measurements.summarize(packet)['annotations']
    assert still['rmsDegreesByBone']['LeftFoot']==pytest.approx(90/math.sqrt(2))
    assert stance['horizontalHeelPathM']==pytest.approx(.04)
    assert stance['validPairs']==1 and stance['validSamples']==2 and stance['attempts']==3


def test_stance_does_not_bridge_dropout_or_claim_one_pose_jitter(packet):
    packet['samples'][2]=sample(2,2000,2030,'no-pose')
    packet['samples'][3]=sample(4,4000,4050)
    packet['samples'][3]['frame']['r'][56:60]=[math.sqrt(.5),0,0,math.sqrt(.5)]
    packet['annotations']=[{'id':'stance','kind':'left-stance','startS':1,'endS':4},
                           {'id':'single','kind':'stationary','startS':1,'endS':2}]
    stance,still=measurements.summarize(packet)['annotations']
    assert stance['validPairs']==0 and stance['horizontalHeelPathM'] is None
    assert still['rmsDegreesByBone'] is None


@pytest.mark.parametrize('mutation',[
    'unknown','authorization','source','kind','classification','private','nonfinite','booltime',
    'wallreverse','inputreverse','overlap','outside','duration','warmup','status','missingframe',
    'failedframe','frameextra','framenorm','framehips','frametime','annotation','duplicate-annotation',
    'samplecount','dimensions','delegate','model','unknown-settings','unknown-measurement'])
def test_unsafe_or_incomplete_packets_are_rejected(packet,mutation):
    if mutation=='unknown':packet['privatePath']='owned'
    elif mutation=='authorization':packet['localProcessingAuthorized']=False
    elif mutation=='source':packet['sourceCommit']='short'
    elif mutation=='kind':packet['sourceKind']='other'
    elif mutation=='classification':packet['classification']='release-pass'
    elif mutation=='private':packet['environment']['cpu']='C:\\private\\recording'
    elif mutation=='nonfinite':packet['samples'][1]['finishedMs']=float('nan')
    elif mutation=='booltime':packet['samples'][1]['inputTimeS']=True
    elif mutation=='wallreverse':packet['samples'][1]['finishedMs']=900
    elif mutation=='inputreverse':packet['samples'][2]['inputTimeS']=1
    elif mutation=='overlap':packet['samples'][1]['startedMs']=5
    elif mutation=='outside':packet['samples'][3]['finishedMs']=5001
    elif mutation=='duration':packet['measurement']['finishedMs']=180001
    elif mutation=='warmup':packet['measurement']['warmupMs']=5000
    elif mutation=='status':packet['samples'][1]['status']='held-success'
    elif mutation=='missingframe':packet['samples'][1]['frame']=None
    elif mutation=='failedframe':packet['samples'][3]['frame']=frame(4)
    elif mutation=='frameextra':packet['samples'][1]['frame']['video']='private'
    elif mutation=='framenorm':packet['samples'][1]['frame']['r'][3]=0
    elif mutation=='framehips':packet['samples'][1]['frame']['h'][0]=1
    elif mutation=='frametime':packet['samples'][1]['frame']['t']=3
    elif mutation=='annotation':packet['annotations']=[{'id':'a','kind':'stationary','startS':0,'endS':5}]
    elif mutation=='duplicate-annotation':packet['annotations']=[{'id':'a','kind':'stationary','startS':0,'endS':4}]*2
    elif mutation=='samplecount':packet['samples']=[packet['samples'][0]]*21602
    elif mutation=='dimensions':packet['settings']['width']=True
    elif mutation=='delegate':packet['settings']['delegate']='unknown'
    elif mutation=='model':packet['settings']['modelSha256']='bad'
    elif mutation=='unknown-settings':packet['settings']['extra']=0
    elif mutation=='unknown-measurement':packet['measurement']['cameraLatencyMs']=0
    with pytest.raises(measurements.MeasurementError):measurements.validate_packet(packet)


@pytest.mark.parametrize('condition',['inputSha256','sourceKind','classification','environment','settings','clock','warmup','annotations','runId'])
def test_comparison_refuses_changed_conditions(packet,condition):
    candidate=copy.deepcopy(packet);candidate['runId']=str(uuid.uuid4());candidate['sourceCommit']='d'*40
    if condition=='inputSha256':candidate[condition]='e'*64
    elif condition=='sourceKind':candidate[condition]='camera'
    elif condition=='classification':candidate[condition]='observed'
    elif condition=='environment':candidate[condition]['kind']='laptop'
    elif condition=='settings':candidate[condition]['delegate']='GPU'
    elif condition=='clock':candidate['measurement']['latencyDefinition']='other'
    elif condition=='warmup':candidate['measurement']['warmupMs']=0
    elif condition=='annotations':candidate[condition]=[{'id':'a','kind':'stationary','startS':0,'endS':4}]
    else:candidate['runId']=packet['runId']
    with pytest.raises(measurements.MeasurementError):measurements.compare(packet,candidate)


def test_comparison_preserves_provenance_and_nulls(packet):
    candidate=copy.deepcopy(packet);candidate['runId']=str(uuid.uuid4());candidate['sourceCommit']='d'*40
    candidate['samples'][3]=sample(4,4000,4050)
    result=measurements.compare(packet,candidate)
    assert result['baseline']['sourceCommit']=='a'*40 and result['candidate']['sourceCommit']=='d'*40
    assert result['deltas']['effectiveFps']==pytest.approx(.25)
    assert result['deltas']['failureRate']==pytest.approx(-1/3)
    assert result['qualification']=='pending'
    packet['samples']=[];candidate['samples']=[]
    assert measurements.compare(packet,candidate)['deltas']['p95DetectionToSolverMs'] is None


@pytest.mark.parametrize('field,value',[('r','0'),('r',False),('h','0'),('t',True)])
def test_canonical_samples_require_real_numbers_without_coercion(packet,field,value):
    if field=='t':packet['samples'][1]['frame'][field]=value
    else:packet['samples'][1]['frame'][field][0]=value
    with pytest.raises(measurements.MeasurementError):measurements.validate_packet(packet)


def test_cli_receipt_is_exclusive_and_source_linked(packet,tmp_path):
    incoming=tmp_path/'owned.json';incoming.write_text(json.dumps(packet),encoding='utf-8')
    output=tmp_path/'receipt.json'
    assert cli.main(['--input',str(incoming),'--output',str(output)])==0
    receipt=json.loads(output.read_bytes())
    assert receipt['inputs']['candidate']==hashlib.sha256(incoming.read_bytes()).hexdigest()
    assert receipt['result']['metrics']['effectiveFps']==.5
    assert receipt['evaluator']['contracts/bones.json'] and receipt['qualification']=='pending'
    before=output.read_bytes()
    assert cli.main(['--input',str(incoming),'--output',str(output)])==2
    assert output.read_bytes()==before
    assert cli.main(['--input',str(incoming),'--output',str(incoming)])==2
    assert json.loads(incoming.read_bytes())==packet


@pytest.mark.parametrize('bad',['duplicate','deep','constant','oversize','hardlink'])
def test_cli_invalid_inputs_leave_no_receipt(packet,tmp_path,bad):
    incoming=tmp_path/'owned.json';output=tmp_path/'receipt.json'
    raw=json.dumps(packet).encode()
    if bad=='duplicate':raw=b'{"schema":"bad",'+raw[1:]
    elif bad=='deep':raw=b'['*1200+b'0'+b']'*1200
    elif bad=='constant':raw=raw.replace(b'"startedMs": 0',b'"startedMs": NaN',1)
    elif bad=='oversize':raw=b' '*((32*1024*1024)+1)
    incoming.write_bytes(raw)
    if bad=='hardlink':(tmp_path/'alias.json').hardlink_to(incoming)
    assert cli.main(['--input',str(incoming),'--output',str(output)])==2
    assert not output.exists()


def test_cli_rejects_directory_alias_without_touching_target(packet,tmp_path):
    source=tmp_path/'owned-source';source.mkdir();incoming=source/'packet.json'
    incoming.write_text(json.dumps(packet),encoding='utf-8');before=incoming.read_bytes()
    alias=tmp_path/'owned-alias'
    assert alias.resolve().is_relative_to(tmp_path.resolve()) and source.resolve().is_relative_to(tmp_path.resolve())
    if os.name=='nt':
        result=subprocess.run(['cmd.exe','/c','mklink','/J',str(alias),str(source)],capture_output=True,timeout=15)
        assert result.returncode==0
    else:alias.symlink_to(source,target_is_directory=True)
    output=tmp_path/'receipt.json'
    assert cli.main(['--input',str(alias/'packet.json'),'--output',str(output)])==2
    assert not output.exists() and incoming.read_bytes()==before
    assert cli.main(['--input',str(incoming),'--output',str(alias/'output.json')])==2
    assert not (source/'output.json').exists()


def test_cli_compares_exact_raw_inputs(packet,tmp_path):
    baseline=tmp_path/'baseline.json';baseline.write_text(json.dumps(packet),encoding='utf-8')
    candidate=copy.deepcopy(packet);candidate['runId']=str(uuid.uuid4());candidate['sourceCommit']='d'*40
    candidate['samples'][3]=sample(4,4000,4050)
    incoming=tmp_path/'candidate.json';incoming.write_text(json.dumps(candidate),encoding='utf-8')
    output=tmp_path/'comparison.json'
    assert cli.main(['--input',str(incoming),'--baseline',str(baseline),'--output',str(output)])==0
    result=json.loads(output.read_bytes())
    assert result['inputs']['baseline']==hashlib.sha256(baseline.read_bytes()).hexdigest()
    assert result['result']['deltas']['effectiveFps']==pytest.approx(.25)
