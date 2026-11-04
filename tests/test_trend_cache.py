"""The server build keeps each paged trends answer between parts (service.trend_page_json), on synthetic data only.

A kept answer is never used once anything in the database changed, whoever wrote it (this server, a second connection,
another process): every part is compared byte for byte with the answer worked out afresh by the code that recomputed
it for every part (reference_part, as in f14875f), and the token moves exactly when that answer does."""
import http.client
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
import zlib
from unittest import mock

from portal import auth, service
from portal.db import Database
from portal.server import COOKIE, Handler, PortalServer
from portal.wsgi import PortalApplication
from tests.test_portal import make_users


def reference_part(db, machine_id, tests=None, until=None, since=None, page='start'):
    """trend_page as it was before answers were kept (f14875f): every part works out the whole answer again."""
    whole = service.machine_trends(db, None, machine_id, tests=tests, until=until)
    series, members = [], {}
    for test_id in sorted(whole, key=int):
        points = whole[test_id]
        if id(points) not in members: members[id(points)] = []; series.append(points)
        members[id(points)].append(test_id)
    newest, order = {}, {}
    for points in series:
        for p in points:
            if p['source'] == 'sphinx' and p['assignment_id'] is not None: newest[p['assignment_id']] = max(newest.get(p['assignment_id'], 0), p['run_id'])
    for points in series:
        for p in points:
            if p['source'] == 'sphinx' and p['assignment_id'] is not None and newest.get(p['assignment_id']) == p['run_id']:
                o = order.setdefault(str(p['assignment_id']), {})
                for test_id in members[id(points)]: o[test_id] = p['source_order']
    kept = [[p for p in points if p['qa_date'] >= since] for points in series] if since else series
    flat = sorted(((p, s) for s, points in enumerate(kept) for p in points), key=lambda x: service._point_key(x[0]))
    taken = [iter(points) for points in kept]
    flat = [(next(taken[s]), s) for _, s in flat]
    text = json.dumps([[[members[id(series[s])], points] for s, points in enumerate(kept) if points], order], default=str).encode('utf-8')
    token = f'{zlib.crc32(text):08x}{zlib.adler32(text):08x}-{len(flat)}'
    start = 0 if page == 'start' else min(int(page), len(flat))
    out = {'series': [], 'tests': {}, 'next': None, 'token': token}
    if page == 'start': out['order'] = order
    size = len(json.dumps(out, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))
    entries, end, index = 0, start, {}
    for i in range(start, len(flat)):
        p, s = flat[i]
        add, ids = service._point_bytes(p), None
        if s in index: add += 1
        else:
            k = str(len(index)); ids = members[id(series[s])]; add += (1 if index else 0) + 2
            for test_id in ids: add += (1 if entries or test_id != ids[0] else 0) + len(test_id) + len(k) + 3
        next_bytes = len(str(i + 1)) - 2 if i + 1 < len(flat) else 0
        if i > start and size + add + next_bytes > service.TREND_PAGE_BYTES: break
        size += add; end = i + 1
        if ids:
            index[s] = len(out['series'])
            for test_id in ids: out['tests'][test_id] = len(out['series'])
            entries += len(ids); out['series'].append([])
        out['series'][index[s]].append(p)
    if end < len(flat): out['next'] = str(end)
    return out


