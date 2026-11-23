#!/usr/bin/env python3
"""Verify app identity and permissions for native modules present in the IPA."""

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


def calendar_module_configured(config, config_path):
    plugins = config.get("plugins", [])
    if plugins is None:
        plugins = []
    if not isinstance(plugins, list):
        raise ValueError("Expo plugins must be a list.")

    configured = any(
        plugin == "expo-calendar"
        or (isinstance(plugin, list) and plugin and plugin[0] == "expo-calendar")
        for plugin in plugins
    )

    package_path = Path(config_path).with_name("package.json")
    if package_path.exists():
        package = json.loads(package_path.read_text())
        for section in ("dependencies", "devDependencies"):
            if "expo-calendar" in package.get(section, {}):
                return True
    return configured


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

    if calendar_module_configured(config, config_path):
        for key in USAGE_KEYS:
            value = info.get(key)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"Archive is missing the required startup description: {key}.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ipa")
    parser.add_argument(
        "--config",
        default=str(Path(__file__).resolve().parent.parent / "app.json"),
    )
    args = parser.parse_args()
    try:
        validate_ipa(args.ipa, args.config)
    except Exception:
        # Do not dump archive data, filesystem paths, or raw parser exceptions.
        print(
            "iOS archive validation failed: verify bundle identity, build number, and "
            "usage descriptions required by configured native modules.",
            file=sys.stderr,
        )
        return 1
    print("iOS archive validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
