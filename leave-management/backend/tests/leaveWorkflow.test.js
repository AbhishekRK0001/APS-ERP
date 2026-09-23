const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const query = value => ({ session: async () => value });

function fixture() {
  const defaultModel = () => ({
    exists: () => query(false),
    findOne: () => query(null),
    find: () => query([]),
    findById: () => query(null),
    create: async docs => docs.map((d, i) => ({ ...d, _id: `id_${i}` })),
    updateOne: async () => ({ matchedCount: 1, modifiedCount: 1 }),
    findOneAndUpdate: async () => null,
  });
  const targets = Object.fromEntries(
    ['Leave', 'SubstituteRequest', 'Timetable', 'LeaveBalance', 'User'].map(n => [n, defaultModel()])
  );
  targets.User.updateOne = async () => ({ matchedCount: 1, modifiedCount: 1 });
  const models = new Proxy(targets, {
    set(target, name, value) {
      Object.assign(target[name], value);
      return true;
    },
  });
  const mongoose = {
    startSession: async () => ({
      withTransaction: async fn => fn(),
      endSession: async () => {},
    }),
  };
  const original = Module._load;
  Module._load = function (name, parent, main) {
    if (name === 'mongoose') return mongoose;
    if (name.startsWith('../models/')) return targets[name.slice(10)];
    return original.apply(this, arguments);
  };
  let W;
  try {
    delete require.cache[require.resolve('../services/leaveWorkflow')];
    W = require('../services/leaveWorkflow');
  } finally {
    Module._load = original;
  }
  return { W, models };
}

const makeLeave = (id = 'leave1', status = 'coverage_pending', requests = ['r1']) => ({
  _id: id,
  teacher: 'teacher_absent',
  status,
  startDate: new Date('2026-09-21T00:00:00.000Z'),
  endDate: new Date('2026-09-22T00:00:00.000Z'),
  leaveType: 'casual',
  substituteRequests: requests,
  reason: '',
});

const makeRequest = (id, leaveId = 'leave1', periodNumber = 1, status = 'open', sub = null) => ({
  _id: id,
  leave: leaveId,
  absentTeacher: 'teacher_absent',
  date: new Date('2026-09-21T00:00:00.000Z'),
  dayOfWeek: 'Monday',
  periodNumber,
  subject: 'Physics',
  className: '10A',
  startTime: '09:00',
  endTime: '09:45',
  status,
  substituteTeacher: sub,
  declinedBy: [],
});

test('TEST 1: One-day leave, one period - one substitute accepts -> application unlocks', async () => {
  const { W, models } = fixture();
  const l = makeLeave('leave1', 'coverage_pending', ['r1']);
  l.endDate = l.startDate;
  const r1 = makeRequest('r1', 'leave1', 1, 'open');

  models.SubstituteRequest = {
    findById: () => query(r1),
    findOneAndUpdate: async (filter, update) => {
      if (r1.status !== 'open') return null;
      r1.status = update.$set.status;
      r1.substituteTeacher = update.$set.substituteTeacher;
      return r1;
    },
    find: () => query([r1]),
    exists: () => query(false),
  };
  models.Leave = {
    findById: () => query(l),
    exists: () => query(false),
    updateOne: async (filter, update) => {
      if (filter.status === 'coverage_pending') {
        l.status = update.$set.status;
        return { modifiedCount: 1 };
      }
      return { modifiedCount: 0 };
    },
  };
  models.User = { findById: () => query({ role: 'teacher' }) };
  models.Timetable = {
    findOne: () => query({
      days: [{ dayOfWeek: 'Monday', periods: [{ className: '10A', periodNumber: 3 }] }],
    }),
  };

  const res = await W.accept('r1', 'teacher_mohan');
  assert.equal(res.request.status, 'accepted');
  assert.equal(res.coverage.complete, true);
  assert.equal(l.status, 'substitute_confirmed');
});

