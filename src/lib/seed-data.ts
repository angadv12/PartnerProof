/**
 * Deterministic seed data for the PartnerProof MVP.
 *
 * One mid-size pro team (the "first customer"), three sponsors, three contracts,
 * 25 deliverables across every category and status, and 12 evidence items —
 * enough to make every screen feel real on first load.
 *
 * `createSeedData()` returns a fresh deep copy each call so the data store and the
 * reset script never share mutable references.
 */
import type {
  Contract,
  Database,
  Deliverable,
  Evidence,
  Sponsor,
  Team,
} from "./types";

const CONTRACT_CREATED = "2025-09-15T09:00:00.000Z";
const RECENT = "2026-06-18T15:30:00.000Z";

const team: Team = {
  id: "team-breakers",
  name: "Harbor City Breakers",
  league: "Continental Basketball League",
  createdAt: "2025-08-01T12:00:00.000Z",
};

const sponsors: Sponsor[] = [
  {
    id: "sp-pepsi",
    name: "Pepsi",
    industry: "Beverages",
    primaryContact: "Dana Whitfield — Brand Partnerships",
  },
  {
    id: "sp-nike",
    name: "Nike",
    industry: "Apparel & Footwear",
    primaryContact: "Marcus Lee — Sports Marketing",
  },
  {
    id: "sp-gatorade",
    name: "Gatorade",
    industry: "Sports Nutrition",
    primaryContact: "Elena Ruiz — Activation Lead",
  },
];

const contracts: Contract[] = [
  {
    id: "ct-pepsi",
    teamId: team.id,
    sponsorId: "sp-pepsi",
    name: "Pepsi Presenting Partnership",
    season: "2025-26",
    startDate: "2025-10-01",
    endDate: "2026-06-30",
    value: 1_200_000,
    status: "Active",
    rawText:
      "Pepsi will receive presenting partner status for the 2026 home season. " +
      "The Team will provide Pepsi logo placement on the team homepage for a minimum of 30 consecutive days. " +
      "The Team will publish five sponsored Instagram posts during the regular season. " +
      "Pepsi will receive LED board exposure during ten home games. " +
      "Pepsi will receive one halftime fan activation before the end of the regular season. " +
      "The Team will include Pepsi in one email campaign to season ticket holders. " +
      "The Team will provide a post-season recap report with screenshots, performance notes, and activation proof.",
    createdAt: CONTRACT_CREATED,
  },
  {
    id: "ct-nike",
    teamId: team.id,
    sponsorId: "sp-nike",
    name: "Nike Official Apparel & Footwear",
    season: "2025-26",
    startDate: "2025-10-01",
    endDate: "2026-06-30",
    value: 2_500_000,
    status: "Active",
    rawText:
      "Nike will serve as the official apparel and footwear partner for the 2025-26 season, " +
      "with broadcast-visible kit branding across all home games, a branded content series, " +
      "community clinics, hospitality access, and social activations.",
    createdAt: CONTRACT_CREATED,
  },
  {
    id: "ct-gatorade",
    teamId: team.id,
    sponsorId: "sp-gatorade",
    name: "Gatorade Sideline & Hydration Partner",
    season: "2025-26",
    startDate: "2025-10-01",
    endDate: "2026-06-30",
    value: 850_000,
    status: "Active",
    rawText:
      "Gatorade will serve as the official sideline and hydration partner for the 2025-26 season, " +
      "including sideline branding, in-arena activations, LED exposure, content, and a season-ticket-holder email.",
    createdAt: CONTRACT_CREATED,
  },
];

type DeliverableSeed = Omit<
  Deliverable,
  "contractId" | "sponsorId" | "createdAt" | "updatedAt"
>;

function build(
  contractId: string,
  sponsorId: string,
  seeds: DeliverableSeed[]
): Deliverable[] {
  return seeds.map((s) => ({
    ...s,
    contractId,
    sponsorId,
    createdAt: CONTRACT_CREATED,
    updatedAt: RECENT,
  }));
}

