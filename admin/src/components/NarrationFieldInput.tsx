import * as React from "react";
import {
  Box,
  Button,
  Flex,
  Link,
  Loader,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from "@strapi/design-system";
import { Microphone } from "@strapi/icons";
import {
  useAuth,
  useFetchClient,
  useField,
  useForm,
  useNotification,
  useQueryParams,
  unstable_useContentManagerContext,
  unstable_useDocument,
  useStrapiApp,
} from "@strapi/strapi/admin";
import { useIntl } from "react-intl";
import styled from "styled-components";

import { PLUGIN_ID } from "../pluginId";
import { NarrationHtmlAudioPlayer } from "./NarrationHtmlAudioPlayer";
import { mergeNarrationOptions, parseNarrationFieldValue } from "../utils/mergeOptions";
import {
  getAdminBackendBaseUrl,
  postNarrationGenerateOnce,
} from "../utils/postNarrationGenerateOnce";
import {
  parseUploadFileFindOneResponse,
  resolveUploadFileAbsoluteUrl,
} from "../utils/resolveUploadFileUrl";

type Voice = { voice_id: string; name: string };

type MediaLibraryDialogProps = {
  onClose: () => void;
  onSelectAssets: (files: Array<{ id: number; mime?: string | null; name?: string }>) => void;
  allowedTypes?: string[];
  multiple?: boolean;
};

function formatGenerateErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const res = (
      error as {
        response?: {
          data?: {
            error?: {
              message?: string;
              details?: { narrationRequestId?: string };
            };
          };
        };
      }
    ).response;
    const apiMessage = res?.data?.error?.message;
    const narrationRequestId = res?.data?.error?.details?.narrationRequestId;
    if (typeof apiMessage === "string" && apiMessage.trim().length > 0) {
      if (typeof narrationRequestId === "string" && narrationRequestId.length > 0) {
        return `${apiMessage} Server log correlation id: ${narrationRequestId}`;
      }
      return apiMessage;
    }
  }
  if (error && typeof error === "object" && "message" in error) {
    const m = String((error as Error).message);
    if (m.trim().length > 0 && m !== "Unknown Server Error") return m;
  }
  return String(error);
}

type InputProps = {
  name: string;
  attribute: {
    customField?: string;
    options?: Record<string, unknown>;
  };
  disabled?: boolean;
};

const GenerateNarrationButton = styled(Button)`
  min-height: calc(
    ${({ theme }) =>
        typeof theme.sizes.button.M === "object" &&
        theme.sizes.button.M !== null &&
        "initial" in theme.sizes.button.M
          ? theme.sizes.button.M.initial
          : "4.4rem"} +
      3px
  );
  ${({ theme }) => theme.breakpoints.medium} {
    min-height: calc(
      ${({ theme }) =>
          typeof theme.sizes.button.M === "object" &&
          theme.sizes.button.M !== null &&
          "medium" in theme.sizes.button.M
            ? theme.sizes.button.M.medium
            : "3.6rem"} +
        3px
    );
  }
`;

