"""Bounded regular-file operations for owned development artifacts."""
import contextlib
import gzip
import hashlib
import json
import os
import re
import stat
import tarfile
import zipfile
from pathlib import Path

MAX_FILES = 20000
MAX_FILE_BYTES = 64 * 1024 * 1024
MAX_TOTAL_BYTES = 512 * 1024 * 1024
MAX_MANIFEST_BYTES = 2 * 1024 * 1024

class PackageError(RuntimeError):
    """A candidate is incomplete or its inputs are unsafe."""


def is_link(path: Path) -> bool:
    return path.is_symlink() or getattr(path, 'is_junction', lambda: False)()


def ordinary_path(path: Path) -> Path:
    absolute = path.absolute()
    for part in absolute.parts[1:]:
        if part not in ('.', '..'):
            safe_name(part)
    for part in (*reversed(absolute.parents), absolute):
        if is_link(part):
            raise PackageError('Linked package paths are unsupported')
    # Inspect the original components before collapsing '..', so an alias
    # hidden by lexical normalization is never silently followed.
    return absolute.resolve()

def safe_name(name: str) -> str:
    if not isinstance(name, str) or not name or len(name) > 240:
        raise PackageError('Invalid package path')
    parts = name.split('/')
    for part in parts:
        if (not part or part in ('.', '..') or part.endswith((' ', '.')) or
                any(ord(c) < 32 or c in '\\:*?"<>|' for c in part) or
                re.fullmatch(r'(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])',
                             part.split('.')[0].upper())):
            raise PackageError('Unsafe package path')
    return name


def _register(name: str, identities: dict[str, str]) -> None:
    parts = name.split('/')
    for length in range(1, len(parts) + 1):
        prefix = '/'.join(parts[:length])
        key = prefix.casefold()
        if key in identities and identities[key] != prefix:
            raise PackageError('Case-insensitive package path collision')
        identities[key] = prefix


def sha256_file(path: Path) -> str:
    ordinary_path(path)
    if not path.is_file() or path.stat().st_size > MAX_FILE_BYTES or path.stat().st_nlink != 1:
        raise PackageError('Package input is not a bounded regular file')
    digest = hashlib.sha256()
    count = 0
    with path.open('rb') as incoming:
        while chunk := incoming.read(1024 * 1024):
            count += len(chunk)
            if count > MAX_FILE_BYTES:
                raise PackageError('Package input grew beyond its budget')
            digest.update(chunk)
    return digest.hexdigest()


def _copy_stream(incoming, target: Path, size: int) -> None:
    ordinary_path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    with target.open('xb') as output:
        while chunk := incoming.read(min(1024 * 1024, size - total + 1)):
            total += len(chunk)
            if total > size:
                raise PackageError('Package input changed during copying')
            output.write(chunk)
    if total != size:
        raise PackageError('Package input was truncated')

def copy_tree(source: Path, target: Path) -> None:
    inventory = file_inventory(source)
    ordinary_path(target)
    if target.exists():
        raise PackageError('Output exists; choose a new destination')
    target.mkdir(parents=True)
    try:
        for entry in inventory:
            incoming = source / entry['path']
            ordinary_path(incoming)
            with incoming.open('rb') as stream:
                _copy_stream(stream, target / entry['path'], entry['size'])
        verify_inventory(target, inventory)
    except OSError:
        raise PackageError('Cannot copy the selected package files') from None


class _LimitedReader:
    def __init__(self, source):
        self.source = source
        self.count = 0

    def read(self, size=-1):
        budget = MAX_TOTAL_BYTES + 32 * 1024 * 1024
        amount = min(size if size >= 0 else budget + 1, budget - self.count + 1)
        data = self.source.read(amount)
        self.count += len(data)
        if self.count > budget:
            raise PackageError('Expanded archive exceeds the payload budget')
        return data


@contextlib.contextmanager
def _tar_input(path: Path):
    ordinary_path(path)
    if not path.is_file() or path.stat().st_size > MAX_TOTAL_BYTES:
        raise PackageError('Archive is not a bounded regular file')
    with path.open('rb') as raw:
        compressed = raw.read(2) == b'\x1f\x8b'
        raw.seek(0)
        with contextlib.ExitStack() as stack:
            source = stack.enter_context(gzip.GzipFile(fileobj=raw)) if compressed else raw
            incoming = stack.enter_context(tarfile.open(fileobj=_LimitedReader(source), mode='r|'))
            yield incoming


def _member_path(member, strip_prefix: str) -> str | None:
    name = safe_name(member.name.rstrip('/') if member.isdir() else member.name)
    if strip_prefix:
        safe_name(strip_prefix)
        if name == strip_prefix and member.isdir():
            return None
        if not name.startswith(strip_prefix + '/'):
            raise PackageError('Unexpected archive prefix')
        name = name[len(strip_prefix) + 1:]
    return safe_name(name)

