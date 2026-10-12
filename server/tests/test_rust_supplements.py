"""Commit-linked upstream texts are distinct from crate archive members."""
import copy
import hashlib

import pytest

from test_rust_notices import rust_inputs, save, validate, record
from test_windows_package import build_inputs, builder, files, git
import package_notices as notices


@pytest.fixture
def supplement_inputs(rust_inputs):
    repo, prepared, index, data = rust_inputs
    owner = index['components'][-1]
    old = 'licenses/rust-crates/owned-crate-1.0.0/LICENSE'
    (repo / 'third_party' / old).unlink()
    index['files'] = [r for r in index['files'] if r['path'] != old]
    owner['suppliedLicenses'].remove(old)
    crate = data['registryCrates'][0]
    crate.update(collectionStatus='source-manifest-only-no-supplied-license-text', suppliedLicensingFiles=[])
    data['summary'].update(suppliedLicensingTextsVerified=0, sourceManifestsWithoutSuppliedLicenseText=1)
    commit = '2' * 40
    relative = f'licenses/rust-upstream/owned-crate-1.0.0/{commit}/LICENSE'
    body = b'Owned unchanged upstream license\r\n'
    path = repo / 'third_party' / relative
    path.parent.mkdir(parents=True)
    path.write_bytes(body)
    entry = {**record(path, relative), 'upstreamPath': 'LICENSE',
             'url': f'https://raw.githubusercontent.com/owned/supplier/{commit}/LICENSE',
             'gitBlob': hashlib.sha1(b'blob ' + str(len(body)).encode() + b'\0' + body).hexdigest()}
    index['files'].append({**record(path, relative), 'origin': {'kind': 'owned-fixture', 'input': entry['url']}})
    index['files'].sort(key=lambda r: r['path'])
    owner['supplementaryLicenses'] = [relative]
    owner['rustLicenseSupplements'] = [{'name': crate['name'], 'version': crate['version'],
        'sourceArchiveSha256': crate['sourceArchiveSha256'], 'declaredLicense': crate['declaredLicense'],
        'repository': 'owned/supplier', 'sourceCommit': commit, 'pathInVcs': 'crates/owned',
        'vcsDirty': True, 'licensingFiles': [entry]}]
    save(repo, index, data)
    return repo, prepared, index, data


def test_supplement_is_delivered_without_forging_archive_members(supplement_inputs, tmp_path):
    repo, prepared, index, data = supplement_inputs
    result = validate(repo, prepared)
    assert result['summary']['rustManifestOnlyCrates'] == 1
    assert result['summary']['rustSupplementedCrates'] == 1
    assert result['summary']['rustSupplementaryLicensingTexts'] == 1
    assert result['summary']['rustUnresolvedManifestLicenseCrates'] == 0
    assert data['registryCrates'][0]['suppliedLicensingFiles'] == []
    staged = tmp_path / 'staged'
    files.copy_tree(prepared / 'payload', staged)
    notices.copy_notices(repo, staged, result, git(repo, 'rev-parse', 'HEAD'))
    entry = index['components'][-1]['rustLicenseSupplements'][0]['licensingFiles'][0]
    assert (staged / 'notices/third_party' / entry['path']).read_bytes() == (repo / 'third_party' / entry['path']).read_bytes()
    text = (staged / 'notices/RUST-SOURCE-ACCESS.txt').read_text(encoding='utf-8')
    assert entry['url'] in text and 'vcsDirty=true' in text
    assert 'not an archive member' in text and 'pending' in text


@pytest.mark.parametrize('change', ['name', 'version', 'archive', 'terms', 'repository', 'commit',
    'path', 'url', 'query', 'fragment', 'dirty', 'hash', 'blob', 'ownership', 'duplicate',
    'extra', 'missing', 'member', 'boolean-size', 'empty-text'])
