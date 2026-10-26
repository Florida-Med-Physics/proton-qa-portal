"""Start the shared application. Secrets and database contents are never printed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import os
import logging
from urllib.parse import urlsplit
from waitress import serve
from portal.db import Database
from portal.wsgi import PortalApplication

logging.basicConfig(level=logging.INFO)
origin=os.environ.get('PORTAL_ORIGIN','')
url=urlsplit(origin)
if url.scheme!='https' or not url.netloc or url.path not in ('','/') or url.query or url.fragment or url.username:
    raise SystemExit('Set PORTAL_ORIGIN to the external HTTPS portal address, e.g. https://qa.example.org')
db=Database(os.environ.get('PROTON_QA_DB','/data/portal.db'))
app=PortalApplication(db,origin)
serve(app,host=os.environ.get('PORTAL_BIND_HOST','127.0.0.1'),port=8790,threads=16,connection_limit=256,channel_timeout=60,max_request_body_size=16*1024*1024,expose_tracebacks=False)
