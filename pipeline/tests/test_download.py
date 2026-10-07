import hashlib
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from eleicoes.download import Downloader, SourceUnavailable
from eleicoes.sources import Source

BODY = b"some election data\n" * 100


class Handler(BaseHTTPRequestHandler):
    hits: list[str] = []

    def do_GET(self):
        Handler.hits.append(self.path)
        if self.path == "/complete.csv":
            self.send_response(200)
            self.send_header("Content-Length", str(len(BODY)))
            self.end_headers()
            self.wfile.write(BODY)
        elif self.path == "/truncated.csv":
            self.send_response(200)
            self.send_header("Content-Length", str(len(BODY) * 2))
            self.end_headers()
            self.wfile.write(BODY)
        else:
            self.send_error(404)

    def log_message(self, *args):
        pass


@pytest.fixture
def server():
    Handler.hits.clear()
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_port}"
    httpd.shutdown()


def downloader(tmp_path):
    return Downloader(tmp_path / "cache", clock=lambda: "2026-10-06T00:00:00Z", retry_delay=0)


def test_records_url_sha512_and_time(server, tmp_path):
    fetched = downloader(tmp_path).fetch(Source("complete", f"{server}/complete.csv"))
    assert fetched.sha512 == hashlib.sha512(BODY).hexdigest()
    assert fetched.record() == {
        "key": "complete",
        "url": f"{server}/complete.csv",
        "size": len(BODY),
        "sha512": hashlib.sha512(BODY).hexdigest(),
        "downloaded_at": "2026-10-06T00:00:00Z",
    }


def test_a_missing_file_fails_and_leaves_nothing(server, tmp_path):
    with pytest.raises(SourceUnavailable, match="HTTP 404"):
        downloader(tmp_path).fetch(Source("missing", f"{server}/missing.csv"))
    assert not any((tmp_path / "cache").glob("*missing*"))


def test_a_truncated_file_fails_and_leaves_nothing(server, tmp_path):
    with pytest.raises(SourceUnavailable, match="truncated"):
        downloader(tmp_path).fetch(Source("truncated", f"{server}/truncated.csv"))
    assert list((tmp_path / "cache").iterdir()) == []


def test_an_intact_cached_file_is_not_downloaded_again(server, tmp_path):
    source = Source("complete", f"{server}/complete.csv")
    first = downloader(tmp_path).fetch(source)
    again = downloader(tmp_path).fetch(source)
    assert again.sha512 == first.sha512
    assert Handler.hits == ["/complete.csv"]


def test_a_changed_cached_file_is_downloaded_again(server, tmp_path):
    source = Source("complete", f"{server}/complete.csv")
    first = downloader(tmp_path).fetch(source)
    first.path.write_bytes(b"changed on disk")
    again = downloader(tmp_path).fetch(source)
    assert again.path.read_bytes() == BODY
    assert again.sha512 == hashlib.sha512(BODY).hexdigest()
    assert Handler.hits == ["/complete.csv", "/complete.csv"]


def test_fresh_mode_downloads_again(server, tmp_path):
    source = Source("complete", f"{server}/complete.csv")
    first = downloader(tmp_path).fetch(source)
    first.path.write_bytes(b"changed on disk")
    fresh = Downloader(tmp_path / "cache", reuse_cache=False, retry_delay=0).fetch(source)
    assert fresh.path.read_bytes() == BODY


def test_a_cached_file_recorded_for_another_url_is_downloaded_again(server, tmp_path):
    source = Source("complete", f"{server}/complete.csv")
    first = downloader(tmp_path).fetch(source)
    meta = first.path.with_name(first.path.name + ".json")
    meta.write_text(meta.read_text().replace("/complete.csv", "/elsewhere.csv"))
    downloader(tmp_path).fetch(source)
    assert Handler.hits == ["/complete.csv", "/complete.csv"]
