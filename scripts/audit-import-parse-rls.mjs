#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

loadDotenvLocal();

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length) {
  console.error(`Missing required env vars: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const anon = createClient(supabaseUrl, publishableKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const runId = randomUUID();
const parserVersion = `rls-audit-${runId}`;
const ownerEmail = `wayline-rls-owner-a-${runId}@example.com`;
const secondOwnerEmail = `wayline-rls-owner-b-${runId}@example.com`;
const attackerEmail = `wayline-rls-attacker-${runId}@example.com`;
const password = `Wayline-${runId}!`;
const createdUserIds = [];
const insertedEventIds = [];
const insertedReviewIds = [];

const targets = [
  {
    name: "public.import_parse_events",
    filterColumn: "parser_version",
    filterValue: parserVersion,
    select: "id,user_id,parser_version",
    table: "import_parse_events"
  },
  {
    name: "public.import_parse_kpis_24h",
    filterColumn: "parser_version",
    filterValue: parserVersion,
    select: "*",
    table: "import_parse_kpis_24h"
  },
  {
    name: "public.import_parse_accuracy_7d",
    filterColumn: "parser_version",
    filterValue: parserVersion,
    select: "*",
    table: "import_parse_accuracy_7d"
  },
  {
    name: "public.import_parse_recent_events",
    filterColumn: "parser_version",
    filterValue: parserVersion,
    select: "*",
    table: "import_parse_recent_events"
  },
  {
    name: "public.import_parse_anomaly_reviews",
    filterColumn: "anomaly_fingerprint",
    filterValue: `rls-audit-${runId}`,
    select: "id,user_id,anomaly_fingerprint,status",
    table: "import_parse_anomaly_reviews"
  }
];

try {
  const owner = await createConfirmedUser(ownerEmail, password);
  const secondOwner = await createConfirmedUser(secondOwnerEmail, password);
  const attacker = await createConfirmedUser(attackerEmail, password);
  createdUserIds.push(owner.id, secondOwner.id, attacker.id);

  const ownerClient = await createSignedInClient(ownerEmail, password);
  const secondOwnerClient = await createSignedInClient(secondOwnerEmail, password);
  const attackerClient = await createSignedInClient(attackerEmail, password);

  insertedEventIds.push(
    await insertAuditEvent(owner.id, "flight", 0.987),
    await insertAuditEvent(secondOwner.id, "hotel", 0.876)
  );
  insertedReviewIds.push(
    await insertAuditReview(owner.id),
    await insertAuditReview(secondOwner.id)
  );

  const failures = [];
  const rows = [];

  for (const target of targets) {
    const anonTagged = await queryTaggedTarget(anon, target);
    const attackerTagged = await queryTaggedTarget(attackerClient, target);
    const ownerTagged = await queryTaggedTarget(ownerClient, target);
    const secondOwnerTagged = await queryTaggedTarget(secondOwnerClient, target);
    const anonGlobal = await queryAllTarget(anon, target);
    const attackerGlobal = await queryAllTarget(attackerClient, target);

    rows.push({
      target: target.name,
      anonTagged: formatResult(anonTagged),
      attackerTagged: formatResult(attackerTagged),
      ownerTagged: formatResult(ownerTagged),
      secondOwnerTagged: formatResult(secondOwnerTagged),
      anonGlobal: formatResult(anonGlobal),
      attackerGlobal: formatResult(attackerGlobal)
    });

    if (hasVisibleRows(anonTagged)) {
      failures.push(`${target.name}: anon context can see ${anonTagged.count} tagged row(s).`);
    }

    if (hasVisibleRows(anonGlobal)) {
      failures.push(`${target.name}: anon context can see ${anonGlobal.count} row(s) globally.`);
    }

    if (attackerTagged.error) {
      failures.push(`${target.name}: attacker tagged query failed: ${attackerTagged.error}`);
    } else if (attackerTagged.count !== 0) {
      failures.push(
        `${target.name}: attacker can see ${attackerTagged.count} tagged row(s).`
      );
    }

    if (attackerGlobal.error) {
      failures.push(`${target.name}: attacker global query failed: ${attackerGlobal.error}`);
    } else if (attackerGlobal.count !== 0) {
      failures.push(
        `${target.name}: attacker can see ${attackerGlobal.count} row(s) across existing data.`
      );
    }

    if (ownerTagged.error) {
      failures.push(`${target.name}: owner query failed: ${ownerTagged.error}`);
    } else if (ownerTagged.count !== 1) {
      failures.push(`${target.name}: owner saw ${ownerTagged.count} tagged row(s), expected 1.`);
    }

    if (secondOwnerTagged.error) {
      failures.push(`${target.name}: second owner query failed: ${secondOwnerTagged.error}`);
    } else if (secondOwnerTagged.count !== 1) {
      failures.push(
        `${target.name}: second owner saw ${secondOwnerTagged.count} tagged row(s), expected 1.`
      );
    }
  }

  console.table(rows);

  if (failures.length) {
    console.error("Import parse RLS audit failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Import parse RLS audit passed.");
  }
} finally {
  if (insertedReviewIds.length) {
    await admin.from("import_parse_anomaly_reviews").delete().in("id", insertedReviewIds);
  }

  if (insertedEventIds.length) {
    await admin.from("import_parse_events").delete().in("id", insertedEventIds);
  }

  await Promise.all(
    createdUserIds.map((userId) =>
      admin.auth.admin.deleteUser(userId).catch((error) => {
        console.warn(`Could not delete audit user ${userId}: ${error.message}`);
      })
    )
  );
}

async function insertAuditEvent(userId, segmentType, confidence) {
  const inserted = await admin
    .from("import_parse_events")
    .insert({
      confidence,
      event_type: "prediction",
      final_segment_type: segmentType,
      input_excerpt: `rls audit ${runId}`,
      parser_name: "wayline_rls_audit",
      parser_version: parserVersion,
      predicted_segment_type: segmentType,
      source_label: "RLS audit fixture",
      source_type: "rls_audit",
      user_id: userId
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data?.id) {
    throw new Error(`Could not insert audit fixture: ${inserted.error?.message || "missing id"}`);
  }

  return inserted.data.id;
}

async function insertAuditReview(userId) {
  const inserted = await admin
    .from("import_parse_anomaly_reviews")
    .insert({
      anomaly_fingerprint: `rls-audit-${runId}`,
      anomaly_label: "RLS audit anomaly",
      detected_at: new Date().toISOString(),
      status: "pending",
      user_id: userId
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data?.id) {
    throw new Error(
      `Could not insert audit review fixture: ${inserted.error?.message || "missing id"}`
    );
  }

  return inserted.data.id;
}


async function createConfirmedUser(email, password) {
  const result = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password
  });

  if (result.error || !result.data.user) {
    throw new Error(`Could not create ${email}: ${result.error?.message || "missing user"}`);
  }

  return result.data.user;
}

async function createSignedInClient(email, password) {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const result = await client.auth.signInWithPassword({ email, password });

  if (result.error || !result.data.session) {
    throw new Error(`Could not sign in ${email}: ${result.error?.message || "missing session"}`);
  }

  return client;
}

async function queryTaggedTarget(client, target) {
  const result = await client
    .from(target.table)
    .select(target.select)
    .eq(target.filterColumn, target.filterValue);

  if (result.error) {
    return {
      count: 0,
      denied: isPermissionDenied(result.error.message),
      error: result.error.message
    };
  }

  return {
    count: Array.isArray(result.data) ? result.data.length : 0,
    denied: false,
    error: null
  };
}

async function queryAllTarget(client, target) {
  const result = await client.from(target.table).select(target.select);

  if (result.error) {
    return {
      count: 0,
      denied: isPermissionDenied(result.error.message),
      error: result.error.message
    };
  }

  return {
    count: Array.isArray(result.data) ? result.data.length : 0,
    denied: false,
    error: null
  };
}

function hasVisibleRows(result) {
  return !result.error && result.count > 0;
}

function formatResult(result) {
  if (result.denied) {
    return "denied";
  }

  if (result.error) {
    return `error: ${result.error}`;
  }

  return `${result.count} row(s)`;
}

function isPermissionDenied(message) {
  return /permission denied|insufficient privilege|42501/i.test(message);
}

function loadDotenvLocal() {
  const envPath = ".env.local";

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();

    if (!key || process.env[key] != null) {
      continue;
    }

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}
