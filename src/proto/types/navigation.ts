export interface NavLink {
  label: string;
  href: string;
  /** Pure Icon name, to be verified against the installed package. */
  icon?: string;
  variant?: "default" | "viewAll";
  /** Nested sub categories, shown on mobile and tablet only. */
  children?: NavLink[];
}

export interface NavColumn {
  title: string;
  links: NavLink[];
  /** Desktop grid span out of 12. Omit for an even split. */
  span?: number;
  /** Order on mobile (and tablet when `tabletSide` is not set). Omit to keep document order. */
  mobileOrder?: number;
  /** Tablet two-column side. Set on every column of a menu to enable the two-column layout. */
  tabletSide?: "left" | "right";
  /** Order within the tablet side. */
  tabletOrder?: number;
}

export interface NavFeatured {
  title: string;
  link: NavLink;
  image: { src: string; alt: string } | null;
}

export interface MegaMenuItem {
  id: string;
  label: string;
  href: string;
  type: "megaMenu";
  columns: NavColumn[];
  featured?: NavFeatured;
}

export interface DropdownItem {
  id: string;
  label: string;
  href: string;
  type: "dropdown";
  links: NavLink[];
}

export type NavItem = MegaMenuItem | DropdownItem;

export interface Navigation {
  version: 1;
  source?: string;
  items: NavItem[];
}
