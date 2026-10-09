#!/usr/bin/env sh
set -eu
source_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec uv run --directory "$source_root/server" --frozen --python 3.12.14 python -m emotecap_server.launcher "$@"
