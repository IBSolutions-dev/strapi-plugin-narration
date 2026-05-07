import * as React from "react";
import { Field, Flex, Loader, SingleSelect, SingleSelectOption } from "@strapi/design-system";
import { useFetchClient } from "@strapi/strapi/admin";
import { useIntl } from "react-intl";

type Voice = { voice_id: string; name: string };

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

/**
 * CTB option: default ElevenLabs voice (**required** field option). Loads voices from the plugin admin API.
 */
const NarrationCtbDefaultVoice = (props: Props) => {
  const { formatMessage } = useIntl();
  const { get } = useFetchClient();
  const [voices, setVoices] = React.useState<Voice[]>([]);
  const [loading, setLoading] = React.useState(false);

  const getRef = React.useRef(get);
  getRef.current = get;
  const voicesLoadPromiseRef = React.useRef<Promise<void> | null>(null);

  const loadVoicesIfNeeded = React.useCallback(async () => {
    if (voices.length > 0) return;
    if (voicesLoadPromiseRef.current) {
      await voicesLoadPromiseRef.current;
      return;
    }
    voicesLoadPromiseRef.current = (async () => {
      setLoading(true);
      try {
        const res = await getRef.current("/narration/voices");
        const list = (res.data as { data?: Voice[] })?.data ?? [];
        setVoices(list);
      } catch {
        setVoices([]);
      } finally {
        setLoading(false);
        voicesLoadPromiseRef.current = null;
      }
    })();
    await voicesLoadPromiseRef.current;
  }, [voices.length]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) void loadVoicesIfNeeded();
    },
    [loadVoicesIfNeeded]
  );

  const label = formatMessage(props.intlLabel);
  const hint = props.description ? formatMessage(props.description) : undefined;

  const strVal =
    typeof props.value === "string" ? props.value : props.value != null ? String(props.value) : "";

  /** Show saved default in the select (options must be loaded before Radix can resolve the label). */
  React.useEffect(() => {
    if (!strVal.trim()) return;
    if (voices.length > 0) return;
    void loadVoicesIfNeeded();
  }, [strVal, voices.length, loadVoicesIfNeeded]);

  return (
    <Field.Root name={props.name} error={props.error} hint={hint}>
      <Flex direction="column" alignItems="stretch" gap={2}>
        <Field.Label>{label}</Field.Label>
        {hint ? <Field.Hint /> : null}
        <Flex gap={2} alignItems="center" wrap="wrap">
          {loading && voices.length === 0 ? (
            <Loader small>
              {formatMessage({
                id: "narration.voices.loading",
                defaultMessage: "Loading voices…",
              })}
            </Loader>
          ) : null}
        </Flex>
        <SingleSelect
          aria-label={label}
          name={props.name}
          value={strVal || undefined}
          disabled={props.disabled}
          placeholder={formatMessage(
            voices.length === 0
              ? {
                  id: "narration.voice.open-to-load",
                  defaultMessage: "Open list to load voices (no API call until then)",
                }
              : {
                  id: "narration.ctb.defaultVoice.placeholder",
                  defaultMessage: "Choose default voice",
                }
          )}
          onOpenChange={handleOpenChange}
          onChange={(v: string | number) =>
            props.onChange({
              target: { name: props.name, value: String(v) },
            })
          }
        >
          {voices.map((v) => (
            <SingleSelectOption key={v.voice_id} value={v.voice_id}>
              {v.name}
            </SingleSelectOption>
          ))}
        </SingleSelect>
      </Flex>
    </Field.Root>
  );
};

export { NarrationCtbDefaultVoice };
