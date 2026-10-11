"""Offline recipient choice for Microsoft Code in the verified Windows runtime."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import stat
import uuid

SCHEMA = 'emotecap-runtime-terms-acceptance-v1'
MAX_RECEIPT_BYTES = 8192
TERMS_FILES = ('RUNTIME-TERMS.en.txt', 'RUNTIME-TERMS.zh-TW.txt', 'python/LICENSE.txt')


class TermsError(RuntimeError):
    """Do not start the application without a usable local choice."""


def _ordinary(path):
    for selected in (*reversed(path.absolute().parents), path.absolute()):
        if selected.is_symlink() or getattr(selected, 'is_junction', lambda: False)():
            raise TermsError('Linked private paths are unsupported; choose an ordinary private data folder')
    if path.exists():
        info = path.stat()
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise TermsError('The acceptance record must be an ordinary private file')


def _fingerprint(manifest):
    relevant = [entry for entry in manifest['files']
        if entry['path'] in (*TERMS_FILES, 'runtime_terms.py')
        or Path(entry['path']).suffix.lower() in ('.exe', '.dll', '.pyd')]
    required = {*TERMS_FILES, 'runtime_terms.py', 'python/python.exe'}
    if not required.issubset({entry['path'] for entry in relevant}):
        raise TermsError('The verified package is missing its runtime terms')
    body = json.dumps({'schema': SCHEMA, 'files': sorted(relevant, key=lambda entry: entry['path'])},
        sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(body).hexdigest()


def show_terms(root: Path, *, original: bool = False) -> None:
    for name in TERMS_FILES if original else TERMS_FILES[:2]:
        print(f'\n--- {name} ---\n')
        print((root/name).read_text(encoding='utf-8'))
    if not original:
        print('Original licensing text / 原始授權全文: python/LICENSE.txt (READ)')


def _object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError('Duplicate receipt property')
        value[key] = item
    return value


def _constant(value):
    raise ValueError('Nonfinite receipt value')


def _matches(path, fingerprint):
    _ordinary(path)
    if not path.exists():
        return False
    with path.open('rb') as stream:
        body = stream.read(MAX_RECEIPT_BYTES+1)
    if len(body) > MAX_RECEIPT_BYTES:
        raise TermsError('The local acceptance record is oversized; preserve it and choose a new private data folder')
    try:
        record = json.loads(body.decode('utf-8'), object_pairs_hook=_object, parse_constant=_constant)
        if (not isinstance(record, dict)
                or set(record) != {'schema', 'termsSHA256', 'accepted', 'acceptedAtUTC'}
                or record['schema'] != SCHEMA or record['termsSHA256'] != fingerprint
                or record['accepted'] is not True
                or not isinstance(record['acceptedAtUTC'], str) or not record['acceptedAtUTC'].endswith('Z')):
            return False
        parsed = datetime.fromisoformat(record['acceptedAtUTC'])
        return parsed.tzinfo is not None and parsed.utcoffset().total_seconds() == 0
    except (ValueError, UnicodeError, TypeError):
        return False


def _write_receipt(path, fingerprint):
    _ordinary(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    _ordinary(path)
    temporary = path.with_name(f'.runtime-terms-{uuid.uuid4()}.tmp')
    body = (json.dumps({'schema': SCHEMA, 'termsSHA256': fingerprint, 'accepted': True,
        'acceptedAtUTC': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')},
        sort_keys=True) + '\n').encode('utf-8')
    try:
        with temporary.open('xb') as stream:
            stream.write(body)
            stream.flush()
            os.fsync(stream.fileno())
        _ordinary(path)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def ensure_accepted(root: Path, manifest: dict, data_dir: Path) -> bool:
    """Use a matching local preference or require a deliberate recipient choice."""
    path = data_dir/'runtime-terms-acceptance.json'
    fingerprint = _fingerprint(manifest)
    try:
        if _matches(path, fingerprint):
            return True
        show_terms(root)
        while True:
            try:
                choice = input('\nREAD = original text / 原文; ACCEPT = agree / 同意; EXIT = stop / 退出\n> ').strip().upper()
            except (EOFError, KeyboardInterrupt):
                print('\nRuntime terms not accepted. Service was not started. / 未接受，服務未啟動。')
                return False
            if choice == 'READ':
                show_terms(root, original=True)
            elif choice == 'ACCEPT':
                _write_receipt(path, fingerprint)
                print('\nRuntime terms accepted locally. / 已在本機保存同意選擇。')
                return True
            else:
                print('Runtime terms not accepted. Service was not started. / 未接受，服務未啟動。')
                return False
    except OSError:
        raise TermsError('Cannot read or save the local acceptance record; service was not started') from None
