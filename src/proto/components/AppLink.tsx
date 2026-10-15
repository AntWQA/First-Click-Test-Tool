import { Link as RouterLink } from "react-router-dom";
import { Link } from "@doterra-it/design-system-ui-base";
import type { ReactNode } from "react";

interface AppLinkProps {
  href: string;
  onClick?: () => void;
  children: ReactNode;
  "data-testid"?: string;
}

/** Pure Link rendered as a router link so navigation stays client side. */
export function AppLink({ href, children, ...rest }: AppLinkProps) {
  return <Link as={RouterLink} to={href} underline="hover" {...rest}>{children}</Link>;
}
