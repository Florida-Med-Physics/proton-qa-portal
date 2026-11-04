"""Paged machine trends (page=start, then each reply's next) in the server build, on synthetic data only.

Joining the parts gives exactly the unpaged reply for the same window; each part stays within the byte budget as the
browser build measures it; the order map is the one Machine Trends used to work out from the whole history; bad input
is refused with the same text as docs/local-backend.js (tests/test_trend_pages.cjs)."""
import json
import unittest
from unittest import mock

from portal import service
from portal.db import Database
from tests.test_portal import make_users

ENERGIES = (100, 150, 200)
# The same refusals, word for word, are checked in tests/test_trend_pages.cjs.
REFUSED = [
    ({'from': '2026-9-01'}, 'from: give a date as YYYY-MM-DD.'),
    ({'from': '٢٠٢٦-01-01'}, 'from: give a date as YYYY-MM-DD.'),
    ({'from': '2026-09-01T00'}, 'from: give a date as YYYY-MM-DD.'),
    ({'page': 'x'}, 'page: give start, or the next value from the previous page.'),
    ({'page': 'Start'}, 'page: give start, or the next value from the previous page.'),
    ({'page': '0'}, 'page: give start, or the next value from the previous page.'),
    ({'page': '012'}, 'page: give start, or the next value from the previous page.'),
    ({'page': '-1'}, 'page: give start, or the next value from the previous page.'),
    ({'page': '1.5'}, 'page: give start, or the next value from the previous page.'),
    ({'page': '12\n'}, 'page: give start, or the next value from the previous page.'),
    ({'page': ' 12'}, 'page: give start, or the next value from the previous page.'),
    ({'page': '1234567890123456'}, 'page: give start, or the next value from the previous page.'),
    ({'page': '١٢'}, 'page: give start, or the next value from the previous page.'),
    ({'page': '2026-09-01.1.2.1'}, 'page: give start, or the next value from the previous page.'),
    ({'page': 'start', 'last': '5'}, 'page: cannot be combined with last.'),
    ({'page': '12', 'last': '5'}, 'page: cannot be combined with last.'),
    ({'page': 'x', 'from': 'x'}, 'from: give a date as YYYY-MM-DD.'),
]


def js_size(value):
    """Bytes of value as compact JSON written the way JavaScript's JSON.stringify writes it (UTF-8)."""
    def dump(v):
        if isinstance(v, dict): return '{' + ','.join(json.dumps(str(k), ensure_ascii=False) + ':' + dump(x) for k, x in v.items()) + '}'
        if isinstance(v, list): return '[' + ','.join(dump(x) for x in v) + ']'
        return service._js_json(v)
    return len(dump(value).encode('utf-8'))


def old_order(histories, assignment_id):
    """Machine Trends' former order computation (app.js renderTrendOverview), applied to an unpaged reply."""
    imported = [(test_id, p) for test_id, points in sorted(histories.items(), key=lambda kv: int(kv[0])) for p in points
                if p['source'] == 'sphinx' and str(p['assignment_id']) == str(assignment_id)]
    newest = max([0] + [p['run_id'] for _, p in imported])
    return {str(test_id): p['source_order'] for test_id, p in imported if p['run_id'] == newest}


