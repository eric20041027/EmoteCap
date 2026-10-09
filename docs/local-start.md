# Start local Studio from source

This source entry runs the built Studio and its local service at **http://127.0.0.1:8787**. It uses your system browser. Camera, model inference, Live Link and Gemini sending start only through their explicit Studio controls.

## Initial developer setup

Install Node24.19.0, npm11.21.0and uv0.12.6. Use the committed locks; the source entry installs its managed Python3.12.14/server dependencies as needed. Build Web once:

```text
cd web
npm ci
npm run build
```

The build downloads the three pinned model assets when absent and verifies their SHA256. Normal system certificates/proxy settings are supported; keep TLS verification enabled. An already built/verified source checkout can launch without downloading models again. Source developer prerequisites are distinct from the planned Windows user distribution, which will contain its own built Web/runtime.

## One entry

From the repository in a Windows terminal:

```text
.\start.cmd
```

On Linux/macOS development machines:

```text
./start.sh
```

The entry reserves127.0.0.1:8787before importing the stateful service, then opens the browser after startup. Keep the terminal running; Ctrl+Cstops the service through its normal owned shutdown. If opening the browser fails, open the printed URL yourself. A missing build or occupied port reports an error and does not start another instance or stop another application.

Blender is optional for capture/sample/save/backup, and required for FBX export. Configure `BLENDER_PATH`in the private repo-root `.env` or choose it at launch:

```text
.\start.cmd --blender "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
```

Actual export qualification currently covers Blender4.5.14LTS; other versions need verification. Unity paired receiver/editor qualification remains pending; the historical receiver is not a working consumer of the new paired service. See the [release progress](release-progress.md) rather than assuming a completed Unity/user distribution from this source entry.

## Private data and settings

Windows server jobs/downloads/media inventory use `%LOCALAPPDATA%\EmoteCap\data`; non-Windows source uses `$XDG_DATA_HOME/EmoteCap/data`or`~/.local/share/EmoteCap/data`. Source settings default to repo-root `.env`, which is not served or copied into the Web build. Gemini remains optional and sending requires the explicit selected-source consent flow. Do not put data/settings inside the public Web folder.

Available local flags: `--data-dir`, `--env-file`, `--web-dir`, `--blender`, `--port`and`--no-browser`. Prefer absolute paths; wrapper-relative paths are interpreted in `server/`, where uv starts the process. `--port`defaults to8787and takes precedence over dotenv PORTfor this entry. There is no API-key command-line option.

An absent settings file is optional. If the selected path exists, it must be a readable regular file; a directory or unreadable file stops startup before creating server data or claiming readiness.

The direct development server remains supported with its previous defaults. Only the opt-in `EMOTECAP_DATA_DIR`and`EMOTECAP_ENV_FILE`settings select different server data/env locations; the source launcher sets these before a fresh-process main import.

Projects/takes are saved in the browser for the exact origin. Before switching from a development address such as localhost:5173, changing port/address/browser, or moving to another machine, download an `.emotecap`project backup and import it at the new address. Server jobs in the old repo `server/data`are separate; choose that existing data directory explicitly if you need its inventory, without moving it into a public folder.

On Windows, exclusive listener ownership can keep a port unavailable while previous connections finish closing. Close the old tab/instance and retry the same address; the launcher does not silently choose a different project-storage origin. [Microsoft socket ownership guidance](https://learn.microsoft.com/en-us/windows/win32/winsock/using-so-reuseaddr-and-so-exclusiveaddruse).

## Qualification limits

The source entry has unit/real-process and actual production Edge sample/reload/backup/import/pairing/export checks. Physical camera/quota, Unity/two rigs, target laptop, clean-machine packaging, third-party notices and the5new-user study remain independent release gates. This entry does not publish a version or approve licensing.
