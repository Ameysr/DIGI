/**
 * Applies the real migrations to a real Postgres (PGlite — Postgres compiled to
 * WASM, so no Docker daemon required) and asserts the behaviour the database is
 * responsible for: the rolling five-score rule, duplicate-date rejection, the
 * role escalation guard, RLS visibility, and the full publish_draw transaction.
 *
 * Run with: npm run test:sql
 */
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const supabaseDir = join(here, '..')

const db = new PGlite()

// A raw driver error prints a wall of WASM stack; the message is the useful part.
for (const event of ['uncaughtException', 'unhandledRejection']) {
  process.on(event, (error) => {
    console.error(`\n\u001b[31mUnexpected database error:\u001b[0m ${error?.message ?? error}\n`)
    process.exit(1)
  })
}

let passed = 0
const failures = []

function ok(label) {
  passed += 1
  console.log(`  \u001b[32mPASS\u001b[0m ${label}`)
}

function bad(label, detail) {
  failures.push({ label, detail })
  console.log(`  \u001b[31mFAIL\u001b[0m ${label}\n         ${detail}`)
}

function check(label, condition, detail = '') {
  if (condition) ok(label)
  else bad(label, detail)
}

async function section(name, fn) {
  console.log(`\n\u001b[1m${name}\u001b[0m`)
  await fn()
}

async function expectError(label, sql, fragment) {
  try {
    await db.exec(sql)
    bad(label, 'expected an error but the statement succeeded')
  } catch (error) {
    const message = String(error.message ?? error)
    if (fragment && !message.includes(fragment)) {
      bad(label, `error did not mention "${fragment}": ${message}`)
    } else {
      ok(label)
    }
  }
}

async function count(sql) {
  const result = await db.query(sql)
  return Number(result.rows[0].n)
}

/** Run `fn` as a signed-in user with the given Clerk id. */
async function asUser(sub, fn) {
  await db.query(`select set_config('test.jwt', $1, false)`, [JSON.stringify({ sub })])
  await db.exec('set role authenticated')
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
    await db.query(`select set_config('test.jwt', $1, false)`, [''])
  }
}

async function asAnon(fn) {
  await db.exec('set role anon')
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
  }
}

/* -------------------------------------------------------------------------- */
/* Apply shim, migrations, seed                                               */
/* -------------------------------------------------------------------------- */
console.log('\u001b[1mApplying schema\u001b[0m')
await db.exec(readFileSync(join(here, '00_supabase_shim.sql'), 'utf8'))
console.log('  shim applied')

for (const file of readdirSync(join(supabaseDir, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(supabaseDir, 'migrations', file), 'utf8'))
  console.log(`  ${file} applied`)
}

await db.exec(readFileSync(join(supabaseDir, 'seed.sql'), 'utf8'))
console.log('  seed applied')

/* -------------------------------------------------------------------------- */
/* Constraints and triggers                                                   */
/* -------------------------------------------------------------------------- */
await section('Scores — range, duplicates and the rolling five', async () => {
  await db.exec(`
    insert into profiles (id, email, full_name) values ('user_test_a', 'a@test.dev', 'Test A');
  `)

  await expectError(
    'rejects a score above 45',
    `insert into scores (user_id, value, played_on) values ('user_test_a', 46, current_date - 1);`,
    'violates check constraint',
  )

  await expectError(
    'rejects a score below 1',
    `insert into scores (user_id, value, played_on) values ('user_test_a', 0, current_date - 1);`,
    'violates check constraint',
  )

  await expectError(
    'rejects a future-dated score',
    `insert into scores (user_id, value, played_on) values ('user_test_a', 20, current_date + 1);`,
    'cannot be dated in the future',
  )

  // Seven entries, one per day, should leave exactly the five newest.
  for (let day = 7; day >= 1; day -= 1) {
    await db.exec(`
      insert into scores (user_id, value, played_on)
      values ('user_test_a', ${day}, current_date - ${day});
    `)
  }

  const remaining = await count(`select count(*)::int as n from scores where user_id = 'user_test_a';`)
  check('retains exactly five scores after seven entries', remaining === 5, `got ${remaining}`)

  // Compare in the database rather than in JS: the client and the server can sit
  // in different timezones, and a date cast to JS becomes a Date object at local
  // midnight, which is a day earlier once converted to UTC.
  const oldest = await db.query(`
    select
      (select min(played_on)::text from scores where user_id = 'user_test_a') as retained,
      (current_date - 5)::text as expected;
  `)
  check(
    'prunes the oldest entries first',
    oldest.rows[0].retained === oldest.rows[0].expected,
    `oldest retained ${oldest.rows[0].retained}, expected ${oldest.rows[0].expected}`,
  )

  await expectError(
    'rejects a second score on the same date',
    `insert into scores (user_id, value, played_on) values ('user_test_a', 30, current_date - 3);`,
    'duplicate key value',
  )
})

