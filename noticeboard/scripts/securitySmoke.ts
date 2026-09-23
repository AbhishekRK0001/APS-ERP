const BASE_URL =
  process.env.BASE_URL || "http://localhost:3000";

type Account = {
  name: string;
  identifier: string;
  password: string;
};

type SecurityTest = {
  name: string;
  cookie?: string;
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  expected: number;
};

const accounts = {
  student: {
    name: "Student",
    identifier: "student@college.edu",
    password: "Student123!",
  },

  teacher: {
    name: "Teacher",
    identifier: "teacher@college.edu",
    password: "Teacher123!",
  },

  hod: {
    name: "HOD",
    identifier: "hod@college.edu",
    password: "Hod123!",
  },

  principal: {
    name: "Principal",
    identifier: "principal@college.edu",
    password: "Principal123!",
  },
} satisfies Record<string, Account>;

async function login(
  account: Account
): Promise<string> {
  const response = await fetch(
    `${BASE_URL}/api/auth/login`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        identifier: account.identifier,
        password: account.password,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `${account.name} login failed with HTTP ${response.status}`
    );
  }

  const setCookie =
    response.headers.get("set-cookie");

  if (!setCookie) {
    throw new Error(
      `${account.name} login succeeded but no session cookie was returned.`
    );
  }

  return setCookie.split(";")[0];
}

async function runTest(
  test: SecurityTest
): Promise<boolean> {
  const headers: Record<string, string> = {};

  if (test.cookie) {
    headers.Cookie = test.cookie;
  }

  if (test.body !== undefined) {
    headers["Content-Type"] =
      "application/json";
  }

  const response = await fetch(
    `${BASE_URL}${test.path}`,
    {
      method: test.method || "GET",
      headers,

      body:
        test.body !== undefined
          ? JSON.stringify(test.body)
          : undefined,

      redirect: "manual",
    }
  );

  const passed =
    response.status === test.expected;

  console.log(
    `${passed ? "✅" : "❌"} ${test.name}`
  );

  console.log(
    `   expected ${test.expected}, received ${response.status}`
  );

  return passed;
}

async function main() {
  console.log(
    "\n===================================="
  );

  console.log(
    " COLLEGE PORTAL SECURITY SMOKE TEST"
  );

  console.log(
    "====================================\n"
  );

  console.log("Logging in test accounts...\n");

  const studentCookie =
    await login(accounts.student);

  const teacherCookie =
    await login(accounts.teacher);

  const hodCookie =
    await login(accounts.hod);

  const principalCookie =
    await login(accounts.principal);

  console.log("Login successful for all roles.\n");

  const tests: SecurityTest[] = [
    {
      name:
        "Anonymous user cannot read notifications",

      path:
        "/api/notifications",

      expected: 401,
    },

    {
      name:
        "Student cannot create notices",

      cookie:
        studentCookie,

      path:
        "/api/notices",

      method:
        "POST",

      body: {},

      expected: 403,
    },

    {
      name:
        "Student cannot approve notices",

      cookie:
        studentCookie,

      path:
        "/api/notices/000000000000000000000000/approval",

      method:
        "POST",

      body: {
        action: "APPROVE",
      },

      expected: 403,
    },

    {
      name:
        "Teacher cannot approve notices",

      cookie:
        teacherCookie,

      path:
        "/api/notices/000000000000000000000000/approval",

      method:
        "POST",

      body: {
        action: "APPROVE",
      },

      expected: 403,
    },

    {
      name:
        "Student cannot access academic-cycle preview",

      cookie:
        studentCookie,

      path:
        "/api/academic-cycle/preview",

      expected: 403,
    },

    {
      name:
        "Teacher cannot access academic-cycle preview",

      cookie:
        teacherCookie,

      path:
        "/api/academic-cycle/preview",

      expected: 403,
    },

    {
      name:
        "HOD cannot access academic-cycle preview",

      cookie:
        hodCookie,

      path:
        "/api/academic-cycle/preview",

      expected: 403,
    },

    {
      name:
        "Student cannot advance academic cycle",

      cookie:
        studentCookie,

      path:
        "/api/academic-cycle/advance",

      method:
        "POST",

      body: {
        cycleId: "security-test",
      },

      expected: 403,
    },

    {
      name:
        "Teacher cannot advance academic cycle",

      cookie:
        teacherCookie,

      path:
        "/api/academic-cycle/advance",

      method:
        "POST",

      body: {
        cycleId: "security-test",
      },

      expected: 403,
    },

    {
      name:
        "HOD cannot advance academic cycle",

      cookie:
        hodCookie,

      path:
        "/api/academic-cycle/advance",

      method:
        "POST",

      body: {
        cycleId: "security-test",
      },

      expected: 403,
    },

    {
      name:
        "Principal can access academic-cycle preview",

      cookie:
        principalCookie,

      path:
        "/api/academic-cycle/preview",

      expected: 200,
    },
  ];

  const results: boolean[] = [];

  for (const test of tests) {
    results.push(
      await runTest(test)
    );
  }

  const passed =
    results.filter(Boolean).length;

  const failed =
    results.length - passed;

  console.log(
    "\n===================================="
  );

  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  console.log(
    "====================================\n"
  );

  if (failed === 0) {
    console.log(
      "✅ SECURITY SMOKE TEST PASSED\n"
    );
  } else {
    console.log(
      "⚠️ SECURITY SMOKE TEST FAILED"
    );

    console.log(
      "Send me the failed rows before we continue.\n"
    );

    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    "\n❌ SECURITY TEST ERROR\n"
  );

  console.error(error);

  console.log(
    "\nMake sure npm run dev is running on http://localhost:3000\n"
  );

  process.exit(1);
});
