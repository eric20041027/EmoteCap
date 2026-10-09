"""Offline all-attempt measurements; no inference or acceptance authority."""
import json
import math
from pathlib import Path
import re
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from emotecap_server.contract import BONES, MotionFrame

MAX_SAMPLES = 21601
STATUSES = ('ok', 'no-pose', 'detector-error', 'solver-error')
SKELETON = json.loads((Path(__file__).resolve().parents[1] / 'contracts/bones.json').read_bytes())['skeleton']
BY_NAME = {bone['name']: bone for bone in SKELETON}
BONE_INDEX = {name: index for index, name in enumerate(BONES)}


class MeasurementError(ValueError):
    """The selected measurements are incomplete, invalid or incomparable."""


def _keys(value, expected):
    if not isinstance(value, dict) or set(value) != set(expected.split()):
        raise MeasurementError('Unexpected or missing measurement fields')


def _number(value, lower=0, upper=1e12):
    if type(value) not in (int, float) or not math.isfinite(value) or not lower <= value <= upper:
        raise MeasurementError('Invalid measurement number')
    return value


def _text(value):
    if (not isinstance(value, str) or not 1 <= len(value) <= 160 or
            any(ord(char) < 32 for char in value) or '/' in value or '\\' in value or
            re.search(r'(?<![A-Za-z])[A-Za-z]:', value)):
        raise MeasurementError('Invalid or private measurement descriptor')


def _enum(value, choices):
    if not isinstance(value, str) or value not in choices:
        raise MeasurementError('Unsupported measurement setting')


def validate_packet(packet: dict) -> dict:
    _keys(packet, 'schema runId sourceCommit classification localProcessingAuthorized inputSha256 sourceKind environment settings measurement samples annotations')
    if packet['schema'] != 'emotecap-measurement-v1' or packet['localProcessingAuthorized'] is not True:
        raise MeasurementError('Unsupported or unauthorized measurement packet')
    try:
        if str(uuid.UUID(packet['runId'])) != packet['runId']:
            raise ValueError
    except (ValueError, TypeError, AttributeError):
        raise MeasurementError('Invalid measurement run ID') from None
    for key, length in (('sourceCommit', 40), ('inputSha256', 64)):
        if not isinstance(packet[key], str) or not re.fullmatch('[0-9a-f]{'+str(length)+'}', packet[key]):
            raise MeasurementError('Missing fixed measurement identity')
    _enum(packet['classification'], ('synthetic', 'observed'))
    _enum(packet['sourceKind'], ('video', 'camera'))
    environment = packet['environment']
    _keys(environment, 'kind os cpu gpu browser')
    _enum(environment['kind'], ('desktop', 'laptop'))
    for key in ('os', 'cpu', 'gpu', 'browser'):
        _text(environment[key])
    settings = packet['settings']
    _keys(settings, 'quality width height crop smoothing skeleton sdkVersion modelSha256 delegate handPolicy')
    for key, choices in (
        ('quality', ('fast', 'accurate')), ('crop', ('none', 'portrait')),
        ('smoothing', ('low', 'medium', 'high')), ('skeleton', ('full', 'body')),
        ('delegate', ('CPU', 'GPU')), ('handPolicy', ('off', 'every-frame', 'every-other-150ms')),
    ):
        _enum(settings[key], choices)
    _text(settings['sdkVersion'])
    if not isinstance(settings['modelSha256'], str) or not re.fullmatch('[0-9a-f]{64}', settings['modelSha256']):
        raise MeasurementError('Missing model identity')
    for key in ('width', 'height'):
        if type(settings[key]) is not int or not 1 <= settings[key] <= 8192:
            raise MeasurementError('Invalid observed dimensions')
    timing = packet['measurement']
    _keys(timing, 'clock latencyDefinition startedMs finishedMs warmupMs')
    if timing['clock'] != 'performance-monotonic' or timing['latencyDefinition'] != 'detection-to-solver':
        raise MeasurementError('Unsupported measurement clock or latency definition')
    start, end = _number(timing['startedMs']), _number(timing['finishedMs'])
    if not 1 <= end-start <= 180000:
        raise MeasurementError('Invalid measured wall interval')
    if not 0 <= _number(timing['warmupMs']) < end-start:
        raise MeasurementError('Invalid warmup interval')
    samples = packet['samples']
    if not isinstance(samples, list) or len(samples) > MAX_SAMPLES:
        raise MeasurementError('Invalid attempt count')
    previous_time, previous_end = -1, start
    for item in samples:
        _keys(item, 'inputTimeS startedMs finishedMs status frame')
        source_time = _number(item['inputTimeS'], upper=180)
        begin, finish = _number(item['startedMs']), _number(item['finishedMs'])
        if source_time <= previous_time or not previous_end <= begin <= finish <= end:
            raise MeasurementError('Attempts must be ordered and inside the measured window')
        previous_time, previous_end = source_time, finish
        _enum(item['status'], STATUSES)
        if item['status'] == 'ok':
            _keys(item['frame'], 't h r')
            _number(item['frame']['t'], upper=180)
            for field in ('h', 'r'):
                if not isinstance(item['frame'][field], list):
                    raise MeasurementError('Canonical motion arrays are required')
                for value in item['frame'][field]:
                    _number(value, -1e12, 1e12)
            try:
                validated = MotionFrame.model_validate(item['frame'])
            except ValueError:
                raise MeasurementError('Invalid canonical motion sample') from None
            if abs(validated.t-source_time) > 1e-6:
                raise MeasurementError('Motion time differs from input time')
        elif item['frame'] is not None:
            raise MeasurementError('Failed attempts cannot contain successful frames')
    annotations = packet['annotations']
    if not isinstance(annotations, list) or len(annotations) > 32:
        raise MeasurementError('Invalid annotation count')
    names = set()
    for item in annotations:
        _keys(item, 'id kind startS endS')
        name = item['id']
        if not isinstance(name, str) or not re.fullmatch('[A-Za-z0-9_-]{1,64}', name) or name in names:
            raise MeasurementError('Invalid or duplicate annotation identity')
        names.add(name)
        _enum(item['kind'], ('stationary', 'left-stance', 'right-stance'))
        begin, finish = _number(item['startS'], upper=180), _number(item['endS'], upper=180)
        if not samples or not samples[0]['inputTimeS'] <= begin < finish <= samples[-1]['inputTimeS']:
            raise MeasurementError('Annotation is outside the observed input interval')
    return packet


