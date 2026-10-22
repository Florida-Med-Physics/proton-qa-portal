"""Assemble the browser-only build in docs/ (served by GitHub Pages).

The interface (portal/static/app.js and app.css) is shared with the server version; this copies
it next to docs/local-backend.js, which answers the same /api requests from the browser's storage.
The starting data (portal/seed.json, also used by `run_portal.py seed-defaults`) becomes docs/seed-data.js.
"""

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DOCS = ROOT / "docs"

for name in ("app.js", "app.css"):
    shutil.copyfile(ROOT / "portal" / "static" / name, DOCS / name)
    print("copied", name)
seed = json.loads((ROOT / "portal" / "seed.json").read_text(encoding="utf-8"))
(DOCS / "seed-data.js").write_text(
    "// Generated from portal/seed.json by build_pages.py; edit the JSON, not this file.\n"
    "// One daily QA template per machine type (plus the TrueBeam SRS list) and the machines that get a copy of each.\n"
    "// Draft for physicist review: limits left blank are Recorded, not judged, until confirmed.\n"
    "window.PORTAL_SEED = " + json.dumps(seed, indent=1, ensure_ascii=False) + ";\n", encoding="utf-8")
print("wrote seed-data.js")
(DOCS / ".nojekyll").touch()
