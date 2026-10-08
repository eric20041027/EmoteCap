"""Verify recipient source locations without executing shipped dependencies."""
import hashlib
from pathlib import Path
import re
import stat
import struct
import zipfile

from package_files import PackageError, ordinary_path, safe_name, sha256_file

SOURCE_NAMES={'__init__.py','__main__.py','core.py','cacert.pem'}
DIRECTORIES=('deps/certifi','python/Lib/site-packages/pip/_vendor/certifi')
WHEEL_PREFIX='python/Lib/ensurepip/_bundled/'
MEMBER_PREFIX='pip/_vendor/certifi'
CRYPTO_NATIVE='deps/cryptography/hazmat/bindings/_rust.pyd'
MAX_FORMS=32
MAX_SOURCE_FILE=2*1024*1024
MAX_SOURCE_TOTAL=8*1024*1024
MAX_WHEEL_BYTES=32*1024*1024
MAX_WHEEL_ENTRIES=4096
MAX_WHEEL_EXPANDED=64*1024*1024

def _fields(value,names):
    if not isinstance(value,dict) or set(value)!=set(names):
        raise PackageError('Invalid source-access metadata fields')

def _record(value):
    _fields(value,('path','size','sha256'))
    safe_name(value['path'])
    if Path(value['path']).suffix not in ('.py','.pem'):
        raise PackageError('Unexpected preferred source file type')
    if type(value['size']) is not int or not 0<=value['size']<=MAX_SOURCE_FILE or not isinstance(value['sha256'],str) or not re.fullmatch('[0-9a-f]{64}',value['sha256']):
        raise PackageError('Invalid source file size or digest')

def _read(path,limit):
    path=ordinary_path(path)
    if not path.is_file() or path.stat().st_nlink!=1 or path.stat().st_size>limit:
        raise PackageError('Source input is not a bounded ordinary file')
    with path.open('rb') as incoming:data=incoming.read(limit+1)
    if len(data)>limit:raise PackageError('Source input exceeds its budget')
    return data

def _source(data):
    data.decode('utf-8')
    if b'\0' in data:raise PackageError('Source form contains binary data')
    return {'size':len(data),'sha256':hashlib.sha256(data).hexdigest()}

def _version(data):
    values=re.findall(r'^__version__\s*=\s*[\'"]([0-9]{4}\.[0-9]{2}\.[0-9]{2})[\'"]\s*$',data.decode('utf-8'),re.M)
    if len(values)!=1:raise PackageError('Source version is missing or ambiguous')
    return values[0]

def _wheel(path,source_budget):
    # Bound the central-directory count before ZipFile allocates its entries.
    path=ordinary_path(path)
    if not path.is_file() or path.stat().st_nlink!=1 or path.stat().st_size>MAX_WHEEL_BYTES:
        raise PackageError('Embedded source wheel exceeds its file budget')
    with path.open('rb') as incoming:
        incoming.seek(max(0,path.stat().st_size-65557));tail=incoming.read(65557)
    position=tail.rfind(b'PK\x05\x06')
    if position<0 or position+22>len(tail):raise PackageError('Embedded source wheel has no ordinary directory')
    disk,start_disk,on_disk,count,size,offset,comment=struct.unpack_from('<4H2IH',tail,position+4)
    if disk or start_disk or on_disk!=count or count>MAX_WHEEL_ENTRIES or size>MAX_WHEEL_BYTES or offset+size>path.stat().st_size or position+22+comment!=len(tail):
        raise PackageError('Embedded source wheel directory exceeds its bounds')
    with zipfile.ZipFile(path) as archive:
        entries=archive.infolist()
        if len(entries)!=count or sum(item.file_size for item in entries)>MAX_WHEEL_EXPANDED:
            raise PackageError('Embedded source wheel contents exceed their budget')
        names=set();identities={};selected={}
        for item in entries:
            name=safe_name(item.filename.rstrip('/'))
            for length in range(1,len(name.split('/'))+1):
                prefix='/'.join(name.split('/')[:length]);key=prefix.casefold()
                if key in identities and identities[key]!=prefix:raise PackageError('Embedded source wheel has a case collision')
                identities[key]=prefix
            if name in names or item.flag_bits&1 or stat.S_IFMT(item.external_attr>>16) not in (0,stat.S_IFREG,stat.S_IFDIR):
                raise PackageError('Embedded source wheel has duplicate, encrypted or linked entries')
            names.add(name)
            if not item.is_dir() and name.startswith(MEMBER_PREFIX+'/') and Path(name).suffix in ('.py','.pem'):
                relative=name[len(MEMBER_PREFIX)+1:]
                if len(selected)>=16 or item.file_size>MAX_SOURCE_FILE or item.compress_type not in (zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED):
                    raise PackageError('Unexpected or oversized embedded certifi source')
                if item.file_size>source_budget:raise PackageError('Source forms exceed total budget')
                with archive.open(item) as incoming:data=incoming.read(MAX_SOURCE_FILE+1)
                if len(data)!=item.file_size:raise PackageError('Embedded source length differs from its directory')
                source_budget-=len(data)
                selected[relative]=data
        return selected

