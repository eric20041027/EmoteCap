"""One fresh-process source entry for production Studio and its local API."""
import argparse
import os
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

import uvicorn
from .studio_files import attach_studio,is_link

SOURCE_ROOT = Path(__file__).resolve().parents[2]


class StartupError(RuntimeError):
    """Recoverable local startup problem, before claiming service readiness."""


def default_data_dir() -> Path:
    if os.name == 'nt':
        base = Path(os.getenv('LOCALAPPDATA',str(Path.home()/'AppData/Local')))
    else:
        base = Path(os.getenv('XDG_DATA_HOME',str(Path.home()/'.local/share')))
    return base/'EmoteCap/data'


def validate_web_root(web_dir: Path,data_dir: Path,env_file: Path) -> Path:
    try:
        if is_link(web_dir) or is_link(web_dir/'index.html'):
            raise StartupError('Use an ordinary Web build folder with an ordinary index.html')
        public = web_dir.resolve()
        if not public.is_dir() or not (public/'index.html').is_file():
            raise StartupError('Web build is missing. Build web once with npm ci and npm run build; see docs/local-start.md')
        private = data_dir.resolve()
        config = env_file.resolve()
        if private.is_relative_to(public) or public.is_relative_to(private) or config.is_relative_to(public):
            raise StartupError('Choose private data and settings outside the Web build folder')
        return public
    except OSError:
        raise StartupError('Cannot read the Web build or selected local paths') from None


def open_listener(port: int) -> socket.socket:
    if isinstance(port,bool) or not isinstance(port,int) or not 1 <= port <= 65535:
        raise StartupError('Choose a port from 1 through 65535')
    listener = socket.socket(socket.AF_INET,socket.SOCK_STREAM)
    try:
        if os.name == 'nt' and hasattr(socket,'SO_EXCLUSIVEADDRUSE'):
            listener.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
        listener.bind(('127.0.0.1',port))
        return listener
    except OSError:
        listener.close()
        raise StartupError(f'Port {port} is unavailable. Stop the other instance or choose --port; changing the address uses separate browser storage') from None


def open_when_ready(server,url: str,stop: threading.Event,*,open_browser=True,
                    opener=webbrowser.open,wait_seconds=20) -> bool:
    deadline = time.monotonic()+wait_seconds
    while not stop.is_set():
        if server.started:
            print(f'EmoteCap ready at {url}',flush=True)
            if open_browser:
                try:
                    if not opener(url):print('Open the URL above in your browser.',flush=True)
                except Exception:
                    print('Could not open the browser. Open the URL above manually.',flush=True)
            return True
        if time.monotonic() >= deadline:
            print('Local service is still starting. Check the service messages before opening Studio.',flush=True)
            return False
        stop.wait(.05)
    return False


def _load_application(args: argparse.Namespace,web_root: Path):
    # Source/portable entries create a fresh interpreter; legacy direct imports remain unchanged.
    os.environ['PORT'] = str(args.port)
    os.environ['EMOTECAP_DATA_DIR'] = str(args.data_dir.resolve())
    os.environ['EMOTECAP_ENV_FILE'] = str(args.env_file.resolve())
    if args.blender:
        os.environ['BLENDER_PATH'] = args.blender
    from .main import app
    attach_studio(app,web_root)
    return app


def parse_port(value: str) -> int:
    try:
        port = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError('Port must be an integer') from None
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError('Port must be from 1 through 65535')
    return port


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Start local EmoteCap Studio and API')
    parser.add_argument('--web-dir',type=Path,default=SOURCE_ROOT/'web/dist')
    parser.add_argument('--data-dir',type=Path,default=default_data_dir())
    parser.add_argument('--env-file',type=Path,default=SOURCE_ROOT/'.env')
    parser.add_argument('--blender')
    parser.add_argument('--port',type=parse_port,default=8787)
    parser.add_argument('--no-browser',action='store_true')
    args = parser.parse_args(argv)
    try:
        web_root = validate_web_root(args.web_dir,args.data_dir,args.env_file)
        listener = open_listener(args.port)
        stop = threading.Event()
        try:
            application = _load_application(args,web_root)
            server = uvicorn.Server(uvicorn.Config(application,host='127.0.0.1',port=args.port,
                loop='asyncio',timeout_graceful_shutdown=5))
            ready = threading.Thread(target=open_when_ready,args=(server,f'http://127.0.0.1:{args.port}',stop),
                kwargs={'open_browser':not args.no_browser},name='emotecap-studio-ready',daemon=True)
            ready.start()
            try:
                server.run(sockets=[listener])
            finally:
                stop.set()
                ready.join(timeout=1)
            if not server.started:
                raise StartupError('Local service did not finish startup; check the service messages')
        finally:
            listener.close()
        return 0
    except (StartupError,OSError) as error:
        print(f'EmoteCap could not start: {error}',file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