def test_supplement_substitution_is_rejected(supplement_inputs, change):
    repo, prepared, index, data = supplement_inputs
    assert validate(repo, prepared)['summary']['rustSupplementedCrates'] == 1
    owner = index['components'][-1]
    supplement = owner['rustLicenseSupplements'][0]
    entry = supplement['licensingFiles'][0]
    if change == 'name': supplement['name'] = 'other'
    elif change == 'version': supplement['version'] = '2.0.0'
    elif change == 'archive': supplement['sourceArchiveSha256'] = '0' * 64
    elif change == 'terms': supplement['declaredLicense'] = 'MIT'
    elif change == 'repository': supplement['repository'] = 'owned/../supplier'
    elif change == 'commit': supplement['sourceCommit'] = 'main'
    elif change == 'path': supplement['pathInVcs'] = '../outside'
    elif change == 'url': entry['url'] = entry['url'].replace('raw.githubusercontent.com', 'example.com')
    elif change == 'query': entry['url'] += '?revision=other'
    elif change == 'fragment': entry['url'] += '#other'
    elif change == 'dirty': supplement['vcsDirty'] = 1
    elif change == 'hash': entry['sha256'] = '0' * 64
    elif change == 'blob': entry['gitBlob'] = '0' * 40
    elif change == 'ownership': owner['supplementaryLicenses'] = []
    elif change == 'duplicate': owner['rustLicenseSupplements'].append(copy.deepcopy(supplement))
    elif change == 'extra': supplement['approved'] = True
    elif change == 'missing': (repo / 'third_party' / entry['path']).unlink()
    elif change == 'member': entry['upstreamPath'] = '../LICENSE'
    elif change == 'empty-text':
        (repo / 'third_party' / entry['path']).write_bytes(b'')
        entry.update(size=0, sha256=hashlib.sha256(b'').hexdigest(), gitBlob=hashlib.sha1(b'blob 0\0').hexdigest())
        material = next(r for r in index['files'] if r['path'] == entry['path'])
        material.update(size=entry['size'], sha256=entry['sha256'])
    else: entry['size'] = True
    save(repo, index, data)
    with pytest.raises(files.PackageError): validate(repo, prepared)


def test_legacy_manifest_counts_stay_unresolved(supplement_inputs):
    repo, prepared, index, data = supplement_inputs
    owner = index['components'][-1]
    path = owner['supplementaryLicenses'][0]
    (repo / 'third_party' / path).unlink()
    index['files'] = [r for r in index['files'] if r['path'] != path]
    del owner['rustLicenseSupplements']
    del owner['supplementaryLicenses']
    save(repo, index, data)
    summary = validate(repo, prepared)['summary']
    assert summary['rustSupplementedCrates'] == summary['rustSupplementaryLicensingTexts'] == 0
    assert summary['rustUnresolvedManifestLicenseCrates'] == summary['rustManifestOnlyCrates'] == 1


def test_changed_supplement_after_admission_rejects_copy(supplement_inputs, tmp_path):
    repo, prepared, index, _ = supplement_inputs
    result = validate(repo, prepared)
    staged = tmp_path / 'staged'
    files.copy_tree(prepared / 'payload', staged)
    path = repo / 'third_party' / index['components'][-1]['supplementaryLicenses'][0]
    path.write_bytes(path.read_bytes() + b'Owned mutation')
    with pytest.raises(files.PackageError): notices.copy_notices(repo, staged, result, git(repo, 'rev-parse', 'HEAD'))


@pytest.mark.parametrize('interval', ['after-copy', 'before-zip', 'after-zip'])
def test_actual_builder_rejects_late_supplement_mutation(supplement_inputs, tmp_path, monkeypatch, interval):
    repo, prepared, index, _ = supplement_inputs
    # Current code must first admit a real upstream supplement.
    assert validate(repo, prepared)['summary']['rustSupplementedCrates'] == 1
    git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'Owned supplemental fixture')
    relative = 'notices/third_party/' + index['components'][-1]['supplementaryLicenses'][0]
    def corrupt(staged):
        path = staged / relative
        path.write_bytes(path.read_bytes() + b'Owned late mutation')
    if interval == 'after-copy':
        original = builder.copy_notices
        def copying(snapshot, staged, result, commit):
            summary = original(snapshot, staged, result, commit); corrupt(staged); return summary
        monkeypatch.setattr(builder, 'copy_notices', copying)
    else:
        original = builder.zip_payload
        def zipping(staged, archive, **kwargs):
            if interval == 'before-zip': corrupt(staged)
            digest = original(staged, archive, **kwargs)
            if interval == 'after-zip': corrupt(staged)
            return digest
        monkeypatch.setattr(builder, 'zip_payload', zipping)
    destination = tmp_path / 'candidate'
    archive = tmp_path / 'candidate.zip'
    with pytest.raises(files.PackageError): builder.build(repo, prepared, destination, archive)
    assert not destination.exists() and not archive.with_suffix('.zip.receipt.json').exists()
