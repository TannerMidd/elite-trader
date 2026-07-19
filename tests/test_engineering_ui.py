"""Release entry points package the engineering catalog and its notices."""

from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def test_engineering_catalog_is_in_both_release_paths():
    workflow = (ROOT / ".github" / "workflows" / "release.yml").read_text(
        encoding="utf-8"
    )
    batch = (ROOT / "build_exe.bat").read_text(encoding="utf-8")

    # PyInstaller .spec files are generated local build artifacts and intentionally
    # ignored. Validate the versioned entry points used by maintainers and CI.
    for content in (workflow, batch):
        assert "engineering_catalog.json.gz" in content
        assert "THIRD_PARTY_NOTICES.md" in content


def test_engineering_catalog_is_unignored_for_clean_checkouts():
    ignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
    assert "!elite/data/engineering_catalog.json.gz" in ignore


def main():
    """Run the packaging checks in CI environments that execute test files directly."""
    test_engineering_catalog_is_in_both_release_paths()
    test_engineering_catalog_is_unignored_for_clean_checkouts()


if __name__ == "__main__":
    main()
