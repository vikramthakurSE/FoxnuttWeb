/** Visual identity per product line — used when no photo is dropped in
 *  public/products/<slug>.jpg */
export interface BrandTheme {
  from: string;
  to: string;
  accent: string;
  short: string;
}

const themes: Record<string, BrandTheme> = {
  "holiday-250g": {
    from: "#4b2a72",
    to: "#6d3fa0",
    accent: "#e9ddf7",
    short: "Holiday",
  },
  "laddu-gopal-100g": {
    from: "#a3251c",
    to: "#c94a32",
    accent: "#fbe3d4",
    short: "Laddu Gopal",
  },
  "gopala-250g": {
    from: "#5c7a1e",
    to: "#87a32c",
    accent: "#f2f7d9",
    short: "Gopala",
  },
  "trust-250g": {
    from: "#1f4e79",
    to: "#3a72a8",
    accent: "#e1eefb",
    short: "Trust",
  },
  "holiday-loose-10kg": {
    from: "#7a542e",
    to: "#a3763f",
    accent: "#f7ecd9",
    short: "Loose Bulk",
  },
};

const fallback: BrandTheme = {
  from: "#7a542e",
  to: "#a3763f",
  accent: "#f7ecd9",
  short: "Makhana",
};

export function brandTheme(slug: string): BrandTheme {
  return themes[slug] ?? fallback;
}