const pepsiDeliverables = build("ct-pepsi", "sp-pepsi", [
  {
    id: "dl-pepsi-1",
    title: "Logo placement on team homepage",
    description:
      "Pepsi logo featured on the Harbor City Breakers homepage for a minimum of 30 consecutive days.",
    category: "Digital",
    dueDate: "2025-11-15",
    quantityRequired: 30,
    quantityDelivered: 30,
    status: "Delivered",
    priority: "High",
    sourceText:
      "The Team will provide Pepsi logo placement on the team homepage for a minimum of 30 consecutive days.",
    notes: "Ran Oct 5 – Nov 4 during the season-launch window.",
  },
  {
    id: "dl-pepsi-2",
    title: "Five sponsored Instagram posts",
    description: "Five sponsored Instagram posts published across the regular season.",
    category: "Social",
    dueDate: "2026-05-31",
    quantityRequired: 5,
    quantityDelivered: 5,
    status: "Delivered",
    priority: "Medium",
    sourceText:
      "The Team will publish five sponsored Instagram posts during the regular season.",
  },
  {
    id: "dl-pepsi-3",
    title: "LED board exposure during ten home games",
    description: "Courtside LED board exposure during ten designated home games.",
    category: "In-arena",
    dueDate: "2026-06-28",
    quantityRequired: 10,
    quantityDelivered: 8,
    status: "At Risk",
    priority: "High",
    sourceText: "Pepsi will receive LED board exposure during ten home games.",
    notes: "8 of 10 games complete; 2 remaining in the final homestand.",
  },
  {
    id: "dl-pepsi-4",
    title: "One halftime fan activation",
    description:
      "One Pepsi-branded halftime fan activation before the end of the regular season.",
    category: "In-arena",
    dueDate: "2026-02-20",
    quantityRequired: 1,
    quantityDelivered: 1,
    status: "Delivered",
    priority: "Medium",
    sourceText:
      "Pepsi will receive one halftime fan activation before the end of the regular season.",
    notes: "'Pepsi Half-Court Challenge' run Feb 14 vs Coastal.",
  },
  {
    id: "dl-pepsi-5",
    title: "Email campaign to season ticket holders",
    description: "One dedicated email campaign to season ticket holders.",
    category: "Email",
    dueDate: "2026-04-15",
    quantityRequired: 1,
    quantityDelivered: 0,
    status: "Missed",
    priority: "High",
    sourceText:
      "The Team will include Pepsi in one email campaign to season ticket holders.",
    notes: "Slot deprioritized during the playoff push — never sent.",
  },
  {
    id: "dl-pepsi-6",
    title: "Post-season recap report",
    description:
      "Post-season recap report with screenshots, performance notes, and activation proof.",
    category: "Content",
    dueDate: "2026-06-30",
    quantityRequired: 1,
    quantityDelivered: 0,
    status: "Pending",
    priority: "Medium",
    sourceText:
      "The Team will provide a post-season recap report with screenshots, performance notes, and activation proof.",
    notes: "Generate via PartnerProof at season close.",
  },
  {
    id: "dl-pepsi-7",
    title: "Concourse cup & signage branding",
    description:
      "Pepsi branding on concourse cups and fixed concourse signage for all home games.",
    category: "In-arena",
    dueDate: "2025-10-20",
    quantityRequired: 1,
    quantityDelivered: 1,
    status: "Delivered",
    priority: "Low",
  },
  {
    id: "dl-pepsi-8",
    title: "Sponsor mention in game recap articles",
    description:
      "'Presented by Pepsi' mention included in published home-game recap articles.",
    category: "Content",
    dueDate: "2026-06-30",
    quantityRequired: 20,
    quantityDelivered: 16,
    status: "At Risk",
    priority: "Low",
    notes: "16 of 20 recaps tagged; backfilling the remainder.",
  },
]);

