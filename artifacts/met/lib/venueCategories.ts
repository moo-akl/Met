export const venueCategoryVisuals = {
  restaurant: { label: "Restaurant", icon: "silverware-fork-knife", color: "#D66B32" },
  cafe: { label: "Café", icon: "coffee", color: "#9A653D" },
  bar: { label: "Bar & nightlife", icon: "glass-cocktail", color: "#9556BC" },
  shopping: { label: "Shopping", icon: "shopping", color: "#3978BB" },
  outdoors: { label: "Park & outdoors", icon: "tree", color: "#38814A" },
  culture: { label: "Arts & culture", icon: "palette", color: "#BA507C" },
  fitness: { label: "Fitness & wellness", icon: "dumbbell", color: "#B9544D" },
  education: { label: "Education & library", icon: "school", color: "#4F6C94" },
  transit: { label: "Transport", icon: "train", color: "#487F91" },
  lodging: { label: "Hotel & lodging", icon: "bed", color: "#7762AE" },
  other: { label: "Other venue", icon: "star", color: "#C99418" },
} as const;

export type VenueCategory = keyof typeof venueCategoryVisuals;

export function getVenueCategoryVisual(category?: string | null) {
  return category && Object.prototype.hasOwnProperty.call(venueCategoryVisuals, category)
    ? venueCategoryVisuals[category as VenueCategory]
    : venueCategoryVisuals.other;
}