def populate(db):
    """Three synthetic lists on one machine: A and B share each series; a PBS list whose renumbered spot (a test it owns
    but does not list) is an alias of its listed spot, so both share one series."""
    admin = make_users(db)['admin']
    m = service.save_machine(db, admin, {'name': 'Synthetic cache machine'})['id']

    def make(name, names):
        q = service.save_queue(db, admin, {'name': name, 'items': []})['id']
        ids = [service.save_test(db, admin, {'name': n, 'type': 'numeric', 'unit': 'mm', 'category': 'Energy', 'expected': 10, 'warn': 0.5,
                                             'fail': 1, 'owner_queue_id': q})['id'] for n in names]
        service.save_queue(db, admin, {'name': name, 'items': [{'test_id': t} for t in ids]}, q)
        return q, ids, service.save_assignment(db, admin, {'machine_id': m, 'queue_id': q, 'frequency': 'asneeded'})['id']
    energies = [f'Energy [{e} MeV] – Distal Depth' for e in (100, 150, 200)]
    f = {'admin': admin, 'm': m, 'runs': []}
    _, f['a_tests'], f['a'] = make('Synthetic list A', energies)
    _, f['b_tests'], f['b'] = make('Synthetic list B', energies)
    f['pbs'], (f['spot'],), f['p'] = make('PBS DailyQA Template - Synthetic', ['Spot 1 [100 MeV] – Position X'])
    f['renumbered'] = service.save_test(db, admin, {'name': 'Spot 7 [100 MeV] – Position X', 'type': 'numeric', 'unit': 'mm', 'category': 'Energy',
                                                    'expected': 0, 'warn': 1, 'fail': 2, 'owner_queue_id': f['pbs']})['id']
    for day in range(1, 13):
        for tests, a in ((f['a_tests'], f['a']), (f['b_tests'], f['b']), ([f['spot']], f['p'])):
            rid = service.submit_run(db, admin, a, {'qa_date': f'2026-09-{day:02d}', 'results': [{'test_id': t, 'value': 10 + day / 10 + j * 0.003}
                                                                                                for j, t in enumerate(tests)]})['id']
            f['runs'].append(rid)
        # the renumbered spot, as an export stored it with the PBS run
        db.run("INSERT INTO results (run_id, test_id, value_num, status) VALUES (?, ?, ?, 'pass')", (rid, f['renumbered'], day / 100))
        db.run("UPDATE runs SET source='sphinx' WHERE id=?", (rid,))
    return f