def _unit(quaternion):
    length = math.sqrt(sum(value*value for value in quaternion))
    return [value/length for value in quaternion]


def _angular_degrees(left, right):
    dot = sum(a*b for a, b in zip(_unit(left), _unit(right)))
    return math.degrees(2*math.acos(min(1.0, abs(dot))))


def _rotate(quaternion, vector):
    x, y, z, w = _unit(quaternion)
    vx, vy, vz = vector
    tx, ty, tz = 2*(y*vz-z*vy), 2*(z*vx-x*vz), 2*(x*vy-y*vx)
    return [vx+w*tx+y*tz-z*ty, vy+w*ty+z*tx-x*tz, vz+w*tz+x*ty-y*tx]


def _heel(frame, side):
    joints, world = {}, {}
    for bone in SKELETON:
        name, parent = bone['name'], bone['parent']
        index = BONE_INDEX.get(name)
        world[name] = frame['r'][index*4:index*4+4] if index is not None else world.get(parent, [0,0,0,1])
        if parent is None:
            joints[name] = [0,0,0]
        else:
            offset = _rotate(world[parent], [a-b for a, b in zip(bone['head'], BY_NAME[parent]['head'])])
            joints[name] = [a+b for a, b in zip(joints[parent], offset)]
    foot = side+'Foot'
    offset = _rotate(world[foot], [0,-.08,-.04])
    return [a+b+c for a, b, c in zip(joints[foot], offset, frame['h'])]