const NarrationFieldInput = (props: InputProps) => {
  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();
  const token = useAuth("NarrationFieldInput", (auth) => auth.token);
  const { get } = useFetchClient();
  const generateInFlightRef = React.useRef(false);
  const opts = mergeNarrationOptions(
    props.attribute?.options as Parameters<typeof mergeNarrationOptions>[0]
  );

  const MediaLibraryDialogComp = useStrapiApp(
    "narration.NarrationFieldInput",
    (app) =>
      app.components["media-library"] as React.ComponentType<MediaLibraryDialogProps> | undefined
  );

  const narration = useField(props.name);
  const allValues = useForm("NarrationField.values", (s) => s.values);

  const ctx = unstable_useContentManagerContext();
  const [{ query }] = useQueryParams();

  const localeParam =
    typeof query === "object" && query !== null && "plugins.i18n.locale" in query
      ? String((query as Record<string, string>)["plugins.i18n.locale"])
      : undefined;

  const uid = ctx.contentType?.uid;
  const documentId = ctx.id;
  const isCreate = ctx.isCreatingEntry;

  const docQuery = unstable_useDocument(
    {
      documentId: documentId ?? "",
      model: ctx.model,
      collectionType: ctx.collectionType,
      params: localeParam ? { locale: localeParam } : {},
    },
    { skip: isCreate || !documentId }
  );

  const [voices, setVoices] = React.useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = React.useState(false);
  const [fileMetaLoading, setFileMetaLoading] = React.useState(false);
  const [fileMetaError, setFileMetaError] = React.useState(false);
  const [fileAbsoluteUrl, setFileAbsoluteUrl] = React.useState<string | null>(null);
  const [fileDisplayName, setFileDisplayName] = React.useState<string | null>(null);

  const getRef = React.useRef(get);
  getRef.current = get;
  const formatMessageRef = React.useRef(formatMessage);
  formatMessageRef.current = formatMessage;
  const toggleNotificationRef = React.useRef(toggleNotification);
  toggleNotificationRef.current = toggleNotification;

  /** In-flight dedupe: opening the voice list twice must not double-hit the API. */
  const voicesLoadPromiseRef = React.useRef<Promise<void> | null>(null);

  const loadVoicesIfNeeded = React.useCallback(async () => {
    if (voices.length > 0) return;
    if (voicesLoadPromiseRef.current) {
      await voicesLoadPromiseRef.current;
      return;
    }
    voicesLoadPromiseRef.current = (async () => {
      setLoadingVoices(true);
      try {
        const res = await getRef.current("/narration/voices");
        const list = (res.data as { data?: Voice[] })?.data ?? [];
        setVoices(list);
      } catch (e: unknown) {
        setVoices([]);
        const fallback = formatMessageRef.current({
          id: "narration.voices.error",
          defaultMessage:
            "Could not load voices. Check ELEVENLABS_API_KEY and API key permissions (voices_read, text_to_speech).",
        });
        const fromApi =
          e &&
          typeof e === "object" &&
          "message" in e &&
          typeof (e as { message: unknown }).message === "string"
            ? (e as { message: string }).message.trim()
            : "";
        toggleNotificationRef.current({
          type: "warning",
          message: fromApi && fromApi !== "Unknown Server Error" ? fromApi : fallback,
        });
      } finally {
        setLoadingVoices(false);
        voicesLoadPromiseRef.current = null;
      }
    })();
    await voicesLoadPromiseRef.current;
  }, [voices.length]);

  const handleVoiceSelectOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) void loadVoicesIfNeeded();
    },
    [loadVoicesIfNeeded]
  );

  const setNarrationValue = React.useCallback(
    (next: Record<string, unknown>) => {
      narration.onChange({
        target: {
          name: props.name,
          value: next,
          type: "json",
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    },
    [narration, props.name]
  );

  const parsed = parseNarrationFieldValue(narration.value);
  const effectiveVoiceId = parsed.voiceId || opts.defaultVoiceId || "";

  /** Resolve stored voice once options exist (SingleSelect only labels values that appear in children). */
  React.useEffect(() => {
    if (!effectiveVoiceId) return;
    if (voices.length > 0) return;
    void loadVoicesIfNeeded();
  }, [effectiveVoiceId, voices.length, loadVoicesIfNeeded]);

  /** Persist field default voice when the entry JSON has no `voiceId` (create + edit, before Generate). */
  React.useEffect(() => {
    const defaultId = opts.defaultVoiceId?.trim();
    if (!defaultId) return;

    const prev = parseNarrationFieldValue(narration.value);
    if (prev.voiceId?.trim()) return;

    setNarrationValue({ ...prev, voiceId: defaultId });
  }, [opts.defaultVoiceId, narration.value, setNarrationValue]);

  const handleVoiceChange = (value: string | number) => {
    const prev = parseNarrationFieldValue(narration.value);
    setNarrationValue({
      ...prev,
      voiceId: String(value),
    });
  };

  /** Clears `audioFileId` on this field; does not remove the file from the Media Library. */
  const handleDetachAudio = () => {
    const prev = parseNarrationFieldValue(narration.value);
    const vid = prev.voiceId?.trim() || opts.defaultVoiceId?.trim();
    const next: Record<string, unknown> = {};
    if (vid) next.voiceId = vid;
    setNarrationValue(next);
    toggleNotification({
      type: "info",
      message: formatMessage({
        id: "narration.audio.detach-notify",
        defaultMessage:
          "Narration audio disconnected from this entry. Save to persist. The file remains in the Media Library.",
      }),
    });
  };

  const handleManualAssetsSelected = (
    files: Array<{ id: number; mime?: string | null; name?: string }>
  ) => {
    const f = files?.[0];
    if (f?.id != null) {
      const mime = f.mime != null ? String(f.mime).toLowerCase() : "";
      if (mime && !mime.startsWith("audio/")) {
        toggleNotification({
          type: "warning",
          message: formatMessage({
            id: "narration.connect.manual.non_audio",
            defaultMessage:
              "The selected file is not an audio type. Pick an MP3 or other audio asset.",
          }),
        });
        setMediaPickerOpen(false);
        return;
      }
      const prev = parseNarrationFieldValue(narration.value);
      setNarrationValue({ ...prev, audioFileId: f.id });
    }
    setMediaPickerOpen(false);
  };

  const handleGenerate = async () => {
    if (generateInFlightRef.current) {
      return;
    }
    if (!uid || !documentId || isCreate) {
      toggleNotification({
        type: "warning",
        message: formatMessage({
          id: "narration.generate.need-save",
          defaultMessage: "Save the entry first, then generate narration.",
        }),
      });
      return;
    }
    const voiceId = effectiveVoiceId;
    if (!voiceId) {
      toggleNotification({
        type: "warning",
        message: formatMessage({
          id: "narration.generate.need-voice",
          defaultMessage: "Select a voice first.",
        }),
      });
      return;
    }
    generateInFlightRef.current = true;
    setGenerating(true);
    try {
      const postRes = await postNarrationGenerateOnce(
        {
          uid,
          documentId,
          attributeName: props.name,
          locale: localeParam ?? null,
          values: allValues ?? {},
          voiceId,
        },
        token
      );
      const narrationRequestId =
        postRes &&
        typeof postRes === "object" &&
        "data" in postRes &&
        postRes.data &&
        typeof postRes.data === "object" &&
        "data" in postRes.data &&
        postRes.data.data &&
        typeof postRes.data.data === "object" &&
        "narrationRequestId" in postRes.data.data
          ? String((postRes.data.data as { narrationRequestId: string }).narrationRequestId)
          : undefined;
      const baseOk = formatMessage({
        id: "narration.generate.ok",
        defaultMessage:
          "Narration generated. Audio is in the Media Library; file id stored on this field.",
      });
      toggleNotification({
        type: "success",
        message: narrationRequestId ? `${baseOk} Correlation id: ${narrationRequestId}` : baseOk,
      });
      await docQuery.refetch?.();
    } catch (e: unknown) {
      toggleNotification({
        type: "danger",
        message: formatGenerateErrorMessage(e),
      });
    } finally {
      generateInFlightRef.current = false;
      setGenerating(false);
    }
  };

  const mergedFromForm = parseNarrationFieldValue(
    (allValues as Record<string, unknown> | undefined)?.[props.name]
  );
  const audioFileId = mergedFromForm.audioFileId ?? parsed.audioFileId ?? undefined;

  React.useEffect(() => {
    if (audioFileId == null) {
      setFileAbsoluteUrl(null);
      setFileDisplayName(null);
      setFileMetaError(false);
      setFileMetaLoading(false);
      return;
    }
    let cancelled = false;
    setFileMetaLoading(true);
    setFileMetaError(false);
    setFileAbsoluteUrl(null);
    setFileDisplayName(null);
    (async () => {
      try {
        const res = await get(`/upload/files/${encodeURIComponent(String(audioFileId))}`);
        const meta = parseUploadFileFindOneResponse(res.data);
        if (cancelled || !meta) {
          if (!cancelled && !meta) setFileMetaError(true);
          return;
        }
        const abs = resolveUploadFileAbsoluteUrl(getAdminBackendBaseUrl(), meta);
        if (cancelled) return;
        setFileDisplayName(meta.name ?? null);
        setFileAbsoluteUrl(abs ?? null);
        if (!abs) setFileMetaError(true);
      } catch {
        if (!cancelled) setFileMetaError(true);
      } finally {
        if (!cancelled) setFileMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [audioFileId, get]);

  const sourceHint = opts.narrationSources.map((s) => s.field).join(", ");

  const MediaLibraryDialog = MediaLibraryDialogComp;

  return (
    <Box padding={4} background="neutral100" borderColor="neutral200" hasRadius>
      <Flex direction="column" alignItems="stretch" gap={3}>
        <Flex gap={2} alignItems="center">
          <Microphone />
          <Typography variant="delta" fontWeight="bold">
            {formatMessage({
              id: `${PLUGIN_ID}.customField.label`,
              defaultMessage: "Narration",
            })}
          </Typography>
        </Flex>

        {audioFileId != null ? (
          <Flex direction="column" alignItems="stretch" gap={2}>
            <Typography variant="delta" fontWeight="bold" textColor="neutral1000">
              {formatMessage({
                id: "narration.audio.connected-headline",
                defaultMessage: "Connected narration",
              })}
            </Typography>
            {fileMetaLoading ? (
              <Loader small>
                {formatMessage({
                  id: "narration.audio.loading-url",
                  defaultMessage: "Resolving file URL…",
                })}
              </Loader>
            ) : null}
            {fileMetaError ? (
              <Typography variant="omega" textColor="danger600">
                {formatMessage({
                  id: "narration.audio.url-error",
                  defaultMessage:
                    "Could not load file URL. You can still clear the stored file id from this entry with Disconnect.",
                })}
              </Typography>
            ) : null}
            <Flex gap={5} alignItems="center" wrap="wrap">
              {fileAbsoluteUrl ? (
                <Link href={fileAbsoluteUrl} isExternal>
                  {formatMessage(
                    {
                      id: "narration.audio.open-mp3",
                      defaultMessage: "Open MP3 ({name})",
                    },
                    {
                      name:
                        fileDisplayName ??
                        formatMessage({
                          id: "narration.audio.file-fallback-name",
                          defaultMessage: "asset",
                        }),
                    }
                  )}
                </Link>
              ) : null}
              <Button variant="danger-light" onClick={handleDetachAudio} disabled={props.disabled}>
                {formatMessage({
                  id: "narration.audio.disconnect",
                  defaultMessage: "Disconnect",
                })}
              </Button>
            </Flex>
            {fileAbsoluteUrl ? (
              <NarrationHtmlAudioPlayer
                src={fileAbsoluteUrl}
                fallbackText={formatMessage({
                  id: "narration.audio.no-html5-audio",
                  defaultMessage: "Your browser cannot play this audio.",
                })}
              />
            ) : null}
          </Flex>
        ) : null}

        {audioFileId != null ? (
          <Flex
            direction="column"
            alignItems="stretch"
            width="100%"
            paddingTop={4}
            paddingBottom={4}
          >
            <Box width="100%" height="1px" background="neutral200" tag="span" aria-hidden />
          </Flex>
        ) : null}

        <Typography variant="delta" fontWeight="bold" textColor="neutral1000" tag="h3">
          {formatMessage({
            id: "narration.connect.generate_section.title",
            defaultMessage: "Generate narration",
          })}
        </Typography>
        <Typography variant="omega" textColor="neutral600">
          {formatMessage(
            {
              id: "narration.panel.hint.v2",
              defaultMessage: "Source fields: {sources}",
            },
            { sources: sourceHint || "—" }
          )}
        </Typography>
        <Flex gap={2} alignItems="center" wrap="wrap">
          <Typography tag="label" variant="pi" fontWeight="bold">
            {formatMessage({
              id: "narration.voice",
              defaultMessage: "Voice",
            })}
          </Typography>
          {loadingVoices && voices.length === 0 ? (
            <Loader small>
              {formatMessage({
                id: "narration.voices.loading",
                defaultMessage: "Loading voices…",
              })}
            </Loader>
          ) : null}
        </Flex>
        <Flex gap={2} alignItems="flex-start" wrap="wrap">
          <Box width="50%" style={{ minWidth: "min(100%, 180px)" }}>
            <SingleSelect
              size="M"
              aria-label={formatMessage({
                id: "narration.voice",
                defaultMessage: "Voice",
              })}
              name={`${props.name}.voiceId`}
              value={effectiveVoiceId || undefined}
              onChange={handleVoiceChange}
              disabled={props.disabled}
              placeholder={formatMessage(
                voices.length === 0
                  ? {
                      id: "narration.voice.open-to-load",
                      defaultMessage: "Open list to load voices (no API call until then)",
                    }
                  : {
                      id: "narration.voice.placeholder",
                      defaultMessage: "Choose voice",
                    }
              )}
              onOpenChange={handleVoiceSelectOpenChange}
            >
              {voices.map((v) => (
                <SingleSelectOption key={v.voice_id} value={v.voice_id}>
                  {v.name}
                </SingleSelectOption>
              ))}
            </SingleSelect>
          </Box>
          <GenerateNarrationButton
            size="M"
            onClick={handleGenerate}
            disabled={props.disabled || generating || isCreate}
            loading={generating}
            startIcon={<Microphone />}
          >
            {formatMessage({
              id: "narration.generate",
              defaultMessage: "Generate narration",
            })}
          </GenerateNarrationButton>
        </Flex>
        <Box width="50%" style={{ minWidth: "min(100%, 180px)" }}>
          {MediaLibraryDialog ? (
            <Link
              href="#"
              isExternal={false}
              disabled={props.disabled || mediaPickerOpen}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                if (!props.disabled && !mediaPickerOpen) {
                  setMediaPickerOpen(true);
                }
              }}
            >
              {formatMessage({
                id: "narration.connect.choose_media_link",
                defaultMessage: "or choose from media library",
              })}
            </Link>
          ) : (
            <Typography variant="omega" textColor="neutral600">
              {formatMessage({
                id: "narration.connect.manual.upload_unavailable",
                defaultMessage: "Media Library is unavailable (upload plugin may be disabled).",
              })}
            </Typography>
          )}
        </Box>

        {mediaPickerOpen && MediaLibraryDialog ? (
          <MediaLibraryDialog
            multiple={false}
            allowedTypes={["audios"]}
            onClose={() => setMediaPickerOpen(false)}
            onSelectAssets={handleManualAssetsSelected}
          />
        ) : null}
      </Flex>
    </Box>
  );
};

export { NarrationFieldInput };
export default NarrationFieldInput;
