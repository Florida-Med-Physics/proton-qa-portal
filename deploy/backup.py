"""Create a consistent local SQLite snapshot, then copy it to the backup share."""
import argparse
import os
import shutil
import sqlite3
import tempfile
from datetime import datetime
from pathlib import Path

def backup_database(source, destination):
    source, destination = Path(source).resolve(), Path(destination)
    if not source.is_file():raise ValueError('Source database does not exist.')
    if not destination.is_dir():raise ValueError('Backup directory is not available. No backup was written.')
    name = f'qa-portal-{datetime.now():%Y%m%d-%H%M%S-%f}.db'
    target, partial = destination / name, destination / (name + '.partial')
    with tempfile.TemporaryDirectory() as directory:
        snapshot = Path(directory)/'snapshot.db'
        with sqlite3.connect(source.as_uri()+'?mode=ro',uri=True) as live, sqlite3.connect(snapshot) as saved:
            live.backup(saved)
            if saved.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise RuntimeError('Backup integrity check failed.')
        try:
            with snapshot.open('rb') as src, partial.open('xb') as dst:
                shutil.copyfileobj(src,dst);dst.flush();os.fsync(dst.fileno())
            os.replace(partial,target)
        finally:
            partial.unlink(missing_ok=True)
    return target

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db',required=True)
    parser.add_argument('--destination',required=True)
    args=parser.parse_args()
    print(backup_database(args.db,args.destination))
