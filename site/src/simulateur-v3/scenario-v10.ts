import { publishCampaignFromCatalogue } from "./campaign-topology.ts";
import { SCENARIO_V10_CATALOGUE } from "./scenario-v10-catalogue.ts";
import type { Scenario } from "./types.ts";

/** The fixed 72-decision V10 campaign, built solely from the frozen V10 catalogue. */
export const SCENARIO_V10: Scenario = publishCampaignFromCatalogue(SCENARIO_V10_CATALOGUE);