test('TEST 2: Two-day leave with four total periods - only 1/4 accepted -> application stays locked', async () => {
  const { W, models } = fixture();
  const l = makeLeave('leave2', 'coverage_pending', ['r1', 'r2', 'r3', 'r4']);
  const reqs = [
    makeRequest('r1', 'leave2', 1, 'accepted', 'teacher_mohan'),
    makeRequest('r2', 'leave2', 3, 'open'),
    makeRequest('r3', 'leave2', 2, 'open'),
    makeRequest('r4', 'leave2', 4, 'open'),
  ];
  models.SubstituteRequest = { find: () => query(reqs) };

  const cov = await W.coverage(l, null);
  assert.equal(cov.required, 4);
  assert.equal(cov.accepted, 1);
  assert.equal(cov.complete, false);
  assert.equal(l.status, 'coverage_pending');
});

test('TEST 3: 2/4 accepted -> application stays locked', async () => {
  const { W, models } = fixture();
  const l = makeLeave('leave3', 'coverage_pending', ['r1', 'r2', 'r3', 'r4']);
  const reqs = [
    makeRequest('r1', 'leave3', 1, 'accepted', 'teacher_mohan'),
    makeRequest('r2', 'leave3', 3, 'accepted', 'teacher_priya'),
    makeRequest('r3', 'leave3', 2, 'open'),
    makeRequest('r4', 'leave3', 4, 'open'),
  ];
  models.SubstituteRequest = { find: () => query(reqs) };

  const cov = await W.coverage(l, null);
  assert.equal(cov.required, 4);
  assert.equal(cov.accepted, 2);
  assert.equal(cov.complete, false);
  assert.equal(l.status, 'coverage_pending');
});

test('TEST 4: 4/4 accepted -> exactly ONE leave application becomes ready', async () => {
  const { W, models } = fixture();
  const l = makeLeave('leave4', 'coverage_pending', ['r1', 'r2', 'r3', 'r4']);
  const r4 = makeRequest('r4', 'leave4', 4, 'open');
  const reqs = [
    makeRequest('r1', 'leave4', 1, 'accepted', 'teacher_mohan'),
    makeRequest('r2', 'leave4', 3, 'accepted', 'teacher_priya'),
    makeRequest('r3', 'leave4', 2, 'accepted', 'teacher_mohan'),
    r4,
  ];

  models.SubstituteRequest = {
    findById: () => query(r4),
    findOneAndUpdate: async (filter, update) => {
      r4.status = update.$set.status;
      r4.substituteTeacher = update.$set.substituteTeacher;
      return r4;
    },
    find: () => query(reqs),
    exists: () => query(false),
  };
  models.Leave = {
    findById: () => query(l),
    exists: () => query(false),
    updateOne: async (filter, update) => {
      l.status = update.$set.status;
      return { modifiedCount: 1 };
    },
  };
  models.User = { findById: () => query({ role: 'teacher' }) };
  models.Timetable = {
    findOne: () => query({
      days: [{ dayOfWeek: 'Monday', periods: [{ className: '10A', periodNumber: 1 }] }],
    }),
  };

  const res = await W.accept('r4', 'teacher_priya');
  assert.equal(res.coverage.accepted, 4);
  assert.equal(res.coverage.complete, true);
  assert.equal(l.status, 'substitute_confirmed');
});