const nikeDeliverables = build("ct-nike", "sp-nike", [
  {
    id: "dl-nike-1",
    title: "Broadcast-visible kit & jersey branding",
    description:
      "Nike swoosh on game kits with broadcast-visible placement for all home games.",
    category: "Broadcast",
    dueDate: "2026-06-30",
    quantityRequired: 41,
    quantityDelivered: 38,
    status: "At Risk",
    priority: "High",
    notes: "38 of 41 home games complete.",
  },
  {
    id: "dl-nike-2",
    title: "Sponsored Instagram posts featuring gear",
    description: "Sponsored Instagram posts featuring Nike player gear and apparel drops.",
    category: "Social",
    dueDate: "2026-05-31",
    quantityRequired: 8,
    quantityDelivered: 8,
    status: "Delivered",
    priority: "Medium",
  },
  {
    id: "dl-nike-3",
    title: "'Behind the Kit' content series",
    description: "Six-episode 'Behind the Kit' branded content series across team channels.",
    category: "Content",
    dueDate: "2026-06-28",
    quantityRequired: 6,
    quantityDelivered: 4,
    status: "At Risk",
    priority: "Medium",
    notes: "Episodes 5–6 in edit.",
  },
  {
    id: "dl-nike-4",
    title: "Training facility & locker room branding",
    description: "Nike branding installed across the practice facility and home locker room.",
    category: "In-arena",
    dueDate: "2025-10-15",
    quantityRequired: 1,
    quantityDelivered: 1,
    status: "Delivered",
    priority: "Low",
  },
  {
    id: "dl-nike-5",
    title: "Community youth clinics presented by Nike",
    description: "Two community youth basketball clinics presented by Nike.",
    category: "Hospitality",
    dueDate: "2026-05-15",
    quantityRequired: 2,
    quantityDelivered: 1,
    status: "Missed",
    priority: "Medium",
    notes: "Only 1 of 2 clinics held; spring date fell through.",
  },
  {
    id: "dl-nike-6",
    title: "Footwear giveaway social campaign",
    description: "Three-part footwear giveaway campaign across social channels.",
    category: "Social",
    dueDate: "2026-03-31",
    quantityRequired: 3,
    quantityDelivered: 3,
    status: "Delivered",
    priority: "Low",
  },
  {
    id: "dl-nike-7",
    title: "VIP suite access for 2 home games",
    description: "VIP suite access for two home games for Nike partnership guests.",
    category: "Hospitality",
    dueDate: "2026-02-28",
    quantityRequired: 2,
    quantityDelivered: 2,
    status: "Delivered",
    priority: "Medium",
  },
  {
    id: "dl-nike-8",
    title: "Newsletter feature",
    description: "Nike feature included in four editions of the team newsletter.",
    category: "Email",
    dueDate: "2026-06-30",
    quantityRequired: 4,
    quantityDelivered: 3,
    status: "Pending",
    priority: "Low",
    notes: "3 of 4 editions shipped; final newsletter pending.",
  },
  {
    id: "dl-nike-9",
    title: "Courtside broadcast signage",
    description: "Broadcast-visible courtside signage rotation for all home games.",
    category: "Broadcast",
    dueDate: "2026-04-30",
    quantityRequired: 41,
    quantityDelivered: 41,
    status: "Delivered",
    priority: "High",
  },
]);

