# Local dev server with caching disabled, so edits show up on a normal refresh.
# Usage: python3 serve.py [port]
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
try:
    server = ThreadingHTTPServer(("", port), NoCacheHandler)
except OSError as e:
    if e.errno != 48:  # EADDRINUSE on macOS
        raise
    sys.exit(
        f"Port {port} is already in use - the site may already be running at http://localhost:{port}\n"
        f"Use another port:  python3 serve.py {port + 1}\n"
        f"Or free this one:  lsof -ti :{port} | xargs kill"
    )
print(f"Serving on http://localhost:{port}")
server.serve_forever()