def _annotation(item, measured):
    samples = [row for row in measured if item['startS'] <= row['inputTimeS'] <= item['endS']]
    valid = [row for row in samples if row['status'] == 'ok']
    result = {**item, 'attempts':len(samples), 'validSamples':len(valid)}
    if item['kind'] == 'stationary':
        values = None
        if len(valid) >= 2:
            reference = valid[0]['frame']['r']
            values = {}
            for index, name in enumerate(BONES):
                part = slice(index*4, index*4+4)
                departures = [_angular_degrees(reference[part], row['frame']['r'][part]) for row in valid]
                values[name] = math.sqrt(sum(value*value for value in departures)/len(departures))
        result['rmsDegreesByBone'] = values
    else:
        side = 'Left' if item['kind'] == 'left-stance' else 'Right'
        pairs, distance = 0, 0.0
        for previous, current in zip(samples, samples[1:]):
            if previous['status'] == current['status'] == 'ok':
                left, right = _heel(previous['frame'], side), _heel(current['frame'], side)
                distance += math.hypot(right[0]-left[0], right[2]-left[2])
                pairs += 1
        result.update(validPairs=pairs, horizontalHeelPathM=distance if pairs else None)
    return result


def _measured(packet):
    timing = packet['measurement']
    cutoff = timing['startedMs']+timing['warmupMs']
    return [row for row in packet['samples'] if row['startedMs'] >= cutoff]


def _coverage(packet):
    def interval(rows):
        return [rows[0]['inputTimeS'], rows[-1]['inputTimeS']] if rows else None
    return {'overall':interval(packet['samples']), 'measured':interval(_measured(packet))}


def _summary(packet):
    timing = packet['measurement']
    cutoff = timing['startedMs']+timing['warmupMs']
    measured = _measured(packet)
    overall = {status:sum(row['status'] == status for row in packet['samples']) for status in STATUSES}
    statuses = {status:sum(row['status'] == status for row in measured) for status in STATUSES}
    durations = sorted(row['finishedMs']-row['startedMs'] for row in measured)
    count, successful = len(measured), statuses['ok']
    return {
        'qualification':'pending', 'classification':packet['classification'],
        'runId':packet['runId'], 'sourceCommit':packet['sourceCommit'], 'inputSha256':packet['inputSha256'],
        'sourceKind':packet['sourceKind'], 'environment':dict(packet['environment']),
        'settings':dict(packet['settings']), 'measurement':dict(timing),
        'inputCoverageS':_coverage(packet),
        'counts':{'totalAttempts':len(packet['samples']), 'measuredAttempts':count,
                  'warmupAttempts':len(packet['samples'])-count, 'statuses':overall, 'measuredStatuses':statuses},
        'metrics':{'effectiveFps':successful*1000/(timing['finishedMs']-cutoff),
                   'failureRate':(count-successful)/count if count else None,
                   'p95DetectionToSolverMs':durations[math.ceil(.95*count)-1] if count else None},
        'annotations':[_annotation(item, measured) for item in packet['annotations']],
        'limitations':['Run/source/input identities and observed classification are collector declarations, not authenticated capture evidence.',
                       'Operator declarations are not verified rights or hardware evidence.',
                       'Detection-to-solver duration is not camera-to-display latency.',
                       'Stationary departure and canonical heel drift are proxies, not ground-truth accuracy.',
                       'Synthetic receipts do not qualify real inference, target hardware or release acceptance.'],
    }


def summarize(packet: dict) -> dict:
    return _summary(validate_packet(packet))


def compare(baseline: dict, candidate: dict) -> dict:
    validate_packet(baseline)
    validate_packet(candidate)
    keys = ('inputSha256', 'sourceKind', 'classification', 'environment', 'settings', 'annotations')
    if baseline['runId'] == candidate['runId'] or any(baseline[key] != candidate[key] for key in keys):
        raise MeasurementError('Comparison conditions differ or reuse the same run')
    for key in ('clock', 'latencyDefinition', 'warmupMs'):
        if baseline['measurement'][key] != candidate['measurement'][key]:
            raise MeasurementError('Comparison measurement definitions differ')
    if _coverage(baseline) != _coverage(candidate):
        raise MeasurementError('Comparison evaluated source intervals differ')
    left, right = _summary(baseline), _summary(candidate)
    deltas = {key:right['metrics'][key]-value if value is not None and right['metrics'][key] is not None else None
              for key, value in left['metrics'].items()}
    return {'qualification':'pending', 'baseline':left, 'candidate':right, 'deltas':deltas}