class TrendCacheTests(unittest.TestCase):
    def setUp(self):
        self.db = Database(':memory:')
        self.f = populate(self.db)
        self.admin, self.m = self.f['admin'], self.f['m']

    def tearDown(self):
        self.db.close()

    def part(self, q, page, db=None):
        return service.trend_page_json(db or self.db, self.admin, self.m, **service.trend_window({**q, 'page': page}))

    def reference(self, q, page, db=None):
        return json.dumps(reference_part(db or self.db, self.m, **service.trend_window({**q, 'page': page})), default=str).encode()

    def every_part(self, q, db=None):
        """Every part from the start, each checked against the answer worked out afresh."""
        parts, page = [], 'start'
        while page:
            data = self.part(q, page, db)
            self.assertEqual(data, self.reference(q, page, db))
            parts.append(json.loads(data)); page = parts[-1]['next']
            self.assertLess(len(parts), 500)
        return parts

    def whole_answer(self, q):
        """The answer worked out afresh in one part, without its token."""
        with mock.patch.object(service, 'TREND_PAGE_BYTES', 10 ** 9):
            whole = reference_part(self.db, self.m, **service.trend_window({**q, 'page': 'start'}))
        del whole['token']
        return whole

    def test_the_fixture_shares_series_through_lists_and_through_the_pbs_alias(self):
        whole = service.machine_trends(self.db, self.admin, self.m)
        self.assertIs(whole[str(self.f['a_tests'][0])], whole[str(self.f['b_tests'][0])])
        self.assertIs(whole[str(self.f['renumbered'])], whole[str(self.f['spot'])])

    def test_paging_works_the_answer_out_once(self):
        with mock.patch.object(service, 'TREND_PAGE_BYTES', 1200), mock.patch.object(service, '_trend_answer', wraps=service._trend_answer) as made:
            parts = self.every_part({})
            self.assertGreater(len(parts), 10)
            self.assertEqual(made.call_count, 1)
            self.every_part({})
            self.assertEqual(made.call_count, 1)   # the next visitor too, while nothing changes
            self.every_part({'from': '2026-09-05'})
            self.assertEqual(made.call_count, 2)   # another window is another answer

    def test_a_write_between_parts_is_never_answered_from_the_kept_answer(self):
        f, db, admin = self.f, self.db, self.admin
        result = db.one('SELECT id FROM results WHERE run_id=? ORDER BY id', (f['runs'][3],))['id']
        test = db.one('SELECT * FROM tests WHERE id=?', (f['b_tests'][0],))
        writes = [
            ('add a run', True, lambda: service.submit_run(db, admin, f['a'], {'qa_date': '2026-09-20', 'results': [{'test_id': f['a_tests'][0], 'value': 10.2}]})),
            ('edit a result value', True, lambda: db.run('UPDATE results SET value_num=value_num+0.25 WHERE id=?', (result,))),
            ('trash a run', True, lambda: service.trash_run(db, admin, f['runs'][4], {'reason': 'Synthetic'})),
            ('restore it', True, lambda: service.trash_run(db, admin, f['runs'][4], {'trashed': False})),
            ("move a test to another unit (its history key moves)", True, lambda: service.save_test(db, admin, {**test, 'unit': 'cm'}, test['id'])),
            ('put the renumbered spot on its PBS list (no longer an alias)', True,
             lambda: service.save_queue(db, admin, {'name': 'PBS DailyQA Template - Synthetic', 'items': [{'test_id': f['spot']}, {'test_id': f['renumbered']}]}, f['pbs'])),
            ('a write that leaves the answer alone', False, lambda: db.audit(admin['id'], 'synthetic', 'portal')),
        ]
        # Both windows are kept at once and read part-way when the write comes. The edit and the trash/restore touch runs of
        # 2026-09-02, so they change only the whole history's answer: from 2026-09-04 on the token must stay as it was.
        windows = ({}, {'from': '2026-09-04'})
        with mock.patch.object(service, 'TREND_PAGE_BYTES', 1200), mock.patch.object(service, '_trend_answer', wraps=service._trend_answer) as made:
            for name, changes, write in writes:
                with self.subTest(write=name):
                    first = [json.loads(self.part(q, 'start')) for q in windows]
                    before = [self.whole_answer(q) for q in windows]
                    calls = made.call_count
                    for q, part in zip(windows, first):
                        self.assertEqual(self.part(q, part['next']), self.reference(q, part['next']))
                    self.assertEqual(made.call_count, calls)   # from the kept answers
                    write()
                    for q, part, was in zip(windows, first, before):
                        after = self.part(q, part['next'])
                        self.assertEqual(after, self.reference(q, part['next']))
                        self.assertEqual(json.loads(after)['token'] != part['token'], self.whole_answer(q) != was)
                    self.assertEqual(made.call_count, calls + 2)   # each worked out again
                    self.assertEqual(self.whole_answer(windows[0]) != before[0], changes)
                    for q, part, was in zip(windows, first, before):
                        self.assertEqual(self.every_part(q)[0]['token'] != part['token'], self.whole_answer(q) != was)
                    self.assertEqual(made.call_count, calls + 2)
        whole = service.machine_trends(db, admin, self.m)
        self.assertIsNot(whole[str(f['renumbered'])], whole[str(f['spot'])])
        self.assertIsNot(whole[str(f['a_tests'][0])], whole[str(f['b_tests'][0])])

    def test_a_write_inside_a_transaction_that_rolls_back_is_never_kept(self):
        result = self.db.one('SELECT id FROM results WHERE run_id=? ORDER BY id', (self.f['runs'][0],))['id']
        before = self.part({}, 'start')
        with self.assertRaises(RuntimeError):
            with self.db.transaction():
                self.db.run('UPDATE results SET value_num=value_num+5 WHERE id=?', (result,))
                inside = self.part({}, 'start')
                self.assertEqual(inside, self.reference({}, 'start'))   # its own write, not yet committed
                self.assertNotEqual(json.loads(inside)['token'], json.loads(before)['token'])
                raise RuntimeError('roll back')
        self.assertEqual(self.part({}, 'start'), before)
        self.assertEqual(before, self.reference({}, 'start'))

    def test_a_write_by_another_connection_or_process_drops_the_kept_answer(self):
        folder = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, folder, True)
        path = os.path.join(folder, 'synthetic.db')
        db = Database(path)
        self.addCleanup(db.close)
        f = populate(db)
        self.m = f['m']
        result = db.one('SELECT id FROM results WHERE run_id=? ORDER BY id', (f['runs'][2],))['id']
        with mock.patch.object(service, 'TREND_PAGE_BYTES', 1200), mock.patch.object(service, '_trend_answer', wraps=service._trend_answer) as made:
            first = json.loads(self.part({}, 'start', db))
            self.assertEqual(self.part({}, first['next'], db), self.reference({}, first['next'], db))
            self.assertEqual(made.call_count, 1)
            other = Database(path)   # a second connection on the same file, as a second server or CLI command would open
            other.run('UPDATE results SET value_num=value_num+1 WHERE id=?', (result,))
            other.close()
            second = self.part({}, first['next'], db)
            self.assertEqual(second, self.reference({}, first['next'], db))
            self.assertNotEqual(json.loads(second)['token'], first['token'])
            self.assertEqual(made.call_count, 2)
            # another process, as run_portal.py import-sphinx would be while the server runs
            subprocess.run([sys.executable, '-c', 'import sqlite3, sys\nc = sqlite3.connect(sys.argv[1])\n'
                            'c.execute("UPDATE results SET value_num = value_num + 1 WHERE id = ?", (int(sys.argv[2]),))\nc.commit()\nc.close()',
                            path, str(result)], check=True, timeout=60)
            third = self.part({}, first['next'], db)
            self.assertEqual(third, self.reference({}, first['next'], db))
            self.assertNotIn(json.loads(third)['token'], (first['token'], json.loads(second)['token']))
            self.assertEqual(made.call_count, 3)
            self.every_part({}, db)

    def test_at_most_a_few_answers_are_kept_least_recently_used_dropped_first(self):
        windows = [{'from': f'2026-09-0{d}'} for d in range(1, 8)]
        key = lambda w: (self.m, None, None, w['from'])
        with mock.patch.object(service, '_trend_answer', wraps=service._trend_answer) as made:
            for w in windows[:4]: self.part(w, 'start')
            cache = service._TREND_CACHES[self.db]
            self.assertEqual(made.call_count, 4)
            self.part(windows[0], 'start')               # kept: now the most recently used
            self.part(windows[4], 'start')               # a fifth drops the least recently used, windows[1]
            self.assertEqual(made.call_count, 5)
            self.assertEqual(list(cache.answers), [key(w) for w in (windows[2], windows[3], windows[0], windows[4])])
            for w in windows[:7]: self.part(w, 'start')
            self.assertEqual(len(cache.answers), service.TREND_CACHE_ENTRIES)
            self.assertEqual(list(cache.answers), [key(w) for w in windows[3:7]])
            calls = made.call_count
            self.db.audit(self.admin['id'], 'synthetic', 'portal')   # any write drops every kept answer
            self.part(windows[6], 'start')
            self.assertEqual((made.call_count, list(cache.answers)), (calls + 1, [key(windows[6])]))
        self.assertEqual(service.TREND_CACHE_ENTRIES, 4)

    def test_both_servers_send_each_part_as_written(self):
        token = auth.create_session(self.db, self.admin['id'])
        self.addCleanup(setattr, PortalServer, 'current', PortalServer.current)
        server = PortalServer(('127.0.0.1', 0), self.db)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        app = PortalApplication(self.db, 'https://qa.example.invalid')
        statuses = []
        with mock.patch.object(service, 'TREND_PAGE_BYTES', 1500), mock.patch.object(Handler, 'log_message'):
            for q in ({}, {'from': '2026-09-05'}):
                page = 'start'
                while page:
                    query = '&'.join(f'{k}={v}' for k, v in {**q, 'page': page}.items())
                    conn = http.client.HTTPConnection('127.0.0.1', server.server_address[1], timeout=30)
                    conn.request('GET', f'/api/machines/{self.m}/trends?{query}', headers={'Cookie': f'{COOKIE}={token}'})
                    reply = conn.getresponse()
                    body = reply.read()
                    conn.close()
                    self.assertEqual((reply.status, reply.headers['Content-Type'], reply.headers['Content-Length']),
                                     (200, 'application/json; charset=utf-8', str(len(body))))
                    self.assertEqual(body, self.reference(q, page))
                    env = {'REQUEST_METHOD': 'GET', 'PATH_INFO': f'/api/machines/{self.m}/trends', 'QUERY_STRING': query, 'HTTP_COOKIE': f'{COOKIE}={token}'}
                    self.assertEqual(b''.join(app(env, lambda status, headers: statuses.append(status))), body)
                    page = json.loads(body)['next']
        self.assertEqual(set(statuses), {'200 OK'})

    def test_sizes_worked_out_from_the_reply_text_are_the_browser_builds(self):
        values = [None, 0, 7, -12, 2 ** 53 + 1, 10 ** 18, 0.0, -0.0, 10.0, -3.0, 0.1, 1e-4, 9.999999999999999e-05, 1e-5, 1.5e-05, 1e-7, 1e16,
                  9999999999999998.0, 1e21, 1.2345678901234567e20, 5e-324, 1.7976931348623157e308, float('inf'), float('-inf'), float('nan'),
                  123456789.125, -2.5e-10, 'pass', '2026-09-05', 'Δ é', 'a\x7fb', 'line\nbreak', 'nul\x00', 'q"b\\s', '\U0001F600', 'u\\u0041',
                  ' ', '١.٢', b'\x00\xff', True, False]
        rng = random.Random(20261104)
        for _ in range(4000):
            p = {k: rng.choice(values) for k in service._POINT_KEYS}
            self.assertEqual(service._point_size(p, service._REPLY_JSON(p)), service._point_bytes(p), p)


if __name__ == '__main__':
    unittest.main()