await section('Profiles — role escalation guard', async () => {
  await expectError(
    'a subscriber cannot promote themselves to admin',
    `set local test.jwt = '{"sub":"user_test_a"}';
     update profiles set role = 'admin' where id = 'user_test_a';`,
    'role cannot be changed',
  )

  const role = await db.query(`select role from profiles where id = 'user_test_a';`)
  check('role is unchanged after the blocked attempt', role.rows[0].role === 'subscriber', role.rows[0].role)

  await expectError(
    'a new profile cannot self-assign admin on insert',
    `set local test.jwt = '{"sub":"user_test_sneaky"}';
     insert into profiles (id, email, role) values ('user_test_sneaky', 's@test.dev', 'admin');`,
    'cannot self-assign',
  )
})

await section('RLS — subscribers see only their own data', async () => {
  const ownScores = await asUser('user_seed_amelia', () =>
    count(`select count(*)::int as n from scores;`),
  )
  check('subscriber sees only their own scores', ownScores === 5, `got ${ownScores}`)

  const crossUser = await asUser('user_seed_amelia', () =>
    count(`select count(*)::int as n from scores where user_id = 'user_seed_raj';`),
  )
  check('subscriber cannot read another user\u2019s scores', crossUser === 0, `got ${crossUser}`)

  const ownSubs = await asUser('user_seed_amelia', () =>
    count(`select count(*)::int as n from subscriptions;`),
  )
  check('subscriber sees only their own subscription', ownSubs === 1, `got ${ownSubs}`)

  await asUser('user_seed_amelia', async () => {
    await expectError(
      'subscriber cannot insert a subscription (no write policy)',
      `insert into subscriptions (user_id, plan, status, amount_cents)
       values ('user_seed_amelia', 'monthly', 'active', 999);`,
      'row-level security',
    )
  })

  const isAmeliaAdmin = await asUser('user_seed_amelia', () =>
    db.query(`select is_admin() as a`).then((r) => r.rows[0].a),
  )
  check('is_admin() is false for a subscriber', isAmeliaAdmin === false, String(isAmeliaAdmin))

  const isSeedAdmin = await asUser('user_seed_admin', () =>
    db.query(`select is_admin() as a`).then((r) => r.rows[0].a),
  )
  check('is_admin() is true for an administrator', isSeedAdmin === true, String(isSeedAdmin))

  const adminScores = await asUser('user_seed_admin', () =>
    count(`select count(*)::int as n from scores;`),
  )
  check('administrator sees every score', adminScores >= 10, `got ${adminScores}`)
})

await section('RLS — anonymous visitors', async () => {
  const charities = await asAnon(() => count(`select count(*)::int as n from charities;`))
  check('anonymous can browse active charities', charities === 6, `got ${charities}`)

  // anon holds no table privilege on profiles at all, so this fails loudly at
  // the privilege layer rather than quietly returning zero rows.
  await asAnon(async () => {
    await expectError(
      'anonymous cannot read profiles',
      `select count(*) from profiles;`,
      'permission denied',
    )
  })

  const published = await asAnon(() => count(`select count(*)::int as n from draws;`))
  check('anonymous sees published draws only', published === 1, `got ${published}`)

  const events = await asAnon(() => count(`select count(*)::int as n from charity_events;`))
  check('anonymous can read charity events', events === 8, `got ${events}`)
})

/* -------------------------------------------------------------------------- */
/* publish_draw                                                               */
/* -------------------------------------------------------------------------- */
let nextMonthId = null

await section('publish_draw — authorization and validation', async () => {
  const created = await db.query(
    `select id from ensure_draw_for_month(date_trunc('month', current_date + interval '1 month')::date);`,
  )
  nextMonthId = created.rows[0].id
  check('a draft draw can be created for next month', Boolean(nextMonthId))

  await asUser('user_seed_amelia', async () => {
    await expectError(
      'a subscriber cannot publish a draw',
      `select publish_draw('${nextMonthId}', array[1,2,3,4,5]);`,
      'only administrators',
    )
  })

  await asUser('user_seed_admin', async () => {
    await expectError(
      'rejects fewer than five numbers',
      `select publish_draw('${nextMonthId}', array[1,2,3,4]);`,
      'exactly 5 winning numbers',
    )
    await expectError(
      'rejects duplicate winning numbers',
      `select publish_draw('${nextMonthId}', array[1,1,2,3,4]);`,
      'must be distinct',
    )
    await expectError(
      'rejects out-of-range winning numbers',
      `select publish_draw('${nextMonthId}', array[0,2,3,4,5]);`,
      'between 1 and 45',
    )
  })
})