const gatoradeDeliverables = build("ct-gatorade", "sp-gatorade", [
  {
    id: "dl-gat-1",
    title: "Sideline cooler & cup branding",
    description:
      "Gatorade sideline coolers, cups and towels with broadcast visibility at all games.",
    category: "Broadcast",
    dueDate: "2026-04-30",
    quantityRequired: 41,
    quantityDelivered: 41,
    status: "Delivered",
    priority: "High",
  },
  {
    id: "dl-gat-2",
    title: "'Fuel Up' halftime activations",
    description: "Three 'Fuel Up' halftime hydration activations during home games.",
    category: "In-arena",
    dueDate: "2026-06-28",
    quantityRequired: 3,
    quantityDelivered: 2,
    status: "At Risk",
    priority: "Medium",
    notes: "2 of 3 complete; final scheduled for the closing homestand.",
  },
  {
    id: "dl-gat-3",
    title: "Hydration tips social series",
    description: "Six sponsored hydration-tip posts across Instagram and TikTok.",
    category: "Social",
    dueDate: "2026-06-25",
    quantityRequired: 6,
    quantityDelivered: 5,
    status: "At Risk",
    priority: "Low",
  },
  {
    id: "dl-gat-4",
    title: "LED board exposure during ten home games",
    description: "Courtside LED board exposure during ten home games.",
    category: "In-arena",
    dueDate: "2026-03-31",
    quantityRequired: 10,
    quantityDelivered: 10,
    status: "Delivered",
    priority: "Medium",
  },
  {
    id: "dl-gat-5",
    title: "Player hydration feature articles",
    description: "Two long-form player hydration feature articles on team media.",
    category: "Content",
    dueDate: "2026-06-30",
    quantityRequired: 2,
    quantityDelivered: 1,
    status: "Pending",
    priority: "Low",
  },
  {
    id: "dl-gat-6",
    title: "Email campaign to season ticket holders",
    description: "One dedicated email campaign to season ticket holders.",
    category: "Email",
    dueDate: "2026-04-10",
    quantityRequired: 1,
    quantityDelivered: 1,
    status: "Delivered",
    priority: "Medium",
  },
  {
    id: "dl-gat-7",
    title: "Locker room hydration station branding",
    description: "Branded hydration station installed in the home locker room.",
    category: "In-arena",
    dueDate: "2025-10-15",
    quantityRequired: 1,
    quantityDelivered: 1,
    status: "Delivered",
    priority: "Low",
  },
  {
    id: "dl-gat-8",
    title: "Post-season recap report",
    description: "Post-season recap report with activation proof and performance metrics.",
    category: "Content",
    dueDate: "2026-06-30",
    quantityRequired: 1,
    quantityDelivered: 0,
    status: "Pending",
    priority: "Medium",
  },
]);

const deliverables: Deliverable[] = [
  ...pepsiDeliverables,
  ...nikeDeliverables,
  ...gatoradeDeliverables,
];