test('TEST 5: Mohan accepts -> Priya attempts afterward -> Priya receives conflict error', async () => {
  const { W, models } = fixture();
  const l = makeLeave('leave5', 'coverage_pending', ['r1']);
  const r1 = makeRequest('r1', 'leave5', 1, 'open');

  models.SubstituteRequest = {
    findById: () => query(r1),
    findOneAndUpdate: async (filter, update) => {
      if (r1.status !== 'open') return null;
      r1.status = 'accepted';
      r1.substituteTeacher = 'teacher_mohan';
      return r1;
    },
    find: () => query([r1]),
    exists: () => query(false),
  };
  models.Leave = {
    findById: () => query(l),
    exists: () => query(false),
    updateOne: async () => ({ modifiedCount: 1 }),
  };
  models.User = { findById: () => query({ role: 'teacher' }) };
  models.Timetable = {
    findOne: () => query({
      days: [{ dayOfWeek: 'Monday', periods: [{ className: '10A', periodNumber: 2 }] }],
    }),
  };

  // Mohan accepts first
  const mohanRes = await W.accept('r1', 'teacher_mohan');
  assert.equal(mohanRes.request.status, 'accepted');

  // Priya attempts to accept the same request afterward
  await assert.rejects(
    W.accept('r1', 'teacher_priya'),
    /is no longer open/
  );
});

test('TEST 6: Two teachers attempt acceptance nearly simultaneously -> only one succeeds', async () => {
  const { W, models } = fixture();
  const l = makeLeave('leave6', 'coverage_pending', ['r1']);
  const r1 = makeRequest('r1', 'leave6', 1, 'open');

  let claimedCount = 0;
  models.SubstituteRequest = {
    findById: () => query(r1),
    findOneAndUpdate: async (filter, update) => {
      if (claimedCount > 0) return null; // already claimed atomically
      claimedCount++;
      r1.status = 'accepted';
      r1.substituteTeacher = update.$set.substituteTeacher;
      return r1;
    },
    find: () => query([r1]),
    exists: () => query(false),
  };
  models.Leave = {
    findById: () => query(l),
    exists: () => query(false),
    updateOne: async () => ({ modifiedCount: 1 }),
  };
  models.User = { findById: () => query({ role: 'teacher' }) };
  models.Timetable = {
    findOne: () => query({
      days: [{ dayOfWeek: 'Monday', periods: [{ className: '10A', periodNumber: 2 }] }],
    }),
  };

  const results = await Promise.allSettled([
    W.accept('r1', 'teacher_mohan'),
    W.accept('r1', 'teacher_priya'),
  ]);

  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
});

test('TEST 7: Mohan declines -> request remains open for others -> Mohan cannot accept', async () => {
  const { W, models } = fixture();
  const r1 = makeRequest('r1', 'leave7', 1, 'open');
  r1.declinedBy.push('teacher_mohan');

  models.SubstituteRequest = {
    findById: () => query(r1),
    exists: () => query(false),
  };
  models.User = { findById: () => query({ role: 'teacher' }) };
  models.Timetable = {
    findOne: () => query({
      days: [{ dayOfWeek: 'Monday', periods: [{ className: '10A', periodNumber: 2 }] }],
    }),
  };
  models.Leave = { exists: () => query(false) };

  // Mohan is not eligible because he declined
  const mohanEligible = await W.eligible('teacher_mohan', r1, null);
  assert.equal(mohanEligible, false);

  // Priya is eligible
  const priyaEligible = await W.eligible('teacher_priya', r1, null);
  assert.equal(priyaEligible, true);
});

test('TEST 8: Substitute already covering another class at same date/period cannot accept', async () => {
  const { W, models } = fixture();
  const r1 = makeRequest('r1', 'leave8', 1, 'open');

  models.User = { findById: () => query({ role: 'teacher' }) };
  models.Timetable = {
    findOne: () => query({
      days: [{ dayOfWeek: 'Monday', periods: [{ className: '10A', periodNumber: 3 }] }],
    }),
  };
  // Substitute already has another accepted substitute request at that date/period
  models.SubstituteRequest = {
    exists: () => query(true),
  };
  models.Leave = { exists: () => query(false) };

  const eligible = await W.eligible('teacher_priya', r1, null);
  assert.equal(eligible, false);
});