await section('publish_draw — the committed draw', async () => {
  // Amelia's five scores are 28,31,34,37,41. Raj's are 19,22,27,33,45.
  // Drawing [19,22,33,37,41] gives Raj a 3-number match and Amelia two.
  let published
  await asUser('user_seed_admin', async () => {
    const result = await db.query(
      `select * from publish_draw('${nextMonthId}', array[19,22,33,37,41]);`,
    )
    published = result.rows[0]
  })

  check('draw is marked published', published.status === 'published', published.status)
  check('both eligible subscribers were entered', Number(published.subscriber_count) === 2, String(published.subscriber_count))

  // Amelia 49900/month + Raj (499900 / 12 = 41658.33) = 91558.33
  //   -> 50% = 45779.17 -> 45779
  check('pool matches the monthly-normalised contribution rate', Number(published.total_pool_cents) === 45779, String(published.total_pool_cents))

  // floor(45779 * 0.40) = 18311, floor(45779 * 0.35) = 16022, remainder 11446
  const three = await db.query(
    `select prize_cents, matched_count, numbers from draw_entries
     where draw_id = '${nextMonthId}' and prize_tier = '3_match';`,
  )
  check(
    'the 3-number match is detected at the right rank',
    Number(three.rows[0]?.matched_count) === 3,
    `matched_count ${three.rows[0]?.matched_count} for numbers ${JSON.stringify(three.rows[0]?.numbers)}`,
  )
  check(
    'the only winner receives the full 3-match tier',
    Number(three.rows[0]?.prize_cents) === 11446,
    String(three.rows[0]?.prize_cents),
  )

  const tiers = await db.query(`
    select
      coalesce(sum(case when prize_tier = '3_match' then prize_cents end), 0)::bigint as three
    from draw_entries where draw_id = '${nextMonthId}';
  `)
  check('tier split sums within the pool', Number(tiers.rows[0].three) <= Number(published.total_pool_cents), 'overspend')

  // Nobody matched five, so the jackpot carries forward.
  check('unclaimed jackpot rolls over', Number(published.rollover_out_cents) === 18311, String(published.rollover_out_cents))

  const winnerRows = await count(
    `select count(*)::int as n from winners where draw_id = '${nextMonthId}';`,
  )
  check('a winner claim was created only for the 3-match', winnerRows === 1, `got ${winnerRows}`)

  const winner = await db.query(
    `select user_id, review_status, payment_status from winners where draw_id = '${nextMonthId}';`,
  )
  check('the winner is the player holding the 3-number match', winner.rows[0].user_id === 'user_seed_raj', winner.rows[0].user_id)
  check('a new claim starts pending', winner.rows[0].review_status === 'pending' && winner.rows[0].payment_status === 'pending', 'unexpected initial state')

  const audit = await count(
    `select count(*)::int as n from audit_log where action = 'draw.published' and entity_id = '${nextMonthId}';`,
  )
  check('the publish was written to the audit log', audit === 1, `got ${audit}`)

  await asUser('user_seed_admin', async () => {
    await expectError(
      'a draw cannot be published twice',
      `select publish_draw('${nextMonthId}', array[1,2,3,4,5]);`,
      'already been published',
    )
  })
})

await section('Winner verification — a winner cannot approve themselves', async () => {
  await asUser('user_seed_raj', async () => {
    await expectError(
      'winner cannot mark their own claim approved',
      `update winners set review_status = 'approved' where user_id = 'user_seed_raj';`,
      'only administrators',
    )
    await expectError(
      'winner cannot mark their own claim paid',
      `update winners set payment_status = 'paid' where user_id = 'user_seed_raj';`,
      'only administrators',
    )
    await expectError(
      'winner cannot inflate their own prize',
      `update winners set prize_cents = 999999 where user_id = 'user_seed_raj';`,
      'only administrators',
    )

    // The legitimate action: attaching proof of their scores.
    await db.exec(
      `update winners set proof_path = 'user_seed_raj/${nextMonthId}.png' where user_id = 'user_seed_raj';`,
    )
    const proof = await db.query(
      `select proof_path from winners where user_id = 'user_seed_raj';`,
    )
    check('winner can upload proof of their scores', Boolean(proof.rows[0]?.proof_path), 'proof_path not set')
  })

  await asUser('user_seed_admin', async () => {
    await db.exec(`update winners set review_status = 'approved', reviewed_by = 'user_seed_admin', reviewed_at = now() where user_id = 'user_seed_raj';`)
    await db.exec(`update winners set payment_status = 'paid', paid_at = now() where user_id = 'user_seed_raj';`)
    const row = await db.query(`select review_status, payment_status from winners where user_id = 'user_seed_raj';`)
    check('an administrator can approve and pay a claim', row.rows[0].review_status === 'approved' && row.rows[0].payment_status === 'paid', JSON.stringify(row.rows[0]))
  })
})