const evidence: Evidence[] = [
  {
    id: "ev-1",
    deliverableId: "dl-pepsi-1",
    contractId: "ct-pepsi",
    sponsorId: "sp-pepsi",
    title: "Homepage hero takeover",
    type: "Screenshot",
    description: "Full-bleed Pepsi takeover on the Breakers homepage, launch week.",
    activationDate: "2025-10-05",
    uploadedBy: "Jordan Avery",
    createdAt: "2025-10-05T18:00:00.000Z",
  },
  {
    id: "ev-2",
    deliverableId: "dl-pepsi-2",
    contractId: "ct-pepsi",
    sponsorId: "sp-pepsi",
    title: "Season-launch sponsored post",
    type: "URL",
    url: "https://www.instagram.com/p/breakers-pepsi-launch",
    description: "Sponsored Instagram post — 142k reach, 9.1k engagements.",
    activationDate: "2025-11-12",
    uploadedBy: "Sam Patel",
    createdAt: "2025-11-12T16:20:00.000Z",
  },
  {
    id: "ev-3",
    deliverableId: "dl-pepsi-4",
    contractId: "ct-pepsi",
    sponsorId: "sp-pepsi",
    title: "Pepsi Half-Court Challenge",
    type: "Image",
    description: "Fan activation photos from the Feb 14 halftime challenge.",
    activationDate: "2026-02-14",
    uploadedBy: "Casey Nguyen",
    createdAt: "2026-02-14T22:10:00.000Z",
  },
  {
    id: "ev-4",
    deliverableId: "dl-pepsi-3",
    contractId: "ct-pepsi",
    sponsorId: "sp-pepsi",
    title: "Courtside LED capture vs Coastal",
    type: "Image",
    description: "Broadcast still showing Pepsi LED board during live play.",
    activationDate: "2026-01-20",
    uploadedBy: "Jordan Avery",
    createdAt: "2026-01-20T23:05:00.000Z",
  },
  {
    id: "ev-5",
    deliverableId: "dl-nike-2",
    contractId: "ct-nike",
    sponsorId: "sp-nike",
    title: "Player gear feature reel",
    type: "URL",
    url: "https://www.instagram.com/p/breakers-nike-gear",
    description: "Reel featuring on-court Nike gear — 318k views.",
    activationDate: "2025-12-01",
    uploadedBy: "Sam Patel",
    createdAt: "2025-12-01T17:45:00.000Z",
  },
  {
    id: "ev-6",
    deliverableId: "dl-nike-4",
    contractId: "ct-nike",
    sponsorId: "sp-nike",
    title: "Locker room install photos",
    type: "Image",
    description: "Completed Nike branding across the home locker room.",
    activationDate: "2025-10-08",
    uploadedBy: "Casey Nguyen",
    createdAt: "2025-10-08T14:00:00.000Z",
  },
  {
    id: "ev-7",
    deliverableId: "dl-nike-7",
    contractId: "ct-nike",
    sponsorId: "sp-nike",
    title: "Suite 204 hospitality recap",
    type: "Text Note",
    description:
      "Hosted 12 Nike partnership guests in Suite 204 vs Metro. Strong feedback; renewal interest noted.",
    activationDate: "2026-01-15",
    uploadedBy: "Jordan Avery",
    createdAt: "2026-01-15T21:30:00.000Z",
  },
  {
    id: "ev-8",
    deliverableId: "dl-nike-6",
    contractId: "ct-nike",
    sponsorId: "sp-nike",
    title: "Giveaway entry analytics",
    type: "Screenshot",
    description: "Footwear giveaway drove 4,210 entries and 1,830 net-new opt-ins.",
    activationDate: "2026-03-10",
    uploadedBy: "Sam Patel",
    createdAt: "2026-03-10T19:15:00.000Z",
  },
  {
    id: "ev-9",
    deliverableId: "dl-gat-1",
    contractId: "ct-gatorade",
    sponsorId: "sp-gatorade",
    title: "Broadcast sideline visibility",
    type: "Image",
    description: "Gatorade coolers and cups visible during national broadcast.",
    activationDate: "2025-10-25",
    uploadedBy: "Casey Nguyen",
    createdAt: "2025-10-25T23:40:00.000Z",
  },
  {
    id: "ev-10",
    deliverableId: "dl-gat-4",
    contractId: "ct-gatorade",
    sponsorId: "sp-gatorade",
    title: "Gatorade LED board capture",
    type: "Image",
    description: "Courtside LED rotation still from the Feb 2 home game.",
    activationDate: "2026-02-02",
    uploadedBy: "Jordan Avery",
    createdAt: "2026-02-02T22:50:00.000Z",
  },
  {
    id: "ev-11",
    deliverableId: "dl-gat-6",
    contractId: "ct-gatorade",
    sponsorId: "sp-gatorade",
    title: "STH email performance",
    type: "Screenshot",
    description: "Season-ticket-holder email — 18,420 sends, 32% open, 6.4% CTR.",
    activationDate: "2026-04-10",
    uploadedBy: "Sam Patel",
    createdAt: "2026-04-10T15:05:00.000Z",
  },
  {
    id: "ev-12",
    deliverableId: "dl-gat-2",
    contractId: "ct-gatorade",
    sponsorId: "sp-gatorade",
    title: "Fuel Up activation crowd",
    type: "Image",
    description: "Crowd shots from the March 22 'Fuel Up' halftime activation.",
    activationDate: "2026-03-22",
    uploadedBy: "Casey Nguyen",
    createdAt: "2026-03-22T22:30:00.000Z",
  },
];

export function createSeedData(): Database {
  // Deep clone so callers can mutate freely without touching this module's state.
  return structuredClone({
    teams: [team],
    sponsors,
    contracts,
    deliverables,
    evidence,
    recapReports: [],
  });
}
