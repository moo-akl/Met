import importlib.util
import json
import plistlib
import tempfile
import unittest
import zipfile
from pathlib import Path


spec = importlib.util.spec_from_file_location(
    "startup_permissions", Path(__file__).with_name("verify-ios-startup-permissions.py")
)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class StartupPermissionsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = self.root / "app.json"
        self.config.write_text(json.dumps({
            "expo": {
                "ios": {"bundleIdentifier": "test.met.fixture", "buildNumber": "1"},
                "plugins": ["expo-calendar"],
            }
        }))
        self.info = {
            "CFBundleIdentifier": "test.met.fixture",
            "CFBundleVersion": "1",
            **{key: "Fixture permission description" for key in validator.USAGE_KEYS},
        }

    def archive(self, info=None, fmt=plistlib.FMT_BINARY, extra=False):
        ipa = self.root / "fixture.ipa"
        with zipfile.ZipFile(ipa, "w") as archive:
            archive.writestr(
                "Payload/Met.app/Info.plist",
                plistlib.dumps(self.info if info is None else info, fmt=fmt),
            )
            if extra:
                archive.writestr("Payload/Other.app/Info.plist", plistlib.dumps(self.info))
        return ipa

    def test_accepts_binary_and_xml_app_metadata(self):
        for fmt in (plistlib.FMT_BINARY, plistlib.FMT_XML):
            with self.subTest(fmt=fmt):
                validator.validate_ipa(self.archive(fmt=fmt), self.config)

    def test_accepts_calendar_free_app_without_unused_permissions(self):
        self.config.write_text(json.dumps({
            "expo": {
                "ios": {"bundleIdentifier": "test.met.fixture", "buildNumber": "1"},
                "plugins": [],
            }
        }))
        info = {"CFBundleIdentifier": "test.met.fixture", "CFBundleVersion": "1"}
        validator.validate_ipa(self.archive(info), self.config)

    def test_calendar_dependency_requires_descriptions_without_plugin_entry(self):
        self.config.write_text(json.dumps({
            "expo": {
                "ios": {"bundleIdentifier": "test.met.fixture", "buildNumber": "1"},
                "plugins": [],
            }
        }))
        (self.root / "package.json").write_text(json.dumps({
            "dependencies": {"expo-calendar": "15.0.8"}
        }))
        info = {"CFBundleIdentifier": "test.met.fixture", "CFBundleVersion": "1"}
        with self.assertRaises(ValueError):
            validator.validate_ipa(self.archive(info), self.config)

    def test_rejects_every_missing_or_invalid_usage_description(self):
        for key in validator.USAGE_KEYS:
            for value in (None, "", " ", False):
                with self.subTest(key=key, value=value):
                    info = dict(self.info)
                    if value is None:
                        del info[key]
                    else:
                        info[key] = value
                    with self.assertRaises(ValueError):
                        validator.validate_ipa(self.archive(info), self.config)

    def test_rejects_the_build_355_missing_reminders_shape(self):
        info = dict(self.info)
        del info["NSRemindersUsageDescription"]
        del info["NSRemindersFullAccessUsageDescription"]
        with self.assertRaises(ValueError):
            validator.validate_ipa(self.archive(info), self.config)

    def test_rejects_wrong_build_or_identity(self):
        for key in ("CFBundleVersion", "CFBundleIdentifier"):
            with self.subTest(key=key):
                with self.assertRaises(ValueError):
                    validator.validate_ipa(self.archive({**self.info, key: "wrong"}), self.config)

    def test_rejects_ambiguous_archives(self):
        with self.assertRaises(ValueError):
            validator.validate_ipa(self.archive(extra=True), self.config)

    def test_rejects_missing_or_malformed_metadata(self):
        ipa = self.root / "bad.ipa"
        for name, value in (
            ("unrelated.txt", b"fixture"),
            ("Payload/Met.app/Info.plist", b"not a plist"),
        ):
            with self.subTest(name=name):
                with zipfile.ZipFile(ipa, "w") as archive:
                    archive.writestr(name, value)
                with self.assertRaises(Exception):
                    validator.validate_ipa(ipa, self.config)


if __name__ == "__main__":
    unittest.main()
