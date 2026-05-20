import type { ButtonHTMLAttributes } from "react";

import {
  buttonClassName,
  type ButtonSize,
  type ButtonVariant,
} from "./button-styles";

/**
 * Button — renders a `<button>` element. For navigation (links to other
 * routes), use {@link ./ButtonLink.tsx ButtonLink} instead; nesting a
 * `<button>` inside `<Link>` breaks click navigation.
 *
 * Three variants, all neumorphic:
 *   primary    — accent fill, soft inset on press (CTA)
 *   secondary  — same surface as page, extruded → pressed
 *   ghost      — flat resting state, inset on press (use sparingly,
 *                pairs well inside an already-extruded card)
 *
 * Active state always uses an inset shadow + a ~0.5px translate — that
 * "press down" micro-motion is what sells the tactility.
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant,
  size,
  className,
  type,
  ...rest
}: ButtonProps) {
  return (
    <button
      // Default to type="button" — React's default of "submit" inside a
      // form bites every project eventually.
      type={type ?? "button"}
      className={buttonClassName({
        variant,
        size,
        className,
        includeDisabledStyles: true,
      })}
      {...rest}
    />
  );
}