def extract_tar(archive: Path, target: Path, *, strip_prefix: str = '') -> None:
    ordinary_path(target)
    if target.exists():
        raise PackageError('Output exists; choose a new destination')
    entries = []
    seen = set()
    identities = {}
    file_paths = set()
    total = 0
    try:
        with _tar_input(archive) as incoming:
            for member in incoming:
                if len(entries) >= MAX_FILES:
                    raise PackageError('Archive contains too many entries')
                if not (member.isdir() or member.isfile()):
                    raise PackageError('Unsupported archive entry')
                name = _member_path(member, strip_prefix)
                if name is None:
                    continue
                _register(name, identities)
                if name.casefold() in seen:
                    raise PackageError('Duplicate archive path')
                seen.add(name.casefold())
                if member.size < 0 or member.size > MAX_FILE_BYTES:
                    raise PackageError('Archive member exceeds the file budget')
                if member.isfile():
                    file_paths.add(name)
                    total += member.size
                if total > MAX_TOTAL_BYTES:
                    raise PackageError('Archive exceeds the payload budget')
                entries.append((name, member.isdir(), member.size))
        for name, _, _ in entries:
            if any(str(parent).replace(os.sep, '/') in file_paths for parent in Path(name).parents if str(parent) != '.'):
                raise PackageError('Archive file/directory collision')
        target.mkdir(parents=True)
        position = 0
        with _tar_input(archive) as incoming:
            for member in incoming:
                name = _member_path(member, strip_prefix)
                if name is None:
                    continue
                if position >= len(entries) or (name, member.isdir(), member.size) != entries[position]:
                    raise PackageError('Archive changed during extraction')
                position += 1
                if member.isdir():
                    (target / name).mkdir(parents=True, exist_ok=True)
                elif member.isfile():
                    with incoming.extractfile(member) as stream:
                        _copy_stream(stream, target / name, member.size)
                else:
                    raise PackageError('Archive changed during extraction')
        if position != len(entries):
            raise PackageError('Archive changed during extraction')
    except (OSError, tarfile.TarError, EOFError):
        raise PackageError('Cannot read or extract the bounded archive') from None

def file_inventory(root: Path) -> list[dict]:
    ordinary_path(root)
    if not root.is_dir():
        raise PackageError('Payload folder is missing')
    inventory = []
    identities = {}
    total = 0
    try:
        for directory, directories, names in os.walk(root, followlinks=False, onerror=lambda e: (_ for _ in ()).throw(e)):
            for name in directories + names:
                path = Path(directory) / name
                ordinary_path(path)
                relative = safe_name(path.relative_to(root).as_posix())
                _register(relative, identities)
                info = path.stat()
                if stat.S_ISDIR(info.st_mode):
                    continue
                if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_FILE_BYTES or info.st_nlink != 1:
                    raise PackageError('Payload contains an unsupported or oversized file')
                total += info.st_size
                if len(inventory) >= MAX_FILES or total > MAX_TOTAL_BYTES:
                    raise PackageError('Payload exceeds its budget')
                inventory.append({'path': relative, 'size': info.st_size, 'sha256': sha256_file(path)})
    except OSError:
        raise PackageError('Cannot inventory the selected payload') from None
    return sorted(inventory, key=lambda entry: entry['path'])

def verify_inventory(root: Path, files: list[dict]) -> None:
    if not isinstance(files, list) or len(files) > MAX_FILES:
        raise PackageError('Invalid payload inventory')
    seen = set()
    total = 0
    for entry in files:
        if not isinstance(entry, dict) or set(entry) != {'path', 'size', 'sha256'}:
            raise PackageError('Invalid payload file record')
        name = safe_name(entry['path'])
        if name.casefold() in seen:
            raise PackageError('Duplicate payload record')
        seen.add(name.casefold())
        size = entry['size']
        digest = entry['sha256']
        if type(size) is not int or not 0 <= size <= MAX_FILE_BYTES or not isinstance(digest, str) or not re.fullmatch('[0-9a-f]{64}', digest):
            raise PackageError('Invalid payload size or digest')
        total += size
    if total > MAX_TOTAL_BYTES or file_inventory(root) != sorted(files, key=lambda entry: entry['path']):
        raise PackageError('Payload is missing, changed or contains extra files')

def write_json(path: Path, value: dict) -> None:
    try:
        data = json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf-8')
        if len(data) > MAX_MANIFEST_BYTES:
            raise PackageError('Manifest exceeds its budget')
        ordinary_path(path)
        with path.open('xb') as output:
            output.write(data)
    except (OSError, ValueError):
        raise PackageError('Cannot write a new finite manifest') from None

def zip_payload(root: Path, output: Path, *, omit_incomplete_marker: bool = False) -> str:
    inventory = file_inventory(root)
    if omit_incomplete_marker:
        inventory = [entry for entry in inventory if entry['path'] != '.incomplete']
    ordinary_path(output)
    try:
        with output.open('xb') as stream:
            with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
                for entry in inventory:
                    info = zipfile.ZipInfo(entry['path'], date_time=(1980, 1, 1, 0, 0, 0))
                    info.create_system = 3
                    info.external_attr = (stat.S_IFREG | 0o644) << 16
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info._compresslevel = 9  # Pinned CPython3.12 ZipInfo owns the streaming compression level.
                    with (root / entry['path']).open('rb') as incoming, archive.open(info, 'w') as outgoing:
                        count = 0
                        digest = hashlib.sha256()
                        while chunk := incoming.read(min(1024 * 1024, entry['size'] - count + 1)):
                            count += len(chunk)
                            if count > entry['size']:
                                raise PackageError('Payload changed while creating archive')
                            digest.update(chunk)
                            outgoing.write(chunk)
                        if count != entry['size'] or digest.hexdigest() != entry['sha256']:
                            raise PackageError('Payload changed while creating archive')
        # ZIPs may exceed the per-payload-file budget but not its total budget.
        digest = hashlib.sha256()
        with output.open('rb') as incoming:
            while chunk := incoming.read(1024 * 1024):
                digest.update(chunk)
        return digest.hexdigest()
    except OSError:
        raise PackageError('Cannot create a new package archive') from None