test('TEST 9: Teacher tries calling leave details API before all periods accepted -> backend rejects', async () => {
  const { W, models } = fixture();
  const l = makeLeave('leave9', 'coverage_pending', ['r1', 'r2']);
  const reqs = [makeRequest('r1', 'leave9', 1, 'accepted', 'teacher_mohan'), makeRequest('r2', 'leave9', 2, 'open')];

  models.Leave = { findOne: () => query(l) };
  models.SubstituteRequest = { find: () => query(reqs) };

  await assert.rejects(
    W.submit('leave9', 'teacher_absent', { reason: 'Personal family event' }),
    /All coverage must be confirmed/
  );
});

test('TEST 10: HOD attempts approval before complete coverage/teacher submission -> backend rejects', async () => {
  const { W, models } = fixture();
  const l = makeLeave('leave10', 'substitute_confirmed', ['r1']);

  models.Leave = { findById: () => query(l) };
  models.SubstituteRequest = { find: () => query([makeRequest('r1', 'leave10', 1, 'accepted', 'teacher_mohan')]) };

  await assert.rejects(
    W.approve('leave10', 'hod'),
    /approval stage/
  );
});

test('TEST 11: Principal attempts approval before HOD -> backend rejects', async () => {
  const { W, models } = fixture();
  const l = makeLeave('leave11', 'submitted', ['r1']);
  l.reason = 'Medical treatment';

  models.Leave = { findById: () => query(l) };
  models.SubstituteRequest = { find: () => query([makeRequest('r1', 'leave11', 1, 'accepted', 'teacher_mohan')]) };

  await assert.rejects(
    W.approve('leave11', 'principal'),
    /approval stage/
  );
});

test('TEST 12: Principal approves normally -> balance deducted once', async () => {
  const { W, models } = fixture();
  const l = makeLeave('leave12', 'hod_approved', ['r1']);
  l.startDate = new Date('2026-09-21T00:00:00.000Z');
  l.endDate = new Date('2026-09-21T00:00:00.000Z');
  l.reason = 'Conference attendance';

  let used = 1;
  let deductCount = 0;
  models.Leave = {
    findById: () => query(l),
    findOneAndUpdate: async () => {
      l.status = 'principal_approved';
      l.balancePostedAt = new Date();
      return l;
    },
  };
  models.SubstituteRequest = {
    find: () => query([makeRequest('r1', 'leave12', 1, 'accepted', 'teacher_mohan')]),
  };
  models.LeaveBalance = {
    findOneAndUpdate: async () => ({
      _id: 'bal12',
      firstHalfTotal: 7,
      firstHalfUsed: 0,
      secondHalfTotal: 8,
      secondHalfUsed: used,
    }),
    updateOne: async (filter, update) => {
      used += update.$inc.secondHalfUsed || 0;
      deductCount++;
      return { modifiedCount: 1 };
    },
  };
  models.User = {
    updateOne: async () => ({ matchedCount: 1 }),
  };

  const res = await W.approve('leave12', 'principal');
  assert.equal(res.status, 'principal_approved');
  assert.equal(deductCount, 1);
  assert.equal(used, 2);
});

test('TEST 13: Principal approval endpoint called again -> balance NOT deducted again', async () => {
  const { W, models } = fixture();
  const l = makeLeave('leave13', 'principal_approved', ['r1']);
  l.balancePostedAt = new Date();
  l.reason = 'Fever';

  models.Leave = { findById: () => query(l) };

  await assert.rejects(
    W.approve('leave13', 'principal'),
    /approval stage/
  );
});

test('TEST 14: Attempt to reject principal_approved leave -> backend rejects invalid transition', async () => {
  const { W, models } = fixture();
  const l = makeLeave('leave14', 'principal_approved', ['r1']);

  models.Leave = { findById: () => query(l) };

  await assert.rejects(
    W.reject('leave14', { _id: 'admin_principal', role: 'principal' }, 'Cannot cancel anymore'),
    /review stage/
  );
});

