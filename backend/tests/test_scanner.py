"""Tests for scanner module — output parsing and command building."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from models import ScanOptions, ScanResult, ScanStatus, ScanType
from scanner import ScanManager, parse_text_output


# ---------------------------------------------------------------------------
# parse_text_output tests
# ---------------------------------------------------------------------------

class TestParseTextOutput:
    """Tests for czkawka_cli text output parsing."""

    def test_empty_input(self):
        assert parse_text_output("", ScanType.DUPLICATES) == []
        assert parse_text_output("   ", ScanType.EMPTY_FILES) == []

    def test_empty_dirs_simple(self):
        text = """/storage/media/empty1
/storage/media/empty2
/storage/docs/empty3"""
        result = parse_text_output(text, ScanType.EMPTY_DIRS)
        assert len(result) == 3
        assert result[0]["path"] == "/storage/media/empty1"
        assert result[2]["path"] == "/storage/docs/empty3"

    def test_empty_files_with_headers(self):
        text = """---- Empty Files ----
Found 2 empty files
/storage/media/empty.txt
/storage/docs/blank.log"""
        result = parse_text_output(text, ScanType.EMPTY_FILES)
        assert len(result) == 2
        assert result[0]["path"] == "/storage/media/empty.txt"

    def test_temporary_files(self):
        text = """/storage/temp1.tmp
/storage/temp2.bak"""
        result = parse_text_output(text, ScanType.TEMPORARY)
        assert len(result) == 2

    def test_symlinks(self):
        text = """/storage/link1 -> /storage/target1
/storage/link2"""
        result = parse_text_output(text, ScanType.SYMLINKS)
        assert len(result) == 2

    def test_bad_extensions(self):
        text = """/storage/file.jpg
/storage/file2.png"""
        result = parse_text_output(text, ScanType.BAD_EXTENSIONS)
        assert len(result) == 2

    def test_broken_files(self):
        text = """/storage/broken1.zip
/storage/broken2.rar"""
        result = parse_text_output(text, ScanType.BROKEN)
        assert len(result) == 2

    def test_duplicates_groups(self):
        """Duplicates are returned as groups separated by blank lines."""
        text = """1048576 - /storage/video/movie.mp4
1048576 - /storage/backup/movie.mp4

2097152 - /storage/music/song.mp3
2097152 - /storage/old/song.mp3
2097152 - /storage/temp/song.mp3"""
        result = parse_text_output(text, ScanType.DUPLICATES)
        assert len(result) == 2  # 2 groups
        assert len(result[0]["files"]) == 2
        assert len(result[1]["files"]) == 3
        assert result[0]["files"][0]["size"] == 1048576
        assert result[0]["files"][0]["path"] == "/storage/video/movie.mp4"

    def test_duplicates_with_headers_and_blank_lines(self):
        text = """---- Duplicate Files ----
Searching for duplicates

1048576 - /storage/a.txt
1048576 - /storage/b.txt

Found 1 group"""
        result = parse_text_output(text, ScanType.DUPLICATES)
        assert len(result) == 1
        assert len(result[0]["files"]) == 2

    def test_similar_images_groups(self):
        text = """/storage/img/photo1.jpg
/storage/img/photo1_copy.jpg

/storage/img/landscape.png
/storage/backup/landscape.png"""
        result = parse_text_output(text, ScanType.SIMILAR_IMAGES)
        assert len(result) == 2
        assert len(result[0]["files"]) == 2

    def test_similar_videos(self):
        text = """/storage/video/clip.mp4
/storage/video/clip_dup.mp4"""
        result = parse_text_output(text, ScanType.SIMILAR_VIDEOS)
        assert len(result) == 1
        assert len(result[0]["files"]) == 2

    def test_similar_music(self):
        text = """/storage/music/song.mp3