class TrendPageTests(unittest.TestCase):
    def setUp(self):
        self.db = db = Database(':memory:')
        self.admin = admin = make_users(db)['admin']
        self.m = service.save_machine(db, admin, {'name': 'Synthetic paging machine'})['id']

        def make(name, tests):
            q = service.save_queue(db, admin, {'name': name, 'items': []})['id']
            ids = [service.save_test(db, admin, {'name': t, 'type': 'numeric', 'unit': 'mm', 'category': 'Energy', 'expected': 10, 'warn': 0.5,
                                                 'fail': 1, 'owner_queue_id': q})['id'] for t in tests]
            service.save_queue(db, admin, {'name': name, 'items': [{'test_id': t} for t in ids]}, q)
            return ids, service.save_assignment(db, admin, {'machine_id': self.m, 'queue_id': q, 'frequency': 'asneeded'})['id']
        names = [f'Energy [{e} MeV] – Distal Depth' for e in ENERGIES]
        self.a_tests, self.a = make('Synthetic list A', names)
        self.b_tests, self.b = make('Synthetic list B', names)                                  # shares A's series
        self.c_tests, self.c = make('Synthetic list C', ['Energy [226 MeV] – Distal Depth',
                                                         'Energy [100 MeV] – Distal Depth',     # two tests, one series:
                                                         'GTR5_Energy [100.00 MeV]: Distal Depth [mm]'])  # ties in one run
        self.runs = []
        for day in range(1, 13):
            for k, (tests, a) in enumerate([(self.a_tests, self.a), (self.b_tests, self.b), (self.c_tests, self.c)]):
                if (day + k) % 3 == 2: continue
                values = [10 + day / 10 + j * 0.003 + k * 1e-7 for j in range(len(tests))]
                rid = service.submit_run(db, admin, a, {'qa_date': f'2026-09-{day:02d}', 'results': [{'test_id': t, 'value': v} for t, v in zip(tests, values)]})['id']
                self.runs.append((rid, a, day))
        # Synthetic Sphinx imports: list A's newest is on 2026-09-02, before the from= used below; list C's is later.
        self.sphinx = {self.a: [r for r, a, d in self.runs if a == self.a and d <= 2], self.c: [r for r, a, d in self.runs if a == self.c and d in (4, 9)]}
        for runs in self.sphinx.values():
            for r in runs: db.run("UPDATE runs SET source='sphinx' WHERE id=?", (r,))
        service.trash_run(db, admin, self.runs[5][0], {'reason': 'Synthetic'})

    def tearDown(self):
        self.db.close()

    def pages(self, q, budget):
        """Every part for window q at this budget, through trend_window as the server routes it."""
        parts, page = [], 'start'
        with mock.patch.object(service, 'TREND_PAGE_BYTES', budget):
            while page:
                part = service.trend_page(self.db, self.admin, self.m, **service.trend_window({**q, 'page': page}))
                parts.append(part)
                self.assertTrue(part['next'] != page and len(parts) < 5000, 'each part moves on')
                page = part['next']
        return parts

    def assemble(self, parts):
        histories = {}
        for part in parts:
            self.assertEqual(part['token'], parts[0]['token'])
            for test_id, index in part['tests'].items():
                histories.setdefault(test_id, []).extend(part['series'][index])
        return histories

    def test_parts_join_to_the_unpaged_reply_for_every_window_and_budget(self):
        windows = [{}, {'until': '2026-09-08'}, {'from': '2026-09-05'}, {'from': '2026-09-05', 'until': '2026-09-10'},
                   {'tests': str(self.a_tests[0])}, {'tests': f'{self.b_tests[1]},{self.c_tests[0]}', 'from': '2026-09-03'},
                   {'tests': str(self.c_tests[2]), 'until': '2026-09-06'}, {'from': '2026-12-01'}]
        for q in windows:
            whole = service.machine_trends(self.db, self.admin, self.m, **service.trend_window(q))
            self.assertTrue(whole or q == {'from': '2026-12-01'})
            first = None
            for budget in (1, 700, 1500, 4000, service.TREND_PAGE_BYTES):
                with self.subTest(window=q, budget=budget):
                    parts = self.pages(q, budget)
                    self.assertEqual(self.assemble(parts), whole)
                    self.assertTrue(all('order' not in part for part in parts[1:]))
                    for part in parts:
                        points = sum(len(s) for s in part['series'])
                        self.assertGreaterEqual(points, 1 if whole else 0)
                        self.assertTrue(js_size(part) <= budget or points <= 1, (js_size(part), budget))   # always one point, even over budget
                        # each series once per part; tests maps every test of the unpaged reply that has points here
                        self.assertEqual(len({id(s) for s in part['series']}), len(part['series']))
                        self.assertEqual(sorted(set(part['tests'].values())), list(range(len(part['series']))))
                    if budget == 1:
                        self.assertEqual(len(parts), max(1, sum(len(v) for v in {id(v): v for v in whole.values()}.values())))
                    first = first or parts[0]['token']
                    self.assertEqual(parts[0]['token'], first)   # the token does not depend on the budget

    def test_each_part_is_exactly_as_large_as_fits(self):
        # For every budget from 250 to 1000 bytes the first two parts are the greedy parts built here from the whole
        # answer: within the budget (or a single point), and one more point would not fit.
        for q in ({}, {'from': '2026-09-05'}):
            full, = self.pages(q, 10 ** 9)
            members = [[t for t in sorted(full['tests'], key=int) if full['tests'][t] == i] for i in range(len(full['series']))]
            flat = sorted(((p, s) for s, points in enumerate(full['series']) for p in points), key=lambda x: service._point_key(x[0]))

            def build(a, b):
                part = {'series': [], 'tests': {}, 'next': str(b) if b < len(flat) else None, 'token': full['token']}
                if a == 0: part['order'] = full['order']
                index = {}
                for p, s in flat[a:b]:
                    if s not in index:
                        index[s] = len(part['series'])
                        for t in members[s]: part['tests'][t] = index[s]
                        part['series'].append([])
                    part['series'][index[s]].append(p)
                return part
            for budget in range(250, 1001):
                with self.subTest(window=q, budget=budget), mock.patch.object(service, 'TREND_PAGE_BYTES', budget):
                    at, page = 0, 'start'
                    for _ in range(2):
                        if not page: break
                        part = service.trend_page(self.db, self.admin, self.m, **service.trend_window({**q, 'page': page}))
                        k = sum(len(s) for s in part['series'])
                        self.assertEqual(part, build(at, at + k))
                        self.assertTrue(k == 1 or js_size(part) <= budget)
                        if at + k < len(flat): self.assertGreater(js_size(build(at, at + k + 1)), budget)
                        at, page = at + k, part['next']

    def test_ties_in_one_run_and_one_date_are_neither_lost_nor_repeated(self):
        whole = service.machine_trends(self.db, self.admin, self.m)
        shared = whole[str(self.c_tests[1])]
        self.assertIs(shared, whole[str(self.c_tests[2])])
        self.assertTrue(any(p['run_id'] == q['run_id'] for p, q in zip(shared, shared[1:])))   # same run, same series
        parts = self.pages({}, 1)
        sent = [(p['qa_date'], p['run_id'], p['source_order']) for part in parts for s in part['series'] for p in s]
        self.assertEqual(sent, sorted(sent))
        self.assertEqual(len(sent), len(set(sent)))
        self.assertEqual([part['next'] for part in parts], [str(k) for k in range(1, len(parts))] + [None])   # points sent so far

    def test_odd_stored_values_page_like_any_other(self):
        # Only legacy or restored data can hold these: a QA date that is not YYYY-MM-DD, and a Sphinx run whose id is 0
        # (the overview and local-backend.js take the newest run as Math.max from 0, so it still counts).
        self.db.run('UPDATE runs SET qa_date=? WHERE id=?', ('2026-09-06T08:00', self.runs[10][0]))
        self.db.run("UPDATE runs SET source='manual' WHERE assignment_id=?", (self.c,))
        lone = self.sphinx[self.c][0]
        self.db.conn.execute('PRAGMA foreign_keys=OFF')
        try:
            self.db.run('UPDATE results SET run_id=0 WHERE run_id=?', (lone,))
            self.db.run("UPDATE runs SET id=0, source='sphinx' WHERE id=?", (lone,))
        finally:
            self.db.conn.execute('PRAGMA foreign_keys=ON')
        whole = service.machine_trends(self.db, self.admin, self.m)
        self.assertTrue(any(p['qa_date'] == '2026-09-06T08:00' for points in whole.values() for p in points))
        for q in ({}, {'from': '2026-09-06'}):
            expected = service.machine_trends(self.db, self.admin, self.m, **service.trend_window(q))
            for budget in (1, 700, service.TREND_PAGE_BYTES):
                with self.subTest(window=q, budget=budget):
                    parts = self.pages(q, budget)
                    self.assertEqual(self.assemble(parts), expected)
                    self.assertEqual(parts[0]['order'].get(str(self.c), {}), old_order(whole, self.c))
        self.assertTrue(old_order(whole, self.c))

    def test_a_test_added_to_a_series_with_no_points_in_the_window_leaves_every_part_alone(self):
        q = service.save_queue(self.db, self.admin, {'name': 'Synthetic list D', 'items': []})['id']
        solo = service.save_test(self.db, self.admin, {'name': 'Energy [180 MeV] – Distal Depth', 'type': 'numeric', 'unit': 'mm', 'category': 'Energy',
                                                       'expected': 10, 'warn': 0.5, 'fail': 1, 'owner_queue_id': q})['id']
        service.save_queue(self.db, self.admin, {'name': 'Synthetic list D', 'items': [{'test_id': solo}]}, q)
        d = service.save_assignment(self.db, self.admin, {'machine_id': self.m, 'queue_id': q, 'frequency': 'asneeded'})['id']
        service.submit_run(self.db, self.admin, d, {'qa_date': '2026-09-01', 'results': [{'test_id': solo, 'value': 10.1}]})
        before, before_all = self.pages({'from': '2026-09-05'}, 1500), self.pages({}, 1500)
        q2 = service.save_queue(self.db, self.admin, {'name': 'Synthetic list E', 'items': []})['id']
        twin = service.save_test(self.db, self.admin, {'name': 'Energy [180 MeV] – Distal Depth', 'type': 'numeric', 'unit': 'mm', 'category': 'Energy',
                                                       'expected': 10, 'warn': 0.5, 'fail': 1, 'owner_queue_id': q2})['id']
        whole = service.machine_trends(self.db, self.admin, self.m)
        self.assertIs(whole[str(twin)], whole[str(solo)])   # one series, two tests, no points from 2026-09-05 on
        self.assertEqual(self.pages({'from': '2026-09-05'}, 1500), before)   # token included
        after_all = self.pages({}, 1500)
        self.assertTrue(any(str(twin) in part['tests'] for part in after_all))
        self.assertNotEqual(after_all[0]['token'], before_all[0]['token'])

    def test_order_map_is_the_overviews_former_answer_even_when_the_newest_import_is_before_from(self):
        whole = service.machine_trends(self.db, self.admin, self.m)
        for q in ({}, {'from': '2026-09-05'}, {'from': '2026-09-10'}, {'until': '2026-09-03'}, {'tests': str(self.a_tests[1])}):
            with self.subTest(window=q):
                order = self.pages(q, service.TREND_PAGE_BYTES)[0]['order']
                base = service.machine_trends(self.db, self.admin, self.m, **{k: v for k, v in service.trend_window(q).items() if k != 'since'})
                for a in (self.a, self.b, self.c):
                    self.assertEqual(order.get(str(a), {}), old_order(base, a))
        order = self.pages({'from': '2026-09-05'}, 1)[0]['order']
        newest_a = max(self.sphinx[self.a])
        self.assertTrue(order[str(self.a)])
        self.assertEqual(set(order[str(self.a)]), {str(t) for t in self.a_tests + self.b_tests + self.c_tests[1:]})
        self.assertTrue(all(p['qa_date'] < '2026-09-05' for points in whole.values() for p in points if p['run_id'] == newest_a))
        self.assertNotIn(str(self.b), order)

    def test_token_changes_with_anything_that_changes_the_answer(self):
        token = lambda q={}: self.pages(q, service.TREND_PAGE_BYTES)[0]['token']
        start = token()
        self.assertEqual(token(), start)
        self.assertNotEqual(token({'from': '2026-09-05'}), start)
        rid = service.submit_run(self.db, self.admin, self.a, {'qa_date': '2026-09-20', 'results': [{'test_id': self.a_tests[0], 'value': 10.2}]})['id']
        added = token();self.assertNotEqual(added, start)
        service.trash_run(self.db, self.admin, rid, {'reason': 'Synthetic'})
        self.assertEqual(token(), start)   # a checksum of the answer: the same answer gives the same token
        result = self.db.one('SELECT id FROM results WHERE run_id=?', (self.runs[0][0],))['id']
        self.db.run('UPDATE results SET value_num=value_num+0.001 WHERE id=?', (result,))
        edited = token();self.assertNotEqual(edited, start)
        self.db.run('UPDATE results SET status=? WHERE id=?', ('warn', result))
        self.assertNotEqual(token(), edited);edited = token()
        self.db.run('UPDATE tests SET name=? WHERE id=?', ('Energy [110 MeV] – Distal Depth', self.b_tests[0]))
        self.assertNotEqual(token(), edited)   # B's test no longer shares A's series
        self.db.run("UPDATE runs SET source='sphinx' WHERE id=?", (self.runs[-1][0],))
        self.assertNotEqual(token(), edited)
        # A change before from that alters only the order map changes the token too.
        was = self.pages({'from': '2026-09-05'}, service.TREND_PAGE_BYTES)[0]
        self.db.run("UPDATE runs SET source='manual' WHERE id=?", (max(self.sphinx[self.a]),))
        now = self.pages({'from': '2026-09-05'}, service.TREND_PAGE_BYTES)[0]
        self.assertEqual((now['series'], now['tests'], now['next']), (was['series'], was['tests'], was['next']))
        self.assertNotEqual(now['order'], was['order'])
        self.assertNotEqual(now['token'], was['token'])

    def test_a_part_after_a_change_carries_the_new_token(self):
        with mock.patch.object(service, 'TREND_PAGE_BYTES', 1500):
            first = service.trend_page(self.db, self.admin, self.m, page='start')
            service.submit_run(self.db, self.admin, self.c, {'qa_date': '2026-09-01', 'results': [{'test_id': self.c_tests[0], 'value': 10.4}]})
            second = service.trend_page(self.db, self.admin, self.m, page=first['next'])
        self.assertNotEqual(first['token'], second['token'])

    def test_refusals_match_the_browser_build(self):
        for q, message in REFUSED:
            with self.subTest(q=q):
                with self.assertRaises(service.PortalError) as caught: service.trend_window(q)
                self.assertEqual(str(caught.exception), message)
        self.assertEqual(service.trend_window({'from': '2026-09-05', 'page': 'start'}), {'since': '2026-09-05', 'page': 'start'})
        self.assertEqual(service.trend_window({'page': '12345', 'tests': '3'}), {'tests': {3}, 'page': '12345'})
        with mock.patch.object(service, 'TREND_PAGE_BYTES', 1500):   # past the end (only after a change): an empty last part
            last = service.trend_page(self.db, self.admin, self.m, page='999999999999999')
        self.assertEqual((last['series'], last['tests'], last['next']), ([], {}, None))

    def test_unpaged_from_matches_the_whole_history_cut_by_date(self):
        whole = service.machine_trends(self.db, self.admin, self.m)
        cut = {k: [p for p in v if p['qa_date'] >= '2026-09-05'] for k, v in whole.items()}
        self.assertEqual(service.machine_trends(self.db, self.admin, self.m, **service.trend_window({'from': '2026-09-05'})), {k: v for k, v in cut.items() if v})
        cut = {k: [p for p in v if '2026-09-05' <= p['qa_date'] <= '2026-09-07'][-2:] for k, v in whole.items()}
        self.assertEqual(service.machine_trends(self.db, self.admin, self.m, **service.trend_window({'from': '2026-09-05', 'until': '2026-09-07', 'last': '2'})),
                         {k: v for k, v in cut.items() if v})

    def test_sizes_are_measured_as_the_browser_build_writes_numbers(self):
        # Expected text is what node 22's JSON.stringify writes for each value.
        for value, text in ((10.0, '10'), (0.1, '0.1'), (1e-07, '1e-7'), (1.5e-05, '0.000015'), (1e21, '1e+21'), (1.2345678901234567e20, '123456789012345670000'),
                            (-0.0, '0'), (158.5, '158.5'), (-2.5e-10, '-2.5e-10'), (123456789.125, '123456789.125')):
            self.assertEqual(service._js_number(value), text)
            self.assertEqual(service._js_json(value), text)
        for value, text in ((None, 'null'), (True, 'true'), (7, '7'), ('2026-09-05', '"2026-09-05"'), ('a"b\\c\n', '"a\\"b\\\\c\\n"'), ('Δ é', '"Δ é"')):
            self.assertEqual(service._js_json(value), text)
        point = {'source_test_id': 3, 'source_test_number': None, 'run_id': 12, 'source': 'sphinx', 'source_order': 345, 'assignment_id': 6, 'qa_date': '2026-09-05',
                 'value': 10.0, 'expected': 10.0, 'warn': 0.5, 'fail': 1.0, 'tol_mode': 'absolute', 'status': 'pass'}
        written = ('{"source_test_id":3,"source_test_number":null,"run_id":12,"source":"sphinx","source_order":345,"assignment_id":6,"qa_date":"2026-09-05",'
                   '"value":10,"expected":10,"warn":0.5,"fail":1,"tol_mode":"absolute","status":"pass"}')
        self.assertEqual(service._point_bytes(point), len(written))
        self.assertEqual(service._point_bytes({**point, 'status': 'Δ'}), len(written) - 4 + 2)


if __name__ == '__main__':
    unittest.main()
