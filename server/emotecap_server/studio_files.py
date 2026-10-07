"""Production Studio static files, separate from private server data/config."""
from pathlib import Path
import os
from fastapi import FastAPI
from starlette.exceptions import HTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.staticfiles import StaticFiles

STATIC_PREFIXES = {'assets','models','mediapipe','samples'}
MIME = {'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
        '.wasm':'application/wasm','.task':'application/octet-stream',
        '.emotecap':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg',
        '.jpeg':'image/jpeg','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2'}


def is_link(path: Path) -> bool:
    return path.is_symlink() or getattr(path,'is_junction',lambda:False)()


class StudioFiles(StaticFiles):
    async def get_response(self,path,scope):
        normalized = path.replace(os.sep,'/')
        index = normalized in ('','.','index.html')
        parts = normalized.split('/') if not index else ['index.html']
        if not index and (parts[0] not in STATIC_PREFIXES or Path(path).suffix.lower() not in MIME):
            raise HTTPException(404)
        if any(not part or part.startswith('.') or '\\' in part or ':' in part for part in parts):
            raise HTTPException(404)
        candidate = Path(self.directory)
        for part in parts:
            candidate /= part
            if is_link(candidate):
                raise HTTPException(404)
        response = await super().get_response(path,scope)
        if response.status_code < 400:
            if not index:
                response.headers['content-type'] = MIME[Path(path).suffix.lower()]
            else:
                response.headers['cache-control'] = 'no-store'
            response.headers['x-content-type-options'] = 'nosniff'
            response.headers['x-frame-options'] = 'DENY'
            response.headers['content-security-policy'] = "frame-ancestors 'none'"
            response.headers['referrer-policy'] = 'no-referrer'
        return response


def attach_studio(app: FastAPI,web_dir: Path) -> None:
    app.add_middleware(TrustedHostMiddleware,allowed_hosts=['127.0.0.1','localhost'],www_redirect=False)
    app.mount('/',StudioFiles(directory=web_dir,html=True,follow_symlink=False),name='studio')
