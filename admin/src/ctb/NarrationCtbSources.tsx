import * as React from "react";
import {
  Box,
  Button,
  Field,
  Flex,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from "@strapi/design-system";
import { ArrowDown, ArrowUp, Plus, Trash } from "@strapi/icons";
import { useIntl } from "react-intl";
import type { NarrationSource, NarrationSourceKind } from "../../../shared/narration-field-options";
import { defaultNarrationOptions } from "../../../shared/narration-field-options";

type IntlShape = { id: string; defaultMessage: string };

type AttributeInfo = { type?: string };

/** CTB passes `attributes` as an array of `{ name, type, ... }`, not a name-keyed map. */
function attributesArrayToRecord(raw: unknown): Record<string, AttributeInfo> | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    const out: Record<string, AttributeInfo> = {};
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const a = item as { name?: string; type?: string };
      if (typeof a.name === "string" && a.name.trim()) {
        out[a.name.trim()] = { type: a.type };
      }
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, AttributeInfo>;
  }
  return undefined;
}

const SCALAR_TYPES = new Set([
  "string",
  "text",
  "richtext",
  "email",
  "uid",
  "enumeration",
  "integer",
  "biginteger",
  "decimal",
  "float",
]);

function inferKindFromStrapiType(attrType: string | undefined): NarrationSourceKind | null {
  if (!attrType) return null;
  if (attrType === "blocks") return "blocks";
  if (SCALAR_TYPES.has(attrType)) return "scalar";
  return null;
}

function narratableFieldNames(
  attributes: Record<string, AttributeInfo> | undefined,
  exclude: string
): string[] {
  if (!attributes) return [];
  return Object.entries(attributes)
    .filter(([n]) => n !== exclude)
    .filter(([, a]) => inferKindFromStrapiType(a?.type) !== null)
    .map(([n]) => n)
    .sort((a, b) => a.localeCompare(b));
}

function kindForField(
  attributes: Record<string, AttributeInfo> | undefined,
  field: string,
  fallback: NarrationSourceKind
): NarrationSourceKind {
  const t = attributes?.[field]?.type;
  return inferKindFromStrapiType(t) ?? fallback;
}

function coerceSourcesToSchema(
  sources: NarrationSource[],
  attributes: Record<string, AttributeInfo> | undefined
): NarrationSource[] {
  if (!attributes) return sources;
  return sources.map((r) => {
    const inferred = inferKindFromStrapiType(attributes[r.field]?.type);
    return inferred ? { field: r.field, kind: inferred } : r;
  });
}

type Props = {
  name: string;
  value: unknown;
  onChange: (e: { target: { name: string; value: unknown } }) => void;
  intlLabel: IntlShape;
  description?: IntlShape;
  disabled?: boolean;
  error?: string;
  contentTypeSchema?: { attributes?: unknown };
  modifiedData?: { name?: string };
};

function parseValue(raw: unknown): NarrationSource[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      const p = JSON.parse(t) as unknown;
      return parseValue(p);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const out: NarrationSource[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const field = typeof o.field === "string" ? o.field.trim() : "";
    const kind = o.kind;
    if (!field || (kind !== "scalar" && kind !== "blocks")) continue;
    out.push({ field, kind });
  }
  return out;
}

/**
 * CTB option: ordered narration sources. Kind (scalar vs blocks) is inferred from each field’s Strapi type.
 */
const NarrationCtbSources = (props: Props) => {
  const { formatMessage } = useIntl();
  const {
    name,
    value,
    onChange,
    intlLabel,
    description,
    disabled,
    error,
    contentTypeSchema,
    modifiedData,
  } = props;
  const exclude = modifiedData?.name ?? "";
  const attributes = attributesArrayToRecord(contentTypeSchema?.attributes);

  const narratable = narratableFieldNames(attributes, exclude);

  const parsed = parseValue(value);
  const baseRows = parsed.length > 0 ? parsed : defaultNarrationOptions().narrationSources;
  const rows = coerceSourcesToSchema(baseRows, attributes);

  React.useEffect(() => {
    if (!attributes) return;
    const p = parseValue(value);
    if (p.length === 0) return;
    const coerced = coerceSourcesToSchema(p, attributes);
    if (JSON.stringify(coerced) !== JSON.stringify(p)) {
      onChange({ target: { name, value: coerced } });
    }
  }, [attributes, name, onChange, value]);

  const emit = (next: NarrationSource[]) => {
    const coerced = coerceSourcesToSchema(next, attributes);
    onChange({ target: { name, value: coerced } });
  };

  const label = formatMessage(intlLabel);
  const hint = description ? formatMessage(description) : undefined;

  const updateRow = (index: number, patch: Partial<NarrationSource>) => {
    const next = rows.map((r, i) => {
      if (i !== index) return r;
      const merged = { ...r, ...patch };
      if (patch.field !== undefined) {
        merged.kind = kindForField(attributes, merged.field, r.kind);
      }
      return merged;
    });
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
    const field = narratable[0] ?? "title";
    emit([...rows, { field, kind: kindForField(attributes, field, "scalar") }]);
  };

  return (
    <Field.Root name={name} error={error} hint={hint}>
      <Flex direction="column" alignItems="stretch" gap={3}>
        <Field.Label>{label}</Field.Label>
        {hint ? <Field.Hint /> : null}
        {rows.map((row, index) => {
          const selectOptions =
            narratable.length > 0
              ? narratable.includes(row.field)
                ? narratable
                : [...narratable, row.field]
              : row.field
                ? [row.field]
                : [];
          return (
            <Flex
              key={`${index}-${row.field}-${row.kind}`}
              gap={2}
              alignItems="flex-end"
              wrap="wrap"
            >
              <Box width="100%" maxWidth="360px">
                <Typography variant="pi" fontWeight="bold" tag="label">
                  {formatMessage({
                    id: "narration.ctb.sources.field",
                    defaultMessage: "Field",
                  })}
                </Typography>
                <SingleSelect
                  name={`${name}.${index}.field`}
                  value={row.field}
                  disabled={disabled}
                  onChange={(v: string | number) => updateRow(index, { field: String(v) })}
                >
                  {selectOptions.map((f) => (
                    <SingleSelectOption key={f} value={f}>
                      {f}
                    </SingleSelectOption>
                  ))}
                </SingleSelect>
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
          );
        })}
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
              id: "narration.ctb.sources.add",
              defaultMessage: "Add source",
            })}
          </Button>
        </div>
      </Flex>
    </Field.Root>
  );
};

export { NarrationCtbSources };
