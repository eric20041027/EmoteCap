"""Bind supplied licensing evidence to a pending internal candidate."""
import json
import os
from pathlib import Path
import re

from package_files import (PackageError, copy_tree, file_inventory, ordinary_path,
                           safe_name, sha256_file, verify_inventory)
from source_notices import validate_source_notices
from rust_notices import validate_rust_notices

LOCK_PATHS = {'server/pyproject.toml','server/uv.lock','web/package-lock.json',
              'web/scripts/mediapipe-assets.json','packaging/python-runtime.json'}
MAX_TEXTS = 512
MAX_TEXT_BYTES = 2*1024*1024
MAX_TOTAL_BYTES = 16*1024*1024
SDK_WASM_PREFIX = 'web/node_modules/@mediapipe/tasks-vision/wasm/'
ASSESSMENT = 'draft-supplied-evidence-not-redistribution-approval'
STATUSES = {'supplied-material-assessment-pending','native-and-vendor-coverage-pending',
            'model-card-observed-task-archive-coverage-pending'}

def _object(pairs):
    result={}
    for key,value in pairs:
        if key in result:raise PackageError('Duplicate licensing metadata key')
        result[key]=value
    return result

def _json(path:Path):
    path=ordinary_path(path)
    if not path.is_file() or path.stat().st_size>MAX_TEXT_BYTES or path.stat().st_nlink!=1:
        raise PackageError('Licensing metadata is missing or oversized')
    try:return json.loads(path.read_bytes(),object_pairs_hook=_object)
    except (OSError,ValueError,RecursionError):
        raise PackageError('Licensing metadata is unreadable or invalid') from None

def _text_tree(root:Path)->list[dict]:
    ordinary_path(root)
    if not root.is_dir():raise PackageError('Licensing text folder is missing')
    count=total=0
    def failed(error):raise PackageError('Cannot enumerate licensing text') from None
    for directory,dirs,names in os.walk(root,followlinks=False,onerror=failed):
        for name in dirs+names:
            path=ordinary_path(Path(directory)/name)
            if name.startswith('.'):raise PackageError('Private licensing paths are unsupported')
            if path.is_file():
                count+=1;total+=path.stat().st_size
                if count>MAX_TEXTS or path.stat().st_size>MAX_TEXT_BYTES or total>MAX_TOTAL_BYTES:
                    raise PackageError('Licensing material exceeds its bounds')
                try:data=path.read_bytes();data.decode('utf-8')
                except (OSError,UnicodeError):raise PackageError('Licensing material is not readable text') from None
                if b'\0' in data:raise PackageError('Binary licensing material is unsupported')
    return file_inventory(root)

