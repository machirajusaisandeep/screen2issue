from __future__ import annotations

import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path

from fastapi import UploadFile


TMP_ROOT = Path(tempfile.gettempdir()) / "screen2issue-local-engine"
TMP_ROOT.mkdir(parents=True, exist_ok=True)


@contextmanager
def managed_temp_dir(prefix: str):
    temp_dir = Path(tempfile.mkdtemp(prefix=prefix, dir=TMP_ROOT))
    try:
        yield temp_dir
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


async def save_upload_file(upload: UploadFile, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with destination.open("wb") as output:
            while chunk := await upload.read(1024 * 1024):
                output.write(chunk)
    finally:
        await upload.close()
