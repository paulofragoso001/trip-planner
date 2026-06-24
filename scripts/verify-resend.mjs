#!/usr/bin/env node

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;
const resendTestTo = process.env.RESEND_TEST_TO;

let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function info(message) {
  console.log(`INFO ${message}`);
}

if (!resendApiKey) {
  fail("RESEND_API_KEY is missing.");
}

if (!resendFromEmail) {
  fail("RESEND_FROM_EMAIL is missing.");
}

if (!resendApiKey || !resendFromEmail) {
  process.exit(1);
}

const domainsResponse = await fetch("https://api.resend.com/domains", {
  headers: {
    Authorization: `Bearer ${resendApiKey}`
  }
});

const domainsJson = await domainsResponse.json().catch(() => ({}));

if (!domainsResponse.ok) {
  fail(`Resend domain check failed with HTTP ${domainsResponse.status}.`);
  process.exit(1);
}

const domains = Array.isArray(domainsJson.data) ? domainsJson.data : [];
const verifiedDomains = domains.filter((domain) => domain.status === "verified");
const fromDomain = readEmailDomain(resendFromEmail);
const matchingDomain = verifiedDomains.find((domain) => domain.name === fromDomain);

if (verifiedDomains.length === 0) {
  fail("No verified Resend domains returned for this API key.");
} else {
  pass(
    `Verified Resend domains: ${verifiedDomains
      .map((domain) => `${domain.name} (${domain.status})`)
      .join(", ")}`
  );
}

if (!fromDomain) {
  fail("RESEND_FROM_EMAIL must include an email address.");
} else if (!matchingDomain) {
  fail(`RESEND_FROM_EMAIL domain ${fromDomain} is not verified in Resend.`);
} else {
  pass(`RESEND_FROM_EMAIL uses verified domain ${fromDomain}.`);
}

if (resendTestTo) {
  const sendResponse = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: resendFromEmail,
      html: [
        "<p>This is an Almidy invite email delivery verification.</p>",
        "<p>If you received this, Resend delivery is working for the configured sender.</p>"
      ].join(""),
      subject: "Almidy invite email verification",
      to: resendTestTo
    }),
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const sendJson = await sendResponse.json().catch(() => ({}));

  if (!sendResponse.ok) {
    fail(`Resend test email failed with HTTP ${sendResponse.status}.`);
  } else {
    pass(`Resend test email accepted with id ${sendJson.id || "unknown"}.`);
  }
} else {
  info("RESEND_TEST_TO is not set; skipping live delivery test.");
}

process.exit(failed ? 1 : 0);

function readEmailDomain(value) {
  const match = String(value).match(/<([^<>@\s]+@[^<>@\s]+)>|([^<>\s]+@[^<>\s]+)/);
  const email = match?.[1] || match?.[2];

  if (!email) {
    return null;
  }

  return email.split("@")[1]?.trim().toLowerCase() || null;
}
