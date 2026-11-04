"""Retain the current and previous published ZZWS APK via Storage API only."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.request

BASE = "https://xufxevjdfukglplsknrp.supabase.co"
BUCKET = "zzws-android-releases"
PACKAGE = "am.zzws.admin"

class Storage:
    def __init__(self, key):
        if not key:
            raise ValueError("Authenticated deployment credential is required")
        self.key = key

    def request(self, method, path, body=None):
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(BASE + path, data=data, method=method, headers={
            "apikey": self.key, "Authorization": "Bearer " + self.key,
            "Content-Type": "application/json", "Cache-Control": "no-cache"})
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            raise RuntimeError("Storage HTTP " + str(error.code) + ": " + method + " " + path) from None
        except urllib.error.URLError:
            raise RuntimeError("Storage connection failed") from None

    def list_names(self):
        names, offset = [], 0
        while True:
            batch = json.loads(self.request("POST", "/storage/v1/object/list/" + BUCKET, {
                "prefix": "releases", "limit": 100, "offset": offset,
                "sortBy": {"column": "name", "order": "desc"}}))
            if not isinstance(batch, list):
                raise ValueError("Invalid release listing")
            for item in batch:
                name = item.get("name", "")
                if not re.fullmatch(r"\d{10}\.json", name):
                    raise ValueError("Unexpected release entry; cleanup stopped")
                names.append(name)
            if len(batch) < 100:
                break
            offset += len(batch)
        if len(set(names)) != len(names):
            raise ValueError("Release listing changed during pagination")
        return sorted(names, reverse=True)

    def read(self, path):
        return self.request("GET", "/storage/v1/object/authenticated/" + BUCKET + "/" + path)

    def remove(self, paths):
        if not paths:
            return
        for path in paths:
            if not re.fullmatch(r"(?:files/[a-f0-9]{64}\.apk|releases/\d{10}\.json)", path):
                raise ValueError("Cleanup path is outside published APK objects")
        for offset in range(0, len(paths), 100):
            self.request("DELETE", "/storage/v1/object/" + BUCKET,
                         {"prefixes": paths[offset:offset + 100]})


def manifest(store, name):
    item = json.loads(store.read("releases/" + name))
    code, digest = item.get("versionCode"), item.get("sha256", "")
    version, size = item.get("version", ""), item.get("bytes")
    if not (item.get("schemaVersion") == 1 and item.get("package") == PACKAGE
            and type(code) is int and 0 < code <= 2147483647
            and f"{code:010d}.json" == name
            and re.fullmatch(r"[a-f0-9]{64}", digest)
            and re.fullmatch(r"[0-9][A-Za-z0-9.+_-]{0,79}", version)
            and item.get("filename") == "ZZWS-" + version + "-production.apk"
            and item.get("objectPath") == "files/" + digest + ".apk"
            and type(size) is int and 21 < size <= 50_000_000):
        raise ValueError("Invalid published manifest; cleanup stopped")
    return item


def retain(store, apply=False):
    names = store.list_names()
    releases = [manifest(store, name) for name in names]
    keep, old = releases[:2], releases[2:]
    keep_paths = {item["objectPath"] for item in keep}
    # Verify both keepers in full before the first deletion.
    for item in keep:
        data = store.read(item["objectPath"])
        if len(data) != item["bytes"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
            raise ValueError("Current/previous APK integrity check failed; nothing deleted")
    paths = sorted({item["objectPath"] for item in old} - keep_paths)
    manifests = ["releases/" + name for name in names[2:]]
    result = {"applied": False, "bucket": BUCKET, "policy": "current_and_previous",
              "beforeVersions": [item["version"] for item in releases],
              "retainedVersions": [item["version"] for item in keep],
              "verifiedKeepers": len(keep), "oldApks": len(paths),
              "removePaths": paths + manifests,
              "retainedBytes": sum(item["bytes"] for item in keep)}
    if not apply:
        return result
    if store.list_names() != names:
        raise RuntimeError("Publication changed during verification; rerun cleanup")
    # Removing files first leaves retryable old manifests after a failed delete.
    store.remove(paths)
    store.remove(manifests)
    remaining = store.list_names()
    if remaining != names[:2]:
        raise RuntimeError("Publication changed or cleanup is incomplete; verify current releases")
    for name, expected in zip(remaining, keep):
        if manifest(store, name) != expected:
            raise RuntimeError("Retained release changed during cleanup")
        data = store.read(expected["objectPath"])
        if len(data) != expected["bytes"] or hashlib.sha256(data).hexdigest() != expected["sha256"]:
            raise RuntimeError("Retained APK failed readback after cleanup")
    result["applied"] = True
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--report")
    args = parser.parse_args()
    report = retain(Storage(os.environ.get("ZZWS_RELEASE_SERVICE_KEY")), args.apply)
    if args.report:
        output = Path(args.report)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(type(error).__name__ + ": " + str(error))
        raise SystemExit(1)