def validate_notices(snapshot:Path,prepared:Path,public_files:list[dict])->dict:
    try:
        snapshot=ordinary_path(snapshot);prepared=ordinary_path(prepared)
        material=snapshot/'third_party';path=material/'inventory.json';index=_json(path)
        if not isinstance(index,dict) or index.get('schema')!='emotecap-third-party-material-v1' or index.get('assessment')!=ASSESSMENT:
            raise PackageError('Unsupported or falsely approved licensing inventory')
        allowed={'schema','assessment','context','components','files','nativeBinaryFiles','pending','externalPrerequisites'}
        if set(index)-allowed:raise PackageError('Unsupported licensing metadata field')
        if re.search(r'(?<![A-Za-z])[A-Za-z]:[\\/]|/Users/|/home/',json.dumps(index,ensure_ascii=True)):
            raise PackageError('Machine-specific licensing metadata is unsupported')
        context=index['context']
        if set(context)!={'sourceLockSha256','preparedReceiptSha256','runtimeSource'} or set(context['sourceLockSha256'])!=LOCK_PATHS:
            raise PackageError('Licensing source context is incomplete')
        for name,digest in context['sourceLockSha256'].items():
            if sha256_file(snapshot/name)!=digest:raise PackageError('Licensing source pins are stale')
        if context['preparedReceiptSha256']!=sha256_file(prepared/'prepared.json'):
            raise PackageError('Licensing prepared receipt differs')
        receipt=_json(prepared/'prepared.json')
        if context['runtimeSource']!=receipt['runtime']:raise PackageError('Licensing runtime pins differ')
        native=sorted((entry for entry in receipt['files'] if entry['path'].startswith(('python/','deps/'))
            and Path(entry['path']).suffix.lower() in ('.dll','.pyd')),key=lambda entry:entry['path'])
        if index['nativeBinaryFiles']!=native:raise PackageError('Licensing native inventory differs from payload')
        records=index['files'];expected=[];names=set()
        if not isinstance(records,list) or not 1<=len(records)<=MAX_TEXTS:
            raise PackageError('Invalid licensing text count')
        for record in records:
            if not isinstance(record,dict) or set(record)!={'path','size','sha256','origin'}:
                raise PackageError('Invalid licensing text record')
            name=safe_name(record['path'])
            if not name.startswith('licenses/') or name.casefold() in names or any(part.startswith('.') for part in name.split('/')):
                raise PackageError('Unsafe or duplicate licensing text path')
            names.add(name.casefold())
            if type(record['size']) is not int or not 0<=record['size']<=MAX_TEXT_BYTES or not isinstance(record['sha256'],str) or not re.fullmatch('[0-9a-f]{64}',record['sha256']):
                raise PackageError('Invalid licensing text size or digest')
            if not isinstance(record['origin'],dict) or set(record['origin'])!={'input','kind'} or any(not isinstance(v,str) or len(v)>2048 for v in record['origin'].values()):
                raise PackageError('Invalid licensing origin record')
            expected.append({'path':name[len('licenses/'):],'size':record['size'],'sha256':record['sha256']})
        if sum(entry['size'] for entry in expected)>MAX_TOTAL_BYTES:raise PackageError('Licensing material exceeds total budget')
        actual=_text_tree(material/'licenses')
        if actual!=sorted(expected,key=lambda entry:entry['path']):raise PackageError('Licensing texts are missing, changed or extra')
        components=index['components'];references=[];wasm_names=set();public={entry['path']:entry for entry in public_files}
        if not isinstance(components,list) or not 1<=len(components)<=MAX_TEXTS:
            raise PackageError('Invalid licensing component count')
        for component in components:
            if not isinstance(component,dict) or component.get('status') not in STATUSES:
                raise PackageError('Unsupported licensing component assessment')
            supplied=component['suppliedLicenses'];supplementary=component.get('supplementaryLicenses',[])
            if not isinstance(supplied,list) or not isinstance(supplementary,list):raise PackageError('Invalid licensing references')
            references.extend(supplied+supplementary)
            prebuilt=component.get('prebuiltSdkFiles',[])
            if not isinstance(prebuilt,list) or len(prebuilt)>64:raise PackageError('Invalid SDK inventory')
            for entry in prebuilt:
                if not isinstance(entry,dict) or set(entry)!={'path','size','sha256'}:raise PackageError('Invalid SDK file record')
                name=safe_name(entry['path'])
                if name.startswith(SDK_WASM_PREFIX):
                    suffix=name[len(SDK_WASM_PREFIX):]
                    if '/' in suffix:raise PackageError('Unexpected SDK WASM path')
                    target=public.get('mediapipe/wasm/'+suffix)
                    if suffix in wasm_names:raise PackageError('Duplicate SDK WASM licensing record')
                    wasm_names.add(suffix)
                    if target is None or target['size']!=entry['size'] or target['sha256']!=entry['sha256']:
                        raise PackageError('Built SDK WASM differs from licensing evidence')
        shipped_wasm={name[len('mediapipe/wasm/'):] for name in public if name.startswith('mediapipe/wasm/')}
        if shipped_wasm!=wasm_names:raise PackageError('Built SDK WASM contains unrecorded or missing files')
        if any(not isinstance(name,str) for name in references) or len(references)!=len(set(references)) or set(references)!={record['path'] for record in records}:
            raise PackageError('Licensing text ownership is incomplete or duplicated')
        if not isinstance(index['pending'],list) or not index['pending'] or any(not isinstance(v,str) for v in index['pending']):
            raise PackageError('Licensing assessment gaps must remain explicit')
        summary={'assessment':'pending','sourceIndexSha256':sha256_file(path),'textFiles':len(expected),
                 'textBytes':sum(entry['size'] for entry in expected),'nativeFileRecords':len(native)}
        source=validate_source_notices(components,receipt,prepared/'payload',material,{record['path']:record for record in records})
        summary.update(source['summary'])
        rust=validate_rust_notices(components,receipt,prepared/'payload',material,{record['path']:record for record in records},snapshot/'server/uv.lock',context['preparedReceiptSha256'])
        summary.update(rust['summary'])
        return {'index':index,'textFiles':expected,'summary':summary,
                'sourceContext':{'prepared':prepared,'receipt':receipt,'receiptSha256':context['preparedReceiptSha256'],'sourceLock':snapshot/'server/uv.lock'}}
    except (OSError,ValueError,KeyError,TypeError,RecursionError):
        raise PackageError('Licensing material is incomplete or invalid') from None

