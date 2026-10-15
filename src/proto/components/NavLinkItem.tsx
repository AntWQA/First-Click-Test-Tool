import { Flex, Icon, ListItem } from "@doterra-it/design-system-ui-base";
import type { IconName } from "@doterra-it/design-system-ui-base";
import type { NavLink } from "../types/navigation";
import { AppLink } from "./AppLink";

interface Props {
  link: NavLink;
  onNavigate: () => void;
}

export const testIdFor = (prefix: string, href: string) => `${prefix}-${href.replace(/\//g, "-").replace(/^-/, "")}`;

/** One link in a desktop menu column: optional leading icon, optional trailing arrow ("View all"). */
export function NavLinkItem({ link, onNavigate }: Props) {
  return (
    <ListItem>
      <Flex align="center" spacing="sm">
        {link.icon && <Icon name={link.icon as IconName} size="md" color="brand" />}
        <AppLink href={link.href} onClick={onNavigate} data-testid={testIdFor("nav-link", link.href)}>{link.label}</AppLink>
        {link.variant === "viewAll" && <Icon name="arrow-right" size="sm" />}
      </Flex>
    </ListItem>
  );
}
