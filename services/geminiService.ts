import { InspectionData, InspectionStatus } from "../types";
import { INSPECTION_ITEMS, PETROLEUM_V2_ITEMS, ACID_INSPECTION_ITEMS } from "../constants";

export const analyzeInspection = async (data: InspectionData): Promise<string> => {
  // Determine which items set to use based on data content to identify specific faults
  let allItems = INSPECTION_ITEMS;
  if (data.petro2_1) allItems = PETROLEUM_V2_ITEMS;
  else if (data.acid_1) allItems = ACID_INSPECTION_ITEMS;

  const failedItems = allItems.filter(item => data[item.id] === InspectionStatus.BAD);
  const attentionItems = allItems.filter(item => data[item.id] === InspectionStatus.ATTENTION);

  if (failedItems.length > 0) {
    const list = failedItems.map(i => i.label.split('. ').pop()).join(', ');
    return `CRITICAL: Ground vehicle immediately. Resolve critical faults in: ${list}. Safety risk level is HIGH.`;
  }

  if (attentionItems.length > 0) {
    const list = attentionItems.map(i => i.label.split('. ').pop()).join(', ');
    return `CAUTION: Maintenance required. Schedule repairs for: ${list} within the next 24 hours.`;
  }

  if (data.safeToLoad === 'No') {
    return `RESTRICTED: Vehicle marked UNSAFE TO LOAD by inspector. Do not dispatch until further review.`;
  }

  return `OPERATIONAL: Vehicle meets safety standards. Clear for deployment.`;
};