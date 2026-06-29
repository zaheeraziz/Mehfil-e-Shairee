#!/usr/bin/env python3
import argparse
import email
import getpass
import imaplib
import json
import mailbox
import re
import ssl
from datetime import datetime, timezone
from pathlib import Path


def safe_name(value: str) -> str:
    value = value.strip().strip('"')
    value = value.replace("/", "__")
    value = re.sub(r"[^A-Za-z0-9._@+-]+", "_", value)
    return value or "folder"


def parse_list_response(line: bytes):
    text = line.decode("utf-8", "replace")
    parts = text.rsplit(' "/" ', 1)
    if len(parts) == 2:
        return parts[1].strip().strip('"')
    match = re.search(r' "([^"]+)"$', text)
    if match:
        return match.group(1)
    return text.split()[-1].strip('"')


def append_to_mbox(path: Path, raw_message: bytes):
    msg = email.message_from_bytes(raw_message)
    mbox = mailbox.mbox(path)
    try:
        mbox.lock()
        mbox.add(msg)
        mbox.flush()
    finally:
        try:
            mbox.unlock()
        except Exception:
            pass
        mbox.close()


def count_mbox(path: Path) -> int:
    if not path.exists():
        return 0
    mbox = mailbox.mbox(path)
    try:
        return len(mbox)
    finally:
        mbox.close()


def write_manifest(out_dir: Path, manifest: dict):
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest_path


def connect(args, password, ctx):
    imap = imaplib.IMAP4_SSL(args.host, args.port, ssl_context=ctx)
    imap.login(args.username, password)
    return imap


def main():
    parser = argparse.ArgumentParser(description="Back up an IMAP mailbox into local .mbox files.")
    parser.add_argument("--host", default="imap.ipage.com")
    parser.add_argument("--port", type=int, default=993)
    parser.add_argument("--username", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--restart", action="store_true", help="Delete existing .mbox files and start over.")
    args = parser.parse_args()

    password = getpass.getpass(f"Password for {args.username}: ")
    out_dir = Path(args.out).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
        "username": args.username,
        "host": args.host,
        "port": args.port,
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "folders": [],
    }

    ctx = ssl.create_default_context()
    imap = connect(args, password, ctx)
    try:
        status, folder_rows = imap.list()
        if status != "OK":
            raise RuntimeError(f"Could not list folders: {status}")

        folders = [parse_list_response(row) for row in folder_rows or []]
        print(f"Found {len(folders)} folders.")

        for folder in folders:
            safe_folder = safe_name(folder)
            mbox_path = out_dir / f"{safe_folder}.mbox"
            if args.restart and mbox_path.exists():
                mbox_path.unlink()

            status, _ = imap.select(f'"{folder}"', readonly=True)
            if status != "OK":
                print(f"Skipping {folder}: select failed")
                manifest["folders"].append({
                    "folder": folder,
                    "status": "select_failed",
                    "messages": 0,
                })
                continue

            status, data = imap.search(None, "ALL")
            if status != "OK":
                print(f"Skipping {folder}: search failed")
                manifest["folders"].append({
                    "folder": folder,
                    "status": "search_failed",
                    "messages": 0,
                })
                continue

            ids = data[0].split() if data and data[0] else []
            existing_count = count_mbox(mbox_path)
            if existing_count > len(ids):
                print(f"{folder}: existing backup has {existing_count} messages, server has {len(ids)}; restarting this folder")
                mbox_path.unlink()
                existing_count = 0
            print(f"{folder}: {len(ids)} messages")
            if existing_count:
                print(f"  resuming after {existing_count} already backed up")
            count = existing_count
            remaining_ids = ids[existing_count:]
            for offset, msg_id in enumerate(remaining_ids, start=existing_count + 1):
                fetched = None
                for attempt in range(1, 4):
                    try:
                        status, fetched = imap.fetch(msg_id, "(RFC822)")
                        break
                    except imaplib.IMAP4.abort as error:
                        print(f"  connection dropped at {offset}/{len(ids)} ({error}); reconnecting, attempt {attempt}/3")
                        try:
                            imap.logout()
                        except Exception:
                            pass
                        imap = connect(args, password, ctx)
                        imap.select(f'"{folder}"', readonly=True)
                else:
                    raise RuntimeError(f"Could not fetch message {msg_id.decode('ascii', 'ignore')} after reconnect attempts")

                if status != "OK":
                    print(f"  warning: fetch failed for message {msg_id.decode('ascii', 'ignore')}")
                    continue
                raw = None
                for part in fetched:
                    if isinstance(part, tuple) and part[1]:
                        raw = part[1]
                        break
                if raw is None:
                    continue
                append_to_mbox(mbox_path, raw)
                count += 1
                if offset % 100 == 0:
                    print(f"  backed up {offset}/{len(ids)}")

            manifest["folders"].append({
                "folder": folder,
                "status": "ok",
                "messages": count,
                "file": str(mbox_path),
            })
            manifest["totalMessages"] = sum(item.get("messages", 0) for item in manifest["folders"])
            write_manifest(out_dir, manifest)

        imap.logout()
    finally:
        try:
            imap.logout()
        except Exception:
            pass

    manifest["finishedAt"] = datetime.now(timezone.utc).isoformat()
    manifest["totalMessages"] = sum(item.get("messages", 0) for item in manifest["folders"])
    manifest_path = write_manifest(out_dir, manifest)
    print(f"Backup complete: {out_dir}")
    print(f"Total messages: {manifest['totalMessages']}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
