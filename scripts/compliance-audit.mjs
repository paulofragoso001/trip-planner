#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const migrationDir = path.join(repoRoot, "supabase", "migrations");
const legalMaxAgeDays = Number.parseInt(
  process.env.LEGAL_MAX_AGE_DAYS ?? "180",
  10
);

const allowedPublicEnv = new Set([
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL"
]);

const serverSecretNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CALENDAR_TOKEN_ENCRYPTION_KEY",
  "CALENDAR_SYNC_WORKER_SECRET",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "MICROSOFT_CALENDAR_CLIENT_SECRET",
  "RESEND_API_KEY"
];

const intentionallyServiceOnlyTables = new Set([
  "api_error_events",
  "calendar_connection_tokens"
]);

const allowedBroadPolicies = new Set([
  "profiles::Profiles are publicly readable"
]);

const requiredLegalPages = [
  {
    label: "Privacy Policy",
    path: path.join(repoRoot, "app", "privacy", "page.tsx"),
    requiredText: ["Data We Process", "Calendar Access", "Retention and Deletion"]
  },
  {
    label: "Terms of Service",
    path: path.join(repoRoot, "app", "terms", "page.tsx"),
    requiredText: ["Connected Services", "No Travel Guarantee", "Termination and Deletion"]
  }
];

main();

function main() {
  loadOptionalEnvFiles();

  const findings = [
    ...auditPublicEnvSecrets(),
    ...auditLegalFreshness(),
    ...auditMigrationRls()
  ];

  if (findings.length > 0) {
    console.error("Compliance audit failed:");
    for (const finding of findings) {
      console.error(`- [${finding.category}] ${finding.message}`);
    }
    process.exit(1);
  }

  console.log("Compliance audit passed.");
}

function loadOptionalEnvFiles() {
  for (const fileName of [".env.local", ".env.production.local", ".env.production", ".env"]) {
    const filePath = path.join(repoRoot, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const index = trimmed.indexOf("=");
      if (index <= 0) {
        continue;
      }

      const name = trimmed.slice(0, index).trim();
      const value = stripQuotes(trimmed.slice(index + 1).trim());
      if (!process.env[name]) {
        process.env[name] = value;
      }
    }
  }
}

function auditPublicEnvSecrets() {
  const findings = [];
  const publicEntries = Object.entries(process.env).filter(
    ([name, value]) => name.startsWith("NEXT_PUBLIC_") && Boolean(value)
  );

  for (const [name] of publicEntries) {
    if (!allowedPublicEnv.has(name) && /SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN|ENCRYPTION/i.test(name)) {
      findings.push({
        category: "exposed_secret",
        message: `${name} looks like a secret but is browser-exposed.`
      });
    }
  }

  for (const secretName of serverSecretNames) {
    const secretValue = process.env[secretName];
    if (!secretValue) {
      continue;
    }

    for (const [publicName, publicValue] of publicEntries) {
      if (publicValue === secretValue) {
        findings.push({
          category: "exposed_secret",
          message: `${secretName} is duplicated into ${publicName}.`
        });
      }
    }
  }

  return findings;
}

function auditLegalFreshness() {
  const findings = [];

  for (const page of requiredLegalPages) {
    if (!fs.existsSync(page.path)) {
      findings.push({
        category: "legal_outdated",
        message: `${page.label} page is missing.`
      });
      continue;
    }

    const content = fs.readFileSync(page.path, "utf8");
    for (const text of page.requiredText) {
      if (!content.includes(text)) {
        findings.push({
          category: "legal_outdated",
          message: `${page.label} is missing required section text: ${text}.`
        });
      }
    }

    const dateMatch = content.match(/lastUpdated\s*=\s*"([^"]+)"/);
    if (!dateMatch) {
      findings.push({
        category: "legal_outdated",
        message: `${page.label} is missing a lastUpdated marker.`
      });
      continue;
    }

    const updatedAt = new Date(dateMatch[1]);
    if (Number.isNaN(updatedAt.getTime())) {
      findings.push({
        category: "legal_outdated",
        message: `${page.label} has an invalid lastUpdated date.`
      });
      continue;
    }

    const ageDays = Math.floor((Date.now() - updatedAt.getTime()) / 86400000);
    if (ageDays > legalMaxAgeDays) {
      findings.push({
        category: "legal_outdated",
        message: `${page.label} was last reviewed ${ageDays} days ago. Limit is ${legalMaxAgeDays} days.`
      });
    }
  }

  return findings;
}

function auditMigrationRls() {
  if (!fs.existsSync(migrationDir)) {
    return [
      {
        category: "rls_missing_or_broad",
        message: "supabase/migrations directory is missing."
      }
    ];
  }

  const sql = fs
    .readdirSync(migrationDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort()
    .map((fileName) => fs.readFileSync(path.join(migrationDir, fileName), "utf8"))
    .join("\n");

  const findings = [];
  const publicTables = new Set(
    [...sql.matchAll(/create\s+table\s+if\s+not\s+exists\s+public\.([a-z_][a-z0-9_]*)/gi)]
      .map((match) => match[1])
  );

  for (const table of [...publicTables].sort()) {
    const hasRls = new RegExp(
      `alter\\s+table\\s+public\\.${escapeRegExp(table)}\\s+enable\\s+row\\s+level\\s+security`,
      "i"
    ).test(sql);

    if (!hasRls) {
      findings.push({
        category: "rls_missing_or_broad",
        message: `public.${table} is created in migrations without enabling RLS.`
      });
    }

    const hasPolicy = new RegExp(
      `create\\s+policy\\s+.*?\\s+on\\s+public\\.${escapeRegExp(table)}\\b`,
      "is"
    ).test(sql);

    if (!hasPolicy && !intentionallyServiceOnlyTables.has(table)) {
      findings.push({
        category: "rls_missing_or_broad",
        message: `public.${table} has RLS but no local policy and is not marked service-only.`
      });
    }
  }

  for (const policy of extractPolicies(sql)) {
    const policyKey = `${policy.table}::${policy.name}`;
    if (allowedBroadPolicies.has(policyKey)) {
      continue;
    }

    if (/\busing\s*\(\s*true\s*\)/i.test(policy.body)) {
      findings.push({
        category: "rls_missing_or_broad",
        message: `public.${policy.table} policy "${policy.name}" has USING (true).`
      });
    }

    if (/\bwith\s+check\s*\(\s*true\s*\)/i.test(policy.body)) {
      findings.push({
        category: "rls_missing_or_broad",
        message: `public.${policy.table} policy "${policy.name}" has WITH CHECK (true).`
      });
    }
  }

  return findings;
}

function extractPolicies(sql) {
  const policies = [];
  const regex = /create\s+policy\s+"([^"]+)"\s+on\s+public\.([a-z_][a-z0-9_]*)([\s\S]*?);/gi;
  for (const match of sql.matchAll(regex)) {
    policies.push({
      body: match[3],
      name: match[1],
      table: match[2]
    });
  }

  return policies;
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
