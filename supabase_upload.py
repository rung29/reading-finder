import json
import os
import sys
import urllib.parse
from pathlib import Path

import requests

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

DATA_FILES = (
    "books.json",
)
DEFAULT_BUCKET = "book-data"
REQUEST_TIMEOUT = 30


def load_env_file(path):
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip().strip('"').strip("'")
        if name and value:
            os.environ.setdefault(name, value)


def _required_env(name):
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"缺少必要環境變數 {name}，請在 .env.local 中設定")
    return value


def _storage_headers(secret_key):
    headers = {
        "apikey": secret_key,
        "Content-Type": "application/json; charset=utf-8",
        "cache-control": "max-age=60",
        "x-upsert": "true",
    }
    # 支援舊版 service_role JWT key
    if secret_key.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {secret_key}"
    return headers


def _validate_json_file(path):
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, list):
        raise RuntimeError(f"{path.name} 的 JSON 根節點必須是陣列")
    return len(data)


def upload_file(supabase_url, secret_key, bucket, filename, local_path):
    encoded_bucket = urllib.parse.quote(bucket, safe="")
    encoded_path = urllib.parse.quote(filename, safe="/")
    upload_url = (
        f"{supabase_url.rstrip('/')}/storage/v1/object/"
        f"{encoded_bucket}/{encoded_path}"
    )
    response = requests.post(
        upload_url,
        headers=_storage_headers(secret_key),
        data=local_path.read_bytes(),
        timeout=REQUEST_TIMEOUT,
    )
    if not response.ok:
        detail = response.text.strip()[:500]
        raise RuntimeError(
            f"上傳 {local_path.name} 失敗：HTTP {response.status_code} {detail}"
        )


def main():
    script_dir = Path(__file__).resolve().parent
    try:
        load_env_file(script_dir / ".env.local")
        supabase_url = _required_env("SUPABASE_URL")
        secret_key = _required_env("SUPABASE_SECRET_KEY")
        bucket = os.getenv("SUPABASE_BUCKET", DEFAULT_BUCKET).strip() or DEFAULT_BUCKET

        for filename in DATA_FILES:
            local_path = script_dir / filename
            if not local_path.exists():
                raise RuntimeError(f"找不到本地資料檔案 {local_path}")
            count = _validate_json_file(local_path)
            upload_file(
                supabase_url,
                secret_key,
                bucket,
                filename,
                local_path,
            )
            print(f"✅ 成功上傳 {filename}（共 {count} 本書籍）至 Supabase [{bucket}/{filename}]")

        public_base_url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/{urllib.parse.quote(bucket, safe='')}"
        print(f"🌐 公開存取路徑：{public_base_url}/{DATA_FILES[0]}")
    except (OSError, ValueError, requests.RequestException, RuntimeError) as exc:
        print(f"❌ 上傳失敗：{exc}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
