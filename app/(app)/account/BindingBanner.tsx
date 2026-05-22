import { Card } from "@/components/ui/Card";

import { AccountBindingForm } from "./AccountBindingForm";
import type { BindActionResult } from "./binding-actions";

export function BindingBanner(props: {
  action: (p: BindActionResult | null, fd: FormData) => Promise<BindActionResult>;
  title: string;
  body: string;
  label: string;
  placeholder: string;
}) {
  return (
    <Card className="p-6 md:p-8 mb-8">
      <h3 className="font-display text-lg font-extrabold text-ink">{props.title}</h3>
      <p className="text-ink-muted text-sm mt-1 mb-4">{props.body}</p>
      <AccountBindingForm
        action={props.action}
        label={props.label}
        placeholder={props.placeholder}
      />
    </Card>
  );
}