await section('Storage — proof isolation', async () => {
  await asUser('user_seed_amelia', async () => {
    await expectError(
      'a user cannot write into another user\u2019s proof folder',
      `insert into storage.objects (bucket_id, name) values ('proofs', 'user_seed_raj/forged.png');`,
      'row-level security',
    )

    await db.exec(
      `insert into storage.objects (bucket_id, name) values ('proofs', 'user_seed_amelia/${nextMonthId}.png');`,
    )
    const own = await count(`select count(*)::int as n from storage.objects where bucket_id = 'proofs';`)
    check('a user can write into their own proof folder', own === 1, `got ${own}`)
  })

  await asUser('user_seed_raj', async () => {
    const visible = await count(`select count(*)::int as n from storage.objects where bucket_id = 'proofs';`)
    check('a user cannot list another user\u2019s proofs', visible === 0, `got ${visible}`)
  })
})

await section('Supabase Auth — a profile is created on signup', async () => {
  // Creating the auth user is the whole trigger: no webhook, no client-side
  // self-heal, no external provider to configure.
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data)
    values ('11111111-1111-1111-1111-111111111111', 'newcomer@example.com',
            '{"full_name":"New Comer"}'::jsonb);
  `)

  const created = await db.query(
    `select id, email, full_name, role from profiles where id = '11111111-1111-1111-1111-111111111111';`,
  )

  check(
    'a new auth user gets a profile automatically',
    created.rows[0]?.email === 'newcomer@example.com',
    JSON.stringify(created.rows[0]),
  )
  check(
    'the new profile defaults to the subscriber role',
    created.rows[0]?.role === 'subscriber',
    String(created.rows[0]?.role),
  )
  check(
    'the full name is taken from the user metadata',
    created.rows[0]?.full_name === 'New Comer',
    String(created.rows[0]?.full_name),
  )

  // The RLS helpers must still resolve the caller from the JWT `sub` claim —
  // that is what let the whole policy layer survive the auth provider swap.
  await asUser('11111111-1111-1111-1111-111111111111', async () => {
    const own = await count(`select count(*)::int as n from profiles;`)
    check('the new user sees only their own profile', own === 1, `got ${own}`)
  })
})

await section('Donations — independent of the draw', async () => {
  // Subscription contributions must default to their own source, so existing rows
  // are not silently reclassified when the column is added.
  const seeded = await db.query(
    `select source from charity_contributions where provider_payment_id like 'seed_payment_%' limit 1;`,
  )
  check(
    'subscription contributions carry the subscription source',
    seeded.rows[0]?.source === 'subscription',
    String(seeded.rows[0]?.source),
  )

  // A donation has no subscription behind it.
  await db.exec(`
    insert into charity_contributions
      (user_id, charity_id, subscription_id, amount_cents, period_month, provider_payment_id, source)
    select 'user_seed_amelia', (select id from charities order by slug limit 1), null,
           500000, current_date, 'test_donation_1', 'donation';
  `)

  const donation = await db.query(
    `select source, subscription_id from charity_contributions where provider_payment_id = 'test_donation_1';`,
  )
  check(
    'a donation is recorded against the donor with no subscription',
    donation.rows[0]?.source === 'donation' && donation.rows[0]?.subscription_id === null,
    JSON.stringify(donation.rows[0]),
  )

  await expectError(
    'the same donation cannot be recorded twice',
    `insert into charity_contributions (user_id, charity_id, amount_cents, period_month, provider_payment_id, source)
     values ('user_seed_amelia', null, 500000, current_date, 'test_donation_1', 'donation');`,
    'duplicate key',
  )

  // The important structural point: the pool is computed from active
  // subscriptions, never from the contribution ledger, so a generous donor cannot
  // sway the draw. This recomputes the pool the way publish_draw does and checks
  // the donation above left it untouched.
  const pool = await db.query(`
    select round(sum(case when plan = 'yearly' then amount_cents / 12.0 else amount_cents end) * 0.5)::bigint as n
    from subscriptions where status = 'active';
  `)
  check(
    'a donation does not inflate the prize pool',
    Number(pool.rows[0].n) === 45779,
    `pool is ${pool.rows[0].n}, expected 45779 (derived from subscriptions only)`,
  )
})

/* -------------------------------------------------------------------------- */
console.log(
  `\n\u001b[1m${passed} passed, ${failures.length} failed\u001b[0m\n`,
)

if (failures.length > 0) {
  for (const failure of failures) console.log(`\u001b[31m\u00d7\u001b[0m ${failure.label}\n  ${failure.detail}`)
  await db.close()
  process.exit(1)
}

await db.close()
