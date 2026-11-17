#!/usr/bin/env python3
"""Read only public app metadata; never extract signing material from an IPA."""

import argparse
import json
import plistlib
import re
import sys
import zipfile
from pathlib import Path


USAGE_KEYS = (
    "NSCalendarsUsageDescription",
    "NSCalendarsFullAccessUsageDescription",
    "NSRemindersUsageDescription",
    "NSRemindersFullAccessUsageDescription",
)


def validate_ipa(ipa_path, config_path):
    config = json.loads(Path(config_path).read_text())["expo"]
    with zipfile.ZipFile(ipa_path) as archive:
        entries = [
            entry for entry in archive.infolist()
            if re.fullmatch(r"Payload/[^/]+\.app/Info\.plist", entry.filename)
        ]
        if len(entries) != 1 or entries[0].file_size > 2 * 1024 * 1024:
            raise ValueError("Expected one bounded application Info.plist.")
        info = plistlib.loads(archive.read(entries[0]))
    if not isinstance(info, dict):
        raise ValueError("Application Info.plist is not a dictionary.")
    for key, expected in (
        ("CFBundleIdentifier", config["ios"]["bundleIdentifier"]),
        ("CFBundleVersion", str(config["ios"]["buildNumber"])),
    ):
        if info.get(key) != expected:
            raise ValueError(f"Archive {key} does not match the outgoing app configuration.")
    for key in USAGE_KEYS:
        value = info.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Archive is missing the required startup description: {key}.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ipa")
    parser.add_argument("--config", default=str(Path(__file__).resolve().parent.parent / "app.json"))
    args = parser.parse_args()
    try:
        validate_ipa(args.ipa, args.config)
    except Exception:
        # Do not dump archive data, filesystem paths, or raw parser exceptions.
        print(
            "iOS startup permission check failed: verify archive identity and all four "
            "Calendar/Reminders usage descriptions.",
            file=sys.stderr,
        )
        return 1
    print("iOS startup permission check passed: archive identity and all four descriptions verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
