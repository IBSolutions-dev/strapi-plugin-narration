import * as React from "react";
import { Box, Button, Field, Flex, TextInput, Typography } from "@strapi/design-system";
import { ArrowDown, ArrowUp, Plus, Trash } from "@strapi/icons";
import { useIntl } from "react-intl";

import type { StripDelimiterPair } from "../../../shared/narration-field-options";

type IntlShape = { id: string; defaultMessage: string };

type Props = {
  name: string;
  value: unknown;
  onChange: (e: { target: { name: string; value: unknown } }) => void;
  intlLabel: IntlShape;
  description?: IntlShape;
  disabled?: boolean;
  error?: string;
};

function parseValue(raw: unknown): StripDelimiterPair[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      return parseValue(JSON.parse(t) as unknown);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const out: StripDelimiterPair[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const open = typeof o.open === "string" ? o.open : "";
    const close = typeof o.close === "string" ? o.close : "";
    out.push({ open, close });
  }
  return out;
}

/**
 * CTB option: repeatable open/close delimiters — regions between tags (inclusive) are dropped from narration text before TTS.
 */
const NarrationCtbDelimiterPairs = (props: Props) => {
  const { formatMessage } = useIntl();
  const { name, value, onChange, intlLabel, description, disabled, error } = props;

  const rows = parseValue(value);

  const emit = (next: StripDelimiterPair[]) => {
    onChange({ target: { name, value: next } });
  };

  const label = formatMessage(intlLabel);
  const hint = description ? formatMessage(description) : undefined;

  const updateRow = (index: number, patch: Partial<StripDelimiterPair>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    emit(next);
  };

  const removeRow = (index: number) => {
    emit(rows.filter((_, i) => i !== index));
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[index], next[j]] = [next[j], next[index]];
    emit(next);
  };

  const addRow = () => {
    emit([...rows, { open: "", close: "" }]);
  };

  return (
    <Field.Root name={name} error={error} hint={hint}>
      <Flex direction="column" alignItems="stretch" gap={3}>
        <Field.Label>{label}</Field.Label>
        {hint ? <Field.Hint /> : null}
        {rows.map((row, index) => (
          <Flex key={`delimiter-row-${index}`} gap={2} alignItems="flex-end" wrap="wrap">
            <Box width="100%" maxWidth="280px">
              <Typography variant="pi" fontWeight="bold" tag="label">
                {formatMessage({
                  id: "narration.ctb.delimiters.open",
                  defaultMessage: "Start tag",
                })}
              </Typography>
              <TextInput
                name={`${name}.${index}.open`}
                value={row.open}
                disabled={disabled}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateRow(index, { open: e.target.value })
                }
                placeholder="{{component:"
              />
            </Box>
            <Box width="100%" maxWidth="280px">
              <Typography variant="pi" fontWeight="bold" tag="label">
                {formatMessage({
                  id: "narration.ctb.delimiters.close",
                  defaultMessage: "End tag",
                })}
              </Typography>
              <TextInput
                name={`${name}.${index}.close`}
                value={row.close}
                disabled={disabled}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateRow(index, { close: e.target.value })
                }
                placeholder="}}"
              />
            </Box>
            <Button
              type="button"
              variant="secondary"
              size="S"
              disabled={disabled || index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="S"
              disabled={disabled || index === rows.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="danger-light"
              size="S"
              disabled={disabled}
              onClick={() => removeRow(index)}
            >
              <Trash />
            </Button>
          </Flex>
        ))}
        <div>
          <Button
            type="button"
            variant="secondary"
            size="S"
            startIcon={<Plus />}
            disabled={disabled}
            onClick={addRow}
          >
            {formatMessage({
              id: "narration.ctb.delimiters.add",
              defaultMessage: "Add delimiter pair",
            })}
          </Button>
        </div>
      </Flex>
    </Field.Root>
  );
};

export { NarrationCtbDelimiterPairs };
