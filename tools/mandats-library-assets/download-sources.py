"""Fetch the frozen CC0 source files for the Blender studies, outside the checkout."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import tempfile
import urllib.parse
import urllib.request


def verify(path, expected):
    if path.stat().st_size != expected["bytes"]:
        raise ValueError(f"Source size differs: {path.name}")
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != expected["sha256"]:
        raise ValueError(f"Source SHA256 differs: {path.name}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--all", action="store_true", help="Include the four vegetation studies.")
    args = parser.parse_args()
    manifest = json.loads(Path(__file__).with_name("sources.json").read_text())
    cache = args.cache.resolve()
    checkout = Path(__file__).resolve().parents[2]
    if cache == checkout or checkout in cache.parents:
        raise ValueError("Keep the source cache outside the checkout.")
    selected = {"boulder_01", "quaternius-medieval-village-2025"}
    rows = [item for item in manifest["files"] if args.all or item["asset"] in selected]
    downloaded = 0
    for item in rows:
        relative = PurePosixPath(item["relativePath"])
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("Invalid source path.")
        target = cache / relative
        if cache not in target.resolve().parents:
            raise ValueError("Source path leaves the cache.")
        url = urllib.parse.urlsplit(item["url"])
        if url.scheme != "https" or url.hostname not in {"dl.polyhaven.org", "raw.githubusercontent.com"}:
            raise ValueError("Unexpected source origin.")
        if target.exists():
            verify(target, item)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(item["url"], headers={"User-Agent": manifest["polyhavenUserAgent"]})
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as output:
                temporary = Path(output.name)
                with urllib.request.urlopen(request, timeout=30) as response:
                    for chunk in iter(lambda: response.read(1024 * 1024), b""):
                        output.write(chunk)
            verify(temporary, item)
            if "gitBlobSHA" in item:
                content = temporary.read_bytes()
                git_blob = hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()
                if git_blob != item["gitBlobSHA"]:
                    raise ValueError("Source Git blob differs.")
            temporary.replace(target)
            downloaded += 1
        finally:
            if temporary and temporary.exists():
                temporary.unlink()
    print(json.dumps({"verifiedFiles": len(rows), "downloadedFiles": downloaded,
                      "verifiedBytes": sum(item["bytes"] for item in rows), "cache": str(cache)}))


if __name__ == "__main__":
    main()
