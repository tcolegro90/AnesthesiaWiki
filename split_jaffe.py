#!/usr/bin/env python3
"""
Split Jaffe.pdf into chapter files and upload them to Firebase Storage.
Run from the repo root (where firebase.json lives).
"""
import os
import sys

try:
    import pikepdf
except ImportError:
    sys.exit("pikepdf not found. Run: pip3 install pikepdf")

# ── Chapter definitions (1-based book page → 0-based PDF index) ──────────────
# Each entry: (storage_name, start_page, end_page)  — inclusive, 1-based
CHAPTERS = [
    ("chapters/jaffe-neurosurgery.pdf",        1,    342),
    ("chapters/jaffe-ophthalmic.pdf",         343,   405),
    ("chapters/jaffe-ent.pdf",                406,   605),
    ("chapters/jaffe-dental.pdf",             594,   605),  # short overlap ok
    ("chapters/jaffe-thoracic.pdf",           606,   746),
    ("chapters/jaffe-cardiovascular.pdf",     747,  1029),
    ("chapters/jaffe-general-surgery.pdf",   1030,  1542),
    ("chapters/jaffe-obgyn.pdf",             1543,  1775),
    ("chapters/jaffe-urology.pdf",           1776,  1867),
    ("chapters/jaffe-orthopedic.pdf",        1868,  2159),
    ("chapters/jaffe-plastic.pdf",           2160,  2319),
    ("chapters/jaffe-pediatric.pdf",         2320,  2918),
    ("chapters/jaffe-non-or.pdf",            2919,  3089),
    ("chapters/jaffe-office-based.pdf",      3090,  3108),
    ("chapters/jaffe-emergency.pdf",         3109,  3469),
]

PDF_PATH = os.path.expanduser("~/Desktop/Jaffe.pdf")
OUT_DIR  = os.path.join(os.path.dirname(__file__), "jaffe_chapters")
os.makedirs(OUT_DIR, exist_ok=True)

print(f"Opening {PDF_PATH} …")
src = pikepdf.open(PDF_PATH)
total_pages = len(src.pages)
print(f"Total pages: {total_pages}")

print("\n── Splitting ──")
local_files = []
for storage_name, start, end in CHAPTERS:
    end = min(end, total_pages)
    out_filename = os.path.basename(storage_name)
    out_path = os.path.join(OUT_DIR, out_filename)

    if os.path.exists(out_path):
        size_mb = os.path.getsize(out_path) / 1_048_576
        print(f"  {out_filename:45s}  (already exists, {size_mb:.1f} MB — skipping)")
    else:
        dst = pikepdf.Pdf.new()
        for page_idx in range(start - 1, end):
            dst.pages.append(src.pages[page_idx])
        dst.save(out_path)
        size_mb = os.path.getsize(out_path) / 1_048_576
        print(f"  {out_filename:45s}  pages {start:4d}–{end:4d}  ({size_mb:.1f} MB)")
    local_files.append((out_path, storage_name))

src.close()
print(f"\n✓ {len(local_files)} chapter files ready in {OUT_DIR}/")

# ── Upload to Firebase Storage via GCS JSON API ──────────────────────────────
import json
import urllib.request
import urllib.parse

BUCKET = "anesthesia-wiki-saved-files.firebasestorage.app"
CONFIG_PATH = os.path.expanduser("~/.config/configstore/firebase-tools.json")

def get_access_token():
    """Use cached access_token from Firebase CLI config, refresh if expired."""
    with open(CONFIG_PATH) as f:
        cfg = json.load(f)
    tokens = cfg["tokens"]
    import time
    # Try cached access_token first (check expiry)
    access_token = tokens.get("access_token", "")
    expires_at = tokens.get("expires_at", 0)
    # expires_at is in milliseconds in some versions, seconds in others
    now_ms = time.time() * 1000
    now_s  = time.time()
    if access_token and (expires_at > now_ms + 60000 or expires_at > now_s + 60):
        return access_token

    # Refresh using the refresh_token
    # Firebase CLI uses Google's OAuth2 with these public credentials
    refresh_token = tokens["refresh_token"]
    # Try to get client credentials from the config file itself
    client_id     = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
    client_secret = "j9iVZfS8nnY9ox6BNt2lBobv"
    data = urllib.parse.urlencode({
        "client_id":     client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type":    "refresh_token",
    }).encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        return result["access_token"]

print("\n── Uploading to Firebase Storage ──")
try:
    token = get_access_token()
    print("  Auth token obtained ✓")
except Exception as e:
    sys.exit(f"  Could not get auth token: {e}")

for local_path, storage_path in local_files:
    filename = os.path.basename(local_path)
    object_name = urllib.parse.quote(storage_path, safe="")
    url = f"https://storage.googleapis.com/upload/storage/v1/b/{BUCKET}/o?uploadType=media&name={object_name}"
    file_size = os.path.getsize(local_path)
    print(f"  Uploading {filename} ({file_size/1_048_576:.1f} MB) …", end=" ", flush=True)
    with open(local_path, "rb") as f:
        data = f.read()
    req = urllib.request.Request(
        url, data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/pdf"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
        print("✓")
    except urllib.error.HTTPError as e:
        print(f"✗  HTTP {e.code}: {e.read().decode()[:200]}")

print("\nDone! Update the JS chapter map in 1-Patient-Demographics.html.")
