"""Write fresh offline measurement receipts; never execute camera/SDK work."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

from motion_measurements import MeasurementError, compare, summarize
from package_files import PackageError, ordinary_path, sha256_file, write_json

MAX_PACKET_BYTES = 32*1024*1024


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise MeasurementError('Duplicate measurement field')
        result[key] = value
    return result


def _constant(value):
    raise MeasurementError('Nonfinite JSON measurement')


def _load(path):
    path = ordinary_path(path)
    if not path.is_file() or path.stat().st_nlink != 1 or path.stat().st_size > MAX_PACKET_BYTES:
        raise MeasurementError('Measurement input is not a bounded ordinary file')
    with path.open('rb') as incoming:
        raw = incoming.read(MAX_PACKET_BYTES+1)
    if len(raw) > MAX_PACKET_BYTES:
        raise MeasurementError('Measurement input grew beyond its limit')
    packet = json.loads(raw.decode('utf-8'), object_pairs_hook=_object, parse_constant=_constant)
    return packet, hashlib.sha256(raw).hexdigest()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Offline M4 measurements; no inference or acceptance approval')
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--baseline', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        destination = ordinary_path(args.output)
        if destination.exists():
            raise MeasurementError('Report exists; choose a fresh output')
        candidate, digest = _load(args.input)
        inputs = {'candidate':digest}
        result = summarize(candidate)
        if args.baseline is not None:
            baseline, inputs['baseline'] = _load(args.baseline)
            result = compare(baseline, candidate)
        root = Path(__file__).resolve().parents[1]
        sources = ('scripts/evaluate_motion.py', 'scripts/motion_measurements.py',
                   'scripts/package_files.py', 'server/emotecap_server/contract.py',
                   'server/uv.lock', 'contracts/bones.json')
        evaluator = {name:sha256_file(root/name) for name in sources}
        receipt = {'schema':'emotecap-measurement-receipt-v1', 'qualification':'pending',
                   'inputs':inputs, 'evaluator':evaluator, 'result':result}
        write_json(destination, receipt)
        print(json.dumps({'status':'offline-receipt-written', 'classification':candidate['classification'],
                          'attempts':len(candidate['samples']), 'comparison':args.baseline is not None,
                          'qualification':'pending'}))
        return 0
    except (MeasurementError, PackageError, OSError, ValueError, TypeError, RecursionError):
        print('Measurement incomplete; check the selected packet or choose a fresh report path.', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
