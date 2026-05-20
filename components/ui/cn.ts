/**
 * Minimal class-name joiner. We deliberately don't pull in clsx — neumorphic
 * components mostly compose static classes with one optional variant string,
 * so the dependency would be overkill.
 */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
