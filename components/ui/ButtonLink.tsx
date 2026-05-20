import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

import {
  buttonClassName,
  type ButtonSize,
  type ButtonVariant,
} from "./button-styles";

/**
 * Link styled to look like a Button. Use for navigation — clicking it
 * routes via next/link's client-side navigation. Renders as an `<a>`,
 * which keeps semantics correct and avoids the "click does nothing"
 * bug from nesting a `<button>` inside `<Link>`.
 *
 * Visual style stays in lock-step with Button via the shared
 * `buttonClassName` recipe in button-styles.ts.
 *
 *   <ButtonLink href="/login" variant="primary" size="lg">Sign in</ButtonLink>
 */
export interface ButtonLinkProps extends Omit<LinkProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  target?: string;
  rel?: string;
  "aria-label"?: string;
  children: ReactNode;
}

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClassName({ variant, size, className })}
      {...rest}
    >
      {children}
    </Link>
  );
}