def validate_source_notices(components,receipt,payload,material,license_records):
    try:
        payload=ordinary_path(payload);material=ordinary_path(material)
        inventory={entry['path']:entry for entry in receipt['files']}
        declared={};bindings=[]
        for component in components:
            forms=component.get('sourceForms',[])
            if not isinstance(forms,list) or len(forms)>MAX_FORMS:raise PackageError('Too many source forms')
            owned=set(component['suppliedLicenses']+component.get('supplementaryLicenses',[]))
            for form in forms:
                _fields(form,('name','version','licenseId','license','location','files'))
                if form['name']!='certifi' or form['licenseId']!='MPL-2.0' or not isinstance(form['version'],str) or not re.fullmatch(r'[0-9]{4}\.[0-9]{2}\.[0-9]{2}',form['version']):
                    raise PackageError('Unsupported source component, license or version')
                if not isinstance(form['license'],str) or form['license'] not in owned or form['license'] not in license_records:
                    raise PackageError('Source form refers to an absent or foreign license')
                location=form['location']
                if not isinstance(location,dict):raise PackageError('Invalid source location')
                kind=location.get('kind')
                _fields(location,('kind','path') if kind=='directory' else ('kind','path','prefix'))
                path=safe_name(location['path'])
                if kind=='directory':
                    if path not in DIRECTORIES:raise PackageError('Unknown certifi source directory')
                    identity=(kind,path)
                elif kind=='wheel':
                    if not path.startswith(WHEEL_PREFIX) or '/' in path[len(WHEEL_PREFIX):] or not path.endswith('.whl') or location['prefix']!=MEMBER_PREFIX:
                        raise PackageError('Unknown certifi source wheel location')
                    identity=(kind,path)
                else:raise PackageError('Unsupported source location kind')
                records=form['files']
                if not isinstance(records,list) or not 1<=len(records)<=16:raise PackageError('Invalid source file count')
                for record in records:_record(record)
                names=[item['path'] for item in records]
                if not SOURCE_NAMES<=set(names) or len(names)!=len({name.casefold() for name in names}):
                    raise PackageError('Certifi source file set is incomplete or duplicated')
                if identity in declared or len(declared)>=MAX_FORMS:raise PackageError('Duplicate or excessive source forms')
                declared[identity]=form
            embedded=component.get('embeddedIn',[])
            if not isinstance(embedded,list) or len(bindings)+len(embedded)>64:raise PackageError('Invalid embedded native record count')
            for entry in embedded:
                _fields(entry,('path','size','sha256'));name=safe_name(entry['path'])
                if entry not in receipt['files'] or Path(name).suffix.lower() not in ('.dll','.pyd') or not name.startswith(('deps/','python/')):
                    raise PackageError('Embedded native evidence differs from the prepared payload')
                target=ordinary_path(payload/name)
                if target.stat().st_size!=entry['size'] or sha256_file(target)!=entry['sha256']:
                    raise PackageError('Embedded native input changed')
                if not owned:raise PackageError('Embedded native evidence has no licensing text')
                if any(item['path']==name for item in bindings):raise PackageError('Duplicate embedded native evidence')
                bindings.append(entry)
        if CRYPTO_NATIVE in inventory:
            crypto=[item for item in components if item.get('kind')=='python-production' and item.get('name')=='cryptography']
            supplements=[item for item in components if item.get('kind')=='native-static' and item.get('name')=='OpenSSL' and item.get('version')=='4.0.2' and inventory[CRYPTO_NATIVE] in item.get('embeddedIn',[])]
            if len(crypto)!=1 or crypto[0].get('version')!='50.0.1' or len(supplements)!=1:
                raise PackageError('Frozen cryptography native supplement is missing or needs reassessment')
        observed={};total=0
        for directory in DIRECTORIES:
            selected={}
            for name,entry in inventory.items():
                if name.startswith(directory+'/') and Path(name).suffix in ('.py','.pem'):
                    relative=name[len(directory)+1:]
                    safe_name(relative)
                    if len(selected)>=16:raise PackageError('Too many certifi source files')
                    if total+entry['size']>MAX_SOURCE_TOTAL:raise PackageError('Source forms exceed total budget')
                    data=_read(payload/name,MAX_SOURCE_FILE)
                    if _source(data)!={'size':entry['size'],'sha256':entry['sha256']}:raise PackageError('Prepared certifi source changed')
                    total+=len(data)
                    selected[relative]=data
            if selected:observed[('directory',directory)]=selected
        wheels=[name for name in inventory if name.startswith(WHEEL_PREFIX) and name.endswith('.whl')]
        if len(wheels)>8:raise PackageError('Too many embedded source wheels')
        for name in wheels:
            safe_name(name);entry=inventory[name];target=ordinary_path(payload/name)
            if entry['size']>MAX_WHEEL_BYTES or target.stat().st_size!=entry['size'] or sha256_file(target)!=entry['sha256']:
                raise PackageError('Prepared source wheel changed or oversized')
            selected=_wheel(target,MAX_SOURCE_TOTAL-total)
            total+=sum(len(data) for data in selected.values())
            if selected:observed[('wheel',name)]=selected
        if set(observed)!=set(declared):raise PackageError('Declared source locations differ from shipped copies')
        normalized=[]
        for identity,selected in sorted(observed.items()):
            if not SOURCE_NAMES<=set(selected):raise PackageError('Actual certifi source is incomplete')
            form=declared[identity]
            records=sorted(({'path':name,**_source(data)} for name,data in selected.items()),key=lambda item:item['path'])
            if sorted(form['files'],key=lambda item:item['path'])!=records or form['version']!=_version(selected['__init__.py']):
                raise PackageError('Source bytes or version differ from the declared source form')
            normalized.append(form)
        lines=['EmoteCap bundled source access','',
               'Certifi source forms below are governed by MPL-2.0, including supplied vendoring changes.',
               'They retain their own terms; the project license does not replace them.',
               'MPL-2.0 text: https://www.mozilla.org/en-US/MPL/2.0/','']
        for form in normalized:
            location=form['location'];lines.append(f'certifi {form["version"]}: {location["path"]}')
            if location['kind']=='wheel':lines.append(f'Open that .whl as a ZIP archive; source entries are under {location["prefix"]}/.')
            lines.extend([f'Source files: {", ".join(item["path"] for item in sorted(form["files"],key=lambda item:item["path"]))}',
                          f'Supplied licensing text: third_party/{form["license"]}',''])
        if not normalized:lines.extend(['No certifi source copies are recorded in this payload.',''])
        lines.extend(['Other native/vendor/model/SDK and owner rights remain under assessment.',
                      'This source-access notice is not an approved public release.',''])
        return {'forms':normalized,'embeddedNative':bindings,'text':'\n'.join(lines),
                'summary':{'sourceForms':len(normalized),'sourceFiles':sum(len(form['files']) for form in normalized),'embeddedNativeRecords':len(bindings)}}
    except (OSError,ValueError,KeyError,TypeError,RuntimeError,zipfile.BadZipFile,NotImplementedError):
        raise PackageError('Source access or embedded native evidence is incomplete or invalid') from None
