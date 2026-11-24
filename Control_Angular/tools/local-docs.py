"""يعرض ملفات الطاقم المحلية جوه الموقع. مؤقت على هذا الجهاز فقط."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from urllib.parse import parse_qs, unquote, urlparse

ROOT = os.path.abspath(r"D:\NOOOOOOOT\Downloads\2- Crew")
TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        raw = unquote(query.get("path", [""])[0])
        full = os.path.abspath(raw) if raw else ""
        try:
            inside = os.path.commonpath([ROOT, full]) == ROOT
        except ValueError:
            inside = False
        if not inside or not os.path.isfile(full):
            self.send_error(404)
            return
        ext = os.path.splitext(full)[1].lower()
        with open(full, "rb") as handle:
            data = handle.read()
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", TYPES.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Content-Disposition", "inline")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        return


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 4791), Handler).serve_forever()