def copy_notices(snapshot:Path,staged:Path,validated:dict,source_commit:str)->dict:
    if not re.fullmatch('[0-9a-f]{40}',source_commit):raise PackageError('Notice source commit is invalid')
    source=ordinary_path(snapshot/'third_party');destination=ordinary_path(staged/'notices/third_party')
    if destination.exists():raise PackageError('Notice destination must be fresh')
    context=validated['sourceContext'];prepared=context['prepared']
    if sha256_file(prepared/'prepared.json')!=context['receiptSha256']:
        raise PackageError('Source-access prepared receipt changed before copying')
    index=validated['index'];records={record['path']:record for record in index['files']}
    validate_source_notices(index['components'],context['receipt'],prepared/'payload',source,records)
    access=validate_source_notices(index['components'],context['receipt'],staged,source,records)
    if access['summary']!={key:validated['summary'][key] for key in access['summary']}:
        raise PackageError('Copied source-access summary differs')
    validate_rust_notices(index['components'],context['receipt'],prepared/'payload',source,records,context['sourceLock'],context['receiptSha256'])
    rust=validate_rust_notices(index['components'],context['receipt'],staged,source,records,context['sourceLock'],context['receiptSha256'])
    if rust['summary']!={key:validated['summary'][key] for key in rust['summary']}:
        raise PackageError('Copied Rust source summary differs')
    copy_tree(source/'licenses',destination/'licenses')
    verify_inventory(destination/'licenses',validated['textFiles'])
    if sha256_file(source/'inventory.json')!=validated['summary']['sourceIndexSha256']:
        raise PackageError('Licensing index changed before copying')
    with (source/'inventory.json').open('rb') as incoming,(destination/'inventory.json').open('xb') as output:
        output.write(incoming.read())
    if sha256_file(destination/'inventory.json')!=validated['summary']['sourceIndexSha256']:
        raise PackageError('Copied licensing index differs')
    if rust['dataFile'] is not None:
        record=rust['dataFile'];incoming_path=ordinary_path(source/record['path'])
        if incoming_path.stat().st_size!=record['size'] or sha256_file(incoming_path)!=record['sha256']:
            raise PackageError('Rust metadata changed before copying')
        with incoming_path.open('rb') as incoming,(destination/record['path']).open('xb') as output:
            data=incoming.read(MAX_TEXT_BYTES+1)
            if len(data)!=record['size']:raise PackageError('Rust metadata changed during copying')
            output.write(data)
        if sha256_file(destination/record['path'])!=record['sha256']:raise PackageError('Copied Rust metadata differs')
        validate_rust_notices(index['components'],context['receipt'],staged,destination,records,context['sourceLock'],context['receiptSha256'])
    text=('EmoteCap internal candidate licensing material\n\n'
          f'Source commit: {source_commit}\n'
          f'Inventory SHA256: {validated["summary"]["sourceIndexSha256"]}\n'
          f'Exact licensing texts: {validated["summary"]["textFiles"]}\n\n'
          'Read third_party/inventory.json and the original texts under third_party/licenses/.\n'
          'Read SOURCE-ACCESS.txt for included MPL source locations and their terms.\n'
          'Read RUST-SOURCE-ACCESS.txt when present for supplied Rust source licensing evidence.\n'
          'The index describes frozen source inputs; these paths are not app import paths.\n'
          'Material is supplied evidence, not redistribution approval or a public release.\n'
          'Owner/contributor/media, native/vendor/model/source-form and actual product gates\n'
          'remain pending. No project LICENSE is adopted by this candidate.\n')
    with (staged/'notices/README.txt').open('x',encoding='utf-8',newline='\n') as output:output.write(text)
    with (staged/'notices/SOURCE-ACCESS.txt').open('x',encoding='utf-8',newline='\n') as output:output.write(access['text'])
    if rust['dataFile'] is not None:
        with (staged/'notices/RUST-SOURCE-ACCESS.txt').open('x',encoding='utf-8',newline='\n') as output:output.write(rust['text'])
    return dict(validated['summary'])
