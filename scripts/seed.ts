/**
 * Resets the local data store to the seed dataset.
 * Run with: `npm run seed`  (alias: `npm run reset`)
 *
 * The app also auto-seeds on first run, so this is only needed to wipe changes
 * made during a demo and start fresh.
 */
import { resetDb } from "../src/lib/db";

const db = resetDb();

console.log("✓ PartnerProof data store seeded (.data/db.json)");
console.log(
  `  ${db.teams.length} team · ${db.sponsors.length} sponsors · ` +
    `${db.contracts.length} contracts · ${db.deliverables.length} deliverables · ` +
    `${db.evidence.length} evidence items`
);