/storage/music/song_copy.mp3"""
        result = parse_text_output(text, ScanType.SIMILAR_MUSIC)
        assert len(result) == 1
        assert len(result[0]["files"]) == 2


# ---------------------------------------------------------------------------
# ScanManager._build_command tests
# ---------------------------------------------------------------------------

class TestBuildCommand:
    """Tests for command-line argument construction."""

    def _make_scan(self, scan_type: ScanType, **kwargs) -> ScanResult:
        opts = ScanOptions(**kwargs)
        return ScanResult(
            id="test123",
            scan_type=scan_type,
            status=ScanStatus.PENDING,
            directories=["/storage/video"],
            excluded_directories=["@eaDir"],
            options=opts,
            created_at=datetime.now(timezone.utc),
        )

    def test_duplicates_basic(self):
        mgr = ScanManager()
        scan = self._make_scan(ScanType.DUPLICATES)
        cmd = mgr._build_command(scan)

        assert cmd[0].endswith("czkawka_cli")
        assert cmd[1] == "duplicates"
        assert "--directories" in cmd
        assert "--excluded-directories" in cmd
        assert "--json" in cmd

    def test_duplicates_with_options(self):
        mgr = ScanManager()
        scan = self._make_scan(
            ScanType.DUPLICATES,
            search_method="hash",
            min_size=1048576,
        )
        cmd = mgr._build_command(scan)

        assert "--search-method" in cmd
        idx = cmd.index("--search-method")
        assert cmd[idx + 1] == "hash"
        assert "--min-size" in cmd
        idx = cmd.index("--min-size")
        assert cmd[idx + 1] == "1048576"

    def test_similar_images(self):
        mgr = ScanManager()
        scan = self._make_scan(
            ScanType.SIMILAR_IMAGES,
            similarity_preset="medium",
        )
        cmd = mgr._build_command(scan)

        assert cmd[1] == "similar-images"
        assert "--similarity-preset" in cmd
        idx = cmd.index("--similarity-preset")
        assert cmd[idx + 1] == "medium"

    def test_similar_videos(self):
        mgr = ScanManager()
        scan = self._make_scan(
            ScanType.SIMILAR_VIDEOS,
            tolerance=5,
        )
        cmd = mgr._build_command(scan)

        assert cmd[1] == "similar-videos"
        assert "--tolerance" in cmd
        idx = cmd.index("--tolerance")
        assert cmd[idx + 1] == "5"

    def test_similar_music(self):
        mgr = ScanManager()
        scan = self._make_scan(
            ScanType.SIMILAR_MUSIC,
            music_similarity="very_high",
        )
        cmd = mgr._build_command(scan)

        assert cmd[1] == "similar-music"
        assert "--music-similarity" in cmd

    def test_empty_dirs(self):
        mgr = ScanManager()
        scan = self._make_scan(ScanType.EMPTY_DIRS)
        cmd = mgr._build_command(scan)
        assert cmd[1] == "empty-dirs"

    def test_empty_files(self):
        mgr = ScanManager()
        scan = self._make_scan(ScanType.EMPTY_FILES)
        cmd = mgr._build_command(scan)
        assert cmd[1] == "empty-files"

    def test_temporary(self):
        mgr = ScanManager()
        scan = self._make_scan(ScanType.TEMPORARY)
        cmd = mgr._build_command(scan)
        assert cmd[1] == "temporary"

    def test_symlinks(self):
        mgr = ScanManager()
        scan = self._make_scan(ScanType.SYMLINKS)
        cmd = mgr._build_command(scan)
        assert cmd[1] == "symlinks"

    def test_bad_extensions(self):
        mgr = ScanManager()
        scan = self._make_scan(ScanType.BAD_EXTENSIONS)
        cmd = mgr._build_command(scan)
        assert cmd[1] == "bad-extensions"

    def test_broken_with_types(self):
        mgr = ScanManager()
        scan = self._make_scan(
            ScanType.BROKEN,
            checked_types=["zip", "pdf"],
        )
        cmd = mgr._build_command(scan)

        assert cmd[1] == "broken"
        assert "--checked-types" in cmd
        idx = cmd.index("--checked-types")
        assert cmd[idx + 1] == "zip,pdf"

    def test_multiple_directories(self):
        mgr = ScanManager()
        scan = ScanResult(
            id="test456",
            scan_type=ScanType.DUPLICATES,
            status=ScanStatus.PENDING,
            directories=["/storage/video", "/storage/music", "/storage/docs"],
            excluded_directories=[],
            options=ScanOptions(),
            created_at=datetime.now(timezone.utc),
        )
        cmd = mgr._build_command(scan)
        idx = cmd.index("--directories")
        assert cmd[idx + 1] == "/storage/video,/storage/music,/storage/docs"


# ---------------------------------------------------------------------------
# ScanManager counting / size helpers
# ---------------------------------------------------------------------------

class TestScanHelpers:

    def test_count_findings_list(self):
        assert ScanManager._count_findings([1, 2, 3]) == 3

    def test_count_findings_groups(self):
        groups = [
            {"files": [{"path": "a"}, {"path": "b"}]},
            {"files": [{"path": "c"}]},
        ]
        assert ScanManager._count_findings(groups) == 3

    def test_count_findings_dict(self):
        d = {"duplicates": [1, 2], "similar": [3]}
        assert ScanManager._count_findings(d) == 3

    def test_count_findings_none(self):
        assert ScanManager._count_findings(None) == 0

    def test_calc_total_size_groups(self):
        groups = [
            {"files": [{"path": "a", "size": 100}, {"path": "b", "size": 200}]},
            {"files": [{"path": "c", "size": 300}]},
        ]
        assert ScanManager._calc_total_size(groups) == 600

    def test_calc_total_size_flat(self):
        items = [{"path": "a", "size": 500}, {"path": "b", "size": 500}]
        assert ScanManager._calc_total_size(items) == 1000

    def test_calc_total_size_none(self):
        assert ScanManager._calc_total_size(None) == 0
