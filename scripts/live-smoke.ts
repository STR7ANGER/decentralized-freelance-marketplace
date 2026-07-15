import bs58 from "bs58";
import nacl from "tweetnacl";

const apiUrl = process.env.API_URL ?? "http://localhost:3001";
const keys = nacl.sign.keyPair();
const walletAddress = bs58.encode(keys.publicKey);
const challengeResponse = await fetch(`${apiUrl}/v1/auth/challenge`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ walletAddress, tenantSlug: "demo" }),
});
if (!challengeResponse.ok)
  throw new Error(`challenge:${challengeResponse.status}`);
const challenge = (await challengeResponse.json()) as {
  challengeId: string;
  message: string;
};
const signature = bs58.encode(
  nacl.sign.detached(
    new TextEncoder().encode(challenge.message),
    keys.secretKey,
  ),
);
const verificationBody = {
  challengeId: challenge.challengeId,
  walletAddress,
  message: challenge.message,
  signature,
  displayName: "Local Demo Client",
  role: "CLIENT",
};
const verifyResponse = await fetch(`${apiUrl}/v1/auth/verify`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(verificationBody),
});
if (!verifyResponse.ok) throw new Error(`verify:${verifyResponse.status}`);
const cookie = verifyResponse.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("missing-session-cookie");

const mutation = `mutation CreateJob($input:CreateJobInput!){createJob(input:$input){id title status budgetMinor currency}}`;
const createResponse = await fetch(`${apiUrl}/graphql`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({
    query: mutation,
    variables: {
      input: {
        title: "Build a localnet escrow dashboard",
        description:
          "Create an accessible dashboard for deterministic localnet escrow events and milestones.",
        category: "Engineering",
        skills: ["Rust", "Next.js"],
        budgetMinor: "250000",
        currency: "USD",
        publish: true,
      },
    },
  }),
});
const created = (await createResponse.json()) as {
  data?: { createJob: { id: string; status: string } };
};
if (!created.data || created.data.createJob.status !== "PUBLISHED")
  throw new Error("job-create-failed");

const query = `query Jobs($tenantSlug:String!,$filter:JobFilter){jobs(tenantSlug:$tenantSlug,filter:$filter){jobs{id title skills} nextCursor}}`;
const searchResponse = await fetch(`${apiUrl}/graphql`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    query,
    variables: { tenantSlug: "demo", filter: { search: "rust", limit: 10 } },
  }),
});
const searched = (await searchResponse.json()) as {
  data?: { jobs: { jobs: Array<{ id: string }> } };
};
if (
  !searched.data?.jobs.jobs.some((job) => job.id === created.data?.createJob.id)
)
  throw new Error("job-search-failed");

const replay = await fetch(`${apiUrl}/v1/auth/verify`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(verificationBody),
});
if (replay.status !== 400) throw new Error("nonce-replay-was-not-rejected");

console.info(
  JSON.stringify({
    status: "ok",
    cluster: "localnet",
    walletAuthentication: "verified",
    nonceReplay: "rejected",
    publishedJobId: created.data.createJob.id,
    transactionSubmitted: false,
  }),
);
