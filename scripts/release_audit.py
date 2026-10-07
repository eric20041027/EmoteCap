"""Bounded read-only credential heuristics for release source and Git history."""
import argparse
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

MAX_COMMITS = 5000
MAX_BLOBS = 50000
MAX_CANDIDATES = 50000
MAX_FINDINGS = 10000
MAX_TAGS = 5000
MAX_BLOB_BYTES = 16 * 1024 * 1024
MAX_TOTAL_BYTES = 512 * 1024 * 1024
MAX_GIT_BYTES = MAX_BLOB_BYTES + 4 * 1024 * 1024
OID = re.compile(rb'(?:[0-9a-f]{40}|[0-9a-f]{64})')
RULES = (
    ('google-api-key', rb'(?<![A-Za-z0-9_-])AIza[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])'),
    ('github-token', rb'\bgh[pousr]_[A-Za-z0-9]{36,255}\b'),
    ('github-fine-token', rb'\bgithub_pat_[A-Za-z0-9_]{22,255}\b'),
    ('aws-access-key', rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    ('slack-token', rb'\bxox[baprs]-[A-Za-z0-9-]{16,255}\b'),
    ('openai-key', rb'\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,255}\b'),
    ('private-key', rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    ('credential-assignment', rb'(?i)\b(?:gemini_api_key|api[_-]?key|access_token|password|client_secret|secret[_-]?key)\b["\']?\s*[:=]\s*(?P<quote>["\'])(?P<value>[A-Za-z0-9_./+=-]{16,512})(?P=quote)'),
    ('credential-assignment', rb'(?m)^[ \t]*(?:export[ \t]+)?(?:GEMINI_API_KEY|API_KEY|ACCESS_TOKEN|PASSWORD|CLIENT_SECRET|SECRET_KEY)[ \t]*=[ \t]*(?P<value>[A-Za-z0-9_./+=-]{16,512})[ \t]*\r?$'),
)
PATTERNS = [(name, re.compile(pattern)) for name, pattern in RULES]
PLACEHOLDERS = {b'replace_with_your_key', b'your_gemini_api_key', b'your_api_key', b'gemini_api_key'}


class AuditIncomplete(Exception):
    """A scan prerequisite failed; never interpret this as a clean scan."""


def matches(data: bytes):
    for rule, pattern in PATTERNS:
        for match in pattern.finditer(data):
            if rule == 'credential-assignment':
                value = match.group('value')
                entropy = -sum((count / len(value)) * math.log2(count / len(value))
                               for count in Counter(value).values())
                if value.lower() in PLACEHOLDERS or entropy < 3.5:
                    continue
            yield rule, match


def safe_descriptor(value):
    if isinstance(value, str):
        if next(matches(value.encode('utf-8', errors='surrogateescape')), None):
            return '<redacted:' + hashlib.sha256(value.encode('utf-8', errors='surrogateescape')).hexdigest() + '>'
    elif isinstance(value, list):
        return [safe_descriptor(part) for part in value]
    elif isinstance(value, dict):
        return {key: safe_descriptor(part) for key, part in value.items()}
    return value


def scan_bytes(data: bytes, source: dict) -> list[dict]:
    findings = []
    safe_source = safe_descriptor(source)
    for rule, match in matches(data):
        if len(findings) >= MAX_FINDINGS:
            raise AuditIncomplete('Finding limit exceeded; scan is incomplete')
        findings.append({**safe_source, 'rule': rule, 'offset': match.start(),
                         'line': data.count(b'\n', 0, match.start()) + 1,
                         'fingerprint': hashlib.sha256(match.group()).hexdigest()})
    return findings


def checked_git(repo: Path, arguments: list[str], *, data: bytes | None = None) -> bytes:
    # File-backed capture keeps large Git metadata out of memory; stderr is not retained.
    try:
        with tempfile.TemporaryFile('w+b') as output:
            result = subprocess.run(['git', '--no-replace-objects', '-C', str(repo), *arguments],
                                    input=data, stdout=output, stderr=subprocess.DEVNULL,
                                    timeout=30, check=False)
            if result.returncode:
                raise AuditIncomplete('Git operation failed; scan is incomplete')
            if output.tell() > MAX_GIT_BYTES:
                raise AuditIncomplete('Git output limit exceeded; scan is incomplete')
            output.seek(0)
            return output.read(MAX_GIT_BYTES + 1)
    except (OSError, subprocess.TimeoutExpired):
        raise AuditIncomplete('Git could not finish; scan is incomplete') from None


def checked_oid(value: bytes) -> str:
    if not OID.fullmatch(value):
        raise AuditIncomplete('Unexpected Git object identity; scan is incomplete')
    return value.decode('ascii')


def git_path(value: bytes) -> Path:
    if not value.endswith(b'\n') or b'\0' in value:
        raise AuditIncomplete('Unexpected Git path; scan is incomplete')
    value = value[:-1]
    if os.name == 'nt' and value.endswith(b'\r'):
        value = value[:-1]
    return Path(value.decode('utf-8', errors='surrogateescape')).resolve()


def audit_repository(repo: Path, *, max_blob_bytes: int = MAX_BLOB_BYTES,
                     max_total_bytes: int = MAX_TOTAL_BYTES) -> dict:
    repo = Path(repo).resolve()
    if (max_blob_bytes <= 0 or max_blob_bytes > MAX_BLOB_BYTES
            or max_total_bytes <= 0 or max_total_bytes > MAX_TOTAL_BYTES):
        raise AuditIncomplete('Invalid scan budget')
    if any(os.environ.get(name) for name in ('GIT_GRAFT_FILE','GIT_DIR','GIT_WORK_TREE','GIT_COMMON_DIR','GIT_INDEX_FILE')):
        raise AuditIncomplete('Git source/graft overrides require separate assessment')
    repo = git_path(checked_git(repo, ['rev-parse', '--show-toplevel']))
    grafts = git_path(checked_git(repo, ['rev-parse', '--path-format=absolute', '--git-path', 'info/grafts']))
    try:
        if grafts.is_symlink() or (grafts.exists() and (not grafts.is_file() or grafts.stat().st_size)):
            raise AuditIncomplete('Active Git graft configuration makes history incomplete')
    except OSError:
        raise AuditIncomplete('Git graft configuration could not be assessed') from None
    if checked_git(repo, ['rev-parse', '--is-shallow-repository']).strip() != b'false':
        raise AuditIncomplete('Shallow history is incomplete; obtain the full history first')
    head = checked_oid(checked_git(repo, ['rev-parse', '--verify', 'HEAD^{commit}']).strip())
    commits = [checked_oid(line) for line in checked_git(
        repo, ['rev-list', '--all', f'--max-count={MAX_COMMITS + 1}']).splitlines()]
    if not commits or len(commits) > MAX_COMMITS:
        raise AuditIncomplete('Commit limit exceeded or history unavailable')
    objects = {}
    for commit in commits:
        for record in checked_git(repo, ['ls-tree', '-r', '-z', commit]).split(b'\0'):
            if not record:
                continue
            try:
                metadata, path = record.split(b'\t', 1)
                mode, kind, raw_oid = metadata.split(b' ')
            except ValueError:
                raise AuditIncomplete('Malformed Git tree; scan is incomplete') from None
            if kind != b'blob' or mode not in (b'100644', b'100755', b'120000'):
                raise AuditIncomplete('Non-blob source requires a separate scan')
            oid = checked_oid(raw_oid)
            descriptor = objects.setdefault(oid, {'commit': commit, 'paths': []})
            name = path.decode('utf-8', errors='surrogateescape')
            if name not in descriptor['paths'] and len(descriptor['paths']) < 4:
                descriptor['paths'].append(name)
            if len(objects) > MAX_BLOBS:
                raise AuditIncomplete('Blob limit exceeded; scan is incomplete')

    identities = list(objects)
    query = ''.join(oid + '\n' for oid in identities).encode('ascii')
    sizes = {}
    for line in checked_git(repo, ['cat-file', '--batch-check'], data=query).splitlines():
        try:
            raw_oid, kind, size_text = line.split()
            oid = checked_oid(raw_oid)
            size = int(size_text)
        except ValueError:
            raise AuditIncomplete('Missing or malformed Git blob; scan is incomplete') from None
        if oid not in objects or oid in sizes or kind != b'blob' or size < 0 or size > max_blob_bytes:
            raise AuditIncomplete('Git blob exceeds scan limits or is unavailable')
        sizes[oid] = size
    if set(sizes) != set(objects):
        raise AuditIncomplete('Git blob inspection is incomplete')

    findings = []
    total = 0
    def inspect(data, source):
        nonlocal total
        total += len(data)
        if len(data) > max_blob_bytes or total > max_total_bytes:
            raise AuditIncomplete('Scan byte budget exceeded; scan is incomplete')
        findings.extend(scan_bytes(data, {**source, 'sha256': hashlib.sha256(data).hexdigest()}))
        if len(findings) > MAX_FINDINGS:
            raise AuditIncomplete('Finding limit exceeded; scan is incomplete')

    for commit in commits:
        inspect(checked_git(repo, ['cat-file', 'commit', commit]), {'kind': 'commit', 'commit': commit})

    tags = set()
    pending_tags = []
    for line in checked_git(repo, ['for-each-ref', '--format=%(objecttype) %(objectname)']).splitlines():
        fields = line.split()
        if len(fields) != 2:
            raise AuditIncomplete('Malformed tag reference; scan is incomplete')
        if fields[0] not in (b'commit',b'tag'):
            raise AuditIncomplete('Non-commit reference target requires a separate scan')
        if fields[0] == b'tag':
            oid = checked_oid(fields[1])
            if oid not in tags:
                tags.add(oid)
                pending_tags.append(oid)
    while pending_tags:
        if len(tags) > MAX_TAGS:
            raise AuditIncomplete('Tag limit exceeded; scan is incomplete')
        oid = pending_tags.pop()
        data = checked_git(repo, ['cat-file', 'tag', oid])
        inspect(data, {'kind': 'tag', 'objectId': oid})
        headers = data.partition(b'\n\n')[0].splitlines()
        if len(headers) < 2 or not headers[0].startswith(b'object ') or not headers[1].startswith(b'type '):
            raise AuditIncomplete('Malformed tag object; scan is incomplete')
        if headers[1] not in (b'type commit',b'type tag'):
            raise AuditIncomplete('Non-commit annotated tag target requires a separate scan')
        if headers[1] == b'type tag':
            target = checked_oid(headers[0][7:])
            if target not in tags:
                tags.add(target)
                pending_tags.append(target)

    if sum(sizes.values()) > max_total_bytes - total:
        raise AuditIncomplete('Known history bodies exceed the remaining scan budget')

    batch = []
    batch_bytes = 0
    def inspect_batch():
        payload = checked_git(repo, ['cat-file', '--batch'],
                              data=''.join(oid + '\n' for oid in batch).encode('ascii'))
        offset = 0
        for oid in batch:
            end = payload.find(b'\n', offset)
            expected = f'{oid} blob {sizes[oid]}'.encode('ascii')
            if end < offset or payload[offset:end] != expected:
                raise AuditIncomplete('Malformed Git blob body; scan is incomplete')
            offset = end + 1
            body = payload[offset:offset + sizes[oid]]
            offset += sizes[oid]
            if len(body) != sizes[oid] or payload[offset:offset + 1] != b'\n':
                raise AuditIncomplete('Truncated Git blob; scan is incomplete')
            offset += 1
            inspect(body, {'kind': 'history', 'objectId': oid, **objects[oid]})
        if offset != len(payload):
            raise AuditIncomplete('Unexpected Git blob output; scan is incomplete')

    for oid in identities:
        if sizes[oid] > max_total_bytes - total:
            raise AuditIncomplete('Scan byte budget exceeded; scan is incomplete')
        if batch and batch_bytes + sizes[oid] > max_blob_bytes:
            inspect_batch()
            batch = []
            batch_bytes = 0
        batch.append(oid)
        batch_bytes += sizes[oid]
    if batch:
        inspect_batch()

    candidates = sorted(set(checked_git(repo, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split(b'\0')) - {b''})
    if len(candidates) > MAX_CANDIDATES:
        raise AuditIncomplete('Current source candidate limit exceeded')
    current_files = 0
    missing_files = 0
    digest = hashlib.sha256()
    for raw_name in candidates:
        name = raw_name.decode('utf-8', errors='surrogateescape')
        path = repo / name
        try:
            if path.is_symlink() or not path.resolve().is_relative_to(repo):
                raise AuditIncomplete('Current source link/outside path requires separate assessment')
            if not path.exists():
                missing_files += 1
                continue
            allowed = min(max_blob_bytes, max_total_bytes - total)
            if not path.is_file() or path.stat().st_size > allowed:
                raise AuditIncomplete('Current candidate is not a bounded regular file')
            with path.open('rb') as file:
                data = file.read(allowed + 1)
        except OSError:
            raise AuditIncomplete('Current source could not be read; scan is incomplete') from None
        inspect(data, {'kind': 'current', 'path': name})
        digest.update(raw_name + b'\0' + hashlib.sha256(data).digest())
        current_files += 1
    return {'schema': 'emotecap-release-scan-v1', 'head': head, 'commits': commits,
            'historyBlobs': len(objects), 'currentFiles': current_files,
            'tagObjects': len(tags),
            'missingCurrentCandidates': missing_files, 'currentSourceSha256': digest.hexdigest(),
            'bytesScanned': total, 'findings': findings,
            'scope': 'All locally reachable Git refs, raw commit/tag metadata/messages and tracked/nonignored current candidates; ignored environments/media/caches excluded. Heuristics only; at most four representative paths per historical blob. Not release/license approval.'}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Read-only redacted release source/history credential scan')
    parser.add_argument('--repo', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.output.exists():
            raise AuditIncomplete('Report exists; choose a new output path')
        report = audit_repository(args.repo)
        with args.output.open('x', encoding='utf-8') as output:
            json.dump(report, output, ensure_ascii=True, sort_keys=True, allow_nan=False, indent=2)
        count = len(report['findings'])
        print(json.dumps({'status': 'findings' if count else 'no-detected-credentials',
                          'commits': len(report['commits']), 'historyBlobs': report['historyBlobs'],
                          'currentFiles': report['currentFiles'], 'bytesScanned': report['bytesScanned'],
                          'findings': count}))
        return 1 if count else 0
    except (AuditIncomplete, OSError, ValueError):
        print('Release audit incomplete; no clean result. Check prerequisites or choose a new report path.', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