test('TEST 15: Multi-day request produces ONE Leave and multiple linked SubstituteRequests', async () => {
  const { W, models } = fixture();
  let createdLeave = null;
  let createdRequests = [];

  models.Leave = {
    findOne: () => query(null),
    create: async (docs) => {
      createdLeave = { ...docs[0], _id: 'new_multi_leave', substituteRequests: [] };
      createdLeave.save = async () => createdLeave;
      return [createdLeave];
    },
  };
  models.SubstituteRequest = {
    create: async (docs) => {
      createdRequests = docs.map((d, i) => ({ ...d, _id: `subreq_${i}` }));
      return createdRequests;
    },
  };
  models.Timetable = {
    findOne: () => query({
      days: [
        {
          dayOfWeek: 'Monday',
          periods: [
            { periodNumber: 1, subject: 'Physics', className: '10A', startTime: '09:00', endTime: '09:45' },
            { periodNumber: 3, subject: 'Physics', className: '11B', startTime: '11:00', endTime: '11:45' },
          ],
        },
        {
          dayOfWeek: 'Tuesday',
          periods: [
            { periodNumber: 2, subject: 'Physics', className: '10A', startTime: '09:50', endTime: '10:35' },
            { periodNumber: 4, subject: 'Physics', className: '10B', startTime: '11:50', endTime: '12:35' },
          ],
        },
      ],
    }),
  };

  const res = await W.createCoverage('teacher_ravi', {
    startDate: '2026-09-21', // Monday
    endDate: '2026-09-22',   // Tuesday
    leaveType: 'casual',
  });

  assert.equal(res.createdCount, 4);
  assert.equal(res.leave._id, 'new_multi_leave');
  assert.equal(res.requests.length, 4);
  assert.equal(createdLeave.substituteRequests.length, 4);
});

test('TEST 16: Date range with a day having no classes creates no coverage requests for that day', async () => {
  const { W, models } = fixture();
  let createdRequests = [];

  models.Leave = {
    findOne: () => query(null),
    create: async (docs) => {
      const doc = { ...docs[0], _id: 'leave_with_gap', substituteRequests: [] };
      doc.save = async () => doc;
      return [doc];
    },
  };
  models.SubstituteRequest = {
    create: async (docs) => {
      createdRequests = docs.map((d, i) => ({ ...d, _id: `subreq_${i}` }));
      return createdRequests;
    },
  };
  // Monday has 2 periods; Tuesday has NO periods in timetable
  models.Timetable = {
    findOne: () => query({
      days: [
        {
          dayOfWeek: 'Monday',
          periods: [
            { periodNumber: 1, subject: 'Physics', className: '10A', startTime: '09:00', endTime: '09:45' },
            { periodNumber: 3, subject: 'Physics', className: '11B', startTime: '11:00', endTime: '11:45' },
          ],
        },
        {
          dayOfWeek: 'Tuesday',
          periods: [], // No classes on Tuesday
        },
      ],
    }),
  };

  const res = await W.createCoverage('teacher_ravi', {
    startDate: '2026-09-21', // Monday
    endDate: '2026-09-22',   // Tuesday
    leaveType: 'casual',
  });

  // Only Monday's 2 periods get coverage requests created
  assert.equal(res.createdCount, 2);
  assert.equal(res.requests.length, 2);
  assert.ok(res.requests.every(r => r.dayOfWeek === 'Monday'));
});

test('TEST 17: Unauthorized user attempts to update someone else\'s leave -> backend rejects', async () => {
  const { W, models } = fixture();
  // Leave belongs to 'teacher_absent', not 'teacher_intruder'
  models.Leave = {
    findOne: (filter) => {
      if (filter.teacher === 'teacher_intruder') return query(null);
      return query(makeLeave('leave17', 'substitute_confirmed'));
    },
  };

  await assert.rejects(
    W.submit('leave17', 'teacher_intruder', { reason: 'Unauthorized edit attempt' }),
    /Leave not found/
  );
});
