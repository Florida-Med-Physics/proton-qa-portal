"""Assemble the browser-only build in docs/ (served by GitHub Pages).

The interface (portal/static/app.js and app.css) is shared with the server version; this copies
it next to docs/local-backend.js, which answers the same /api requests from the browser's storage.
"""

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DOCS = ROOT / "docs"

for name in ("app.js", "app.css"):
    shutil.copyfile(ROOT / "portal" / "static" / name, DOCS / name)
    print("copied", name)
(DOCS / ".nojekyll").touch()
