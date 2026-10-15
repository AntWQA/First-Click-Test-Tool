import { useState } from "react";
import { Box, Button, Popover, Stack } from "@doterra-it/design-system-ui-base";

export interface SortMenuOption { value: string; label: string }

interface SortMenuProps {
  options: readonly SortMenuOption[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name for the option group. @default "Sort by" */
  label?: string;
  "data-testid"?: string;
}

/**
 * Sort recipe: the trigger shows the selected option ("Price: Low-High") as a tertiary Button with a chevron, and the
 * popover stacks one full width Button per option with the selected one filled (primary). Composed from Pure Popover,
 * Button, Stack and Box because Pure has no component for it: SortFilter shows a fixed "Sort" label and a plain list with a
 * check mark (register PS-28). Picking an option closes the popover.
 */
export function SortMenu({ options, value, onChange, label = "Sort by", "data-testid": testId = "sort-menu" }: SortMenuProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];
  return (
    <Popover placement="bottom-end" isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger as="span">
        <Button variant="tertiary" size="medium" icon="chevron-down" iconPosition="right" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)} data-testid={`${testId}-trigger`}>{selected.label}</Button>
      </Popover.Trigger>
      <Popover.Content>
        <Box padding="xs" role="group" aria-label={label} data-testid={testId}>
          <Stack spacing="xs" align="stretch">
            {options.map((o) => (
              <Button
                key={o.value}
                variant={o.value === selected.value ? "primary" : "tertiary"}
                size="medium"
                fullWidth
                aria-pressed={o.value === selected.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                data-testid={`${testId}-option-${o.value}`}
              >
                {o.label}
              </Button>
            ))}
          </Stack>
        </Box>
      </Popover.Content>
    </Popover>
  );
}
