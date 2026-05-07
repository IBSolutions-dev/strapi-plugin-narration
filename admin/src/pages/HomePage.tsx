import * as React from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Flex,
  Link,
  Loader,
  Main,
  SingleSelect,
  SingleSelectOption,
  Tabs,
  Typography,
} from "@strapi/design-system";
import { useAuth, useFetchClient, useNotification } from "@strapi/strapi/admin";
import { Check, Microphone } from "@strapi/icons";
import { useIntl } from "react-intl";
import styled from "styled-components";

import { NarrationHtmlAudioPlayer } from "../components/NarrationHtmlAudioPlayer";
import { getTranslation } from "../utils/getTranslation";
import { postNarrationTestTtsOnce } from "../utils/postNarrationTestTtsOnce";
import {
  ELEVENLABS_DEVELOPER_USAGE_ANALYTICS,
  OPENAI_PLATFORM_USAGE,
} from "./narrationProviderUsageUrls";

/**
 * Strapi `Tabs.*` is built on Radix UI, which sets `data-state="active"` on
 * the active trigger. Without an explicit border the active tab can blend into
 * the surrounding card background; this rule keeps it visually anchored to its
 * panel below by drawing a top + side border that connects to the content.
 */
const ProvidersTabsList = styled(Tabs.List)`
  & [role="tab"][data-state="active"] {
    /* Exact Strapi admin tab chrome per product spec (light admin). */
    border: 1px solid #32324d;
    border-bottom: none;
  }
`;

type Voice = { voice_id: string; name: string };

type ConfigurationStatusPayload = {
  apiKeyConfigured: boolean;
  modelId: string;
  staticVoiceCatalogActive: boolean;
  maxChars: number;
};

type PublicProviderRow = {
  id: string;
  label: string;
  implementationStatus: "live" | "coming_soon";
  configured: boolean;
  showInAdminTab: boolean;
};

type PluginReleaseStability = "stable" | "prerelease";

type PluginInfoPayload = {
  packageName: string;
  version: string;
  homepage: string | null;
  releaseStability: PluginReleaseStability;
};

function isPluginReleaseStability(value: unknown): value is PluginReleaseStability {
  return value === "stable" || value === "prerelease";
}

const PROVIDER_ORDER = ["elevenlabs", "openai"] as const;
type ProviderId = (typeof PROVIDER_ORDER)[number];

const DOCS_STRAPI_ENV = "https://docs.strapi.io/dev-docs/configurations/environment";
const ELEVENLABS_API_KEYS = "https://elevenlabs.io/app/settings/api-keys";

function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_ORDER as readonly string[]).includes(value);
}

function formatDemoErrorMessage(error: unknown): string {
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

const HomePage = () => {
  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();
  const token = useAuth("NarrationHomePage", (a) => a.token);
  const { get } = useFetchClient();

  const [activeTab, setActiveTab] = React.useState<ProviderId>("elevenlabs");

  const [providersPayload, setProvidersPayload] = React.useState<PublicProviderRow[]>([]);

  /** Provider tabs to render — from server (`showInAdminTab` / `config.adminProviderTabs` only). */
  const tabProviderIds = React.useMemo((): ProviderId[] => {
    if (providersPayload.length === 0) return [...PROVIDER_ORDER];
    const ids = PROVIDER_ORDER.filter((id) =>
      providersPayload.some((p) => p.id === id && p.showInAdminTab)
    );
    return ids.length > 0 ? ids : [...PROVIDER_ORDER];
  }, [providersPayload]);

  const [voices, setVoices] = React.useState<Voice[]>([]);
  const [voicesLoading, setVoicesLoading] = React.useState(true);
  const [voiceId, setVoiceId] = React.useState<string>("");
  const [testRunning, setTestRunning] = React.useState(false);
  const [audioSrc, setAudioSrc] = React.useState<string | null>(null);
  const [lastDryRun, setLastDryRun] = React.useState<boolean | null>(null);
  const [setupStatus, setSetupStatus] = React.useState<ConfigurationStatusPayload | null>(null);
  const [setupLoading, setSetupLoading] = React.useState(true);
  const [pluginInfo, setPluginInfo] = React.useState<PluginInfoPayload | null>(null);

  React.useEffect(() => {
    if (!tabProviderIds.includes(activeTab)) {
      setActiveTab(tabProviderIds[0] ?? "elevenlabs");
    }
  }, [tabProviderIds, activeTab]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await get("/narration/providers");
        const data = (res.data as { data?: PublicProviderRow[] })?.data;
        if (!cancelled && Array.isArray(data)) setProvidersPayload(data);
      } catch {
        if (!cancelled) setProvidersPayload([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await get("/narration/plugin-info");
        const data = (res.data as { data?: PluginInfoPayload })?.data;
        if (
          !cancelled &&
          data &&
          typeof data.packageName === "string" &&
          typeof data.version === "string" &&
          isPluginReleaseStability(data.releaseStability)
        ) {
          setPluginInfo({
            packageName: data.packageName,
            version: data.version,
            homepage: typeof data.homepage === "string" ? data.homepage : null,
            releaseStability: data.releaseStability,
          });
        }
      } catch {
        if (!cancelled) setPluginInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setSetupLoading(true);
      try {
        const res = await get("/narration/configuration-status");
        const data = (res.data as { data?: ConfigurationStatusPayload })?.data;
        if (!cancelled) {
          setSetupStatus(
            data &&
              typeof data.apiKeyConfigured === "boolean" &&
              typeof data.modelId === "string" &&
              typeof data.staticVoiceCatalogActive === "boolean" &&
              typeof data.maxChars === "number"
              ? data
              : null
          );
        }
      } catch {
        if (!cancelled) setSetupStatus(null);
      } finally {
        if (!cancelled) setSetupLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  React.useEffect(() => {
    if (activeTab !== "elevenlabs") {
      setVoicesLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setVoicesLoading(true);
      try {
        const res = await get("/narration/voices?provider=elevenlabs");
        const list = (res.data as { data?: Voice[] })?.data ?? [];
        if (!cancelled) setVoices(list);
      } catch {
        if (!cancelled) {
          setVoices([]);
          toggleNotification({
            type: "warning",
            message: formatMessage({
              id: getTranslation("demo.voices.error"),
              defaultMessage:
                "Could not load voices. Check ELEVENLABS_API_KEY and permissions (voices_read, text_to_speech).",
            }),
          });
        }
      } finally {
        if (!cancelled) setVoicesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get, toggleNotification, formatMessage, activeTab]);

  const providerMeta = React.useCallback(
    (id: ProviderId) => providersPayload.find((p) => p.id === id),
    [providersPayload]
  );

  const runDemo = React.useCallback(async () => {
    if (!voiceId.trim()) {
      toggleNotification({
        type: "warning",
        message: formatMessage({
          id: getTranslation("demo.need-voice"),
          defaultMessage: "Select a voice first.",
        }),
      });
      return;
    }
    setTestRunning(true);
    setAudioSrc(null);
    setLastDryRun(null);
    try {
      const { data } = await postNarrationTestTtsOnce(voiceId.trim(), token, {
        providerId: "elevenlabs",
      });
      setLastDryRun(data.dryRun);
      setAudioSrc(`data:${data.mimeType};base64,${data.audioBase64}`);
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation("demo.ok"),
          defaultMessage: "Test audio ready. Listen below.",
        }),
      });
    } catch (e) {
      toggleNotification({
        type: "warning",
        message: formatDemoErrorMessage(e),
      });
    } finally {
      setTestRunning(false);
    }
  }, [voiceId, token, toggleNotification, formatMessage]);

  const elevenLabsConnection = (
    <>
      <Typography variant="delta" fontWeight="bold">
        {formatMessage({
          id: getTranslation("setup.section.title"),
          defaultMessage: "Connection",
        })}
      </Typography>

      {setupLoading ? (
        <Flex paddingTop={4} justifyContent="flex-start">
          <Loader small>
            {formatMessage({
              id: getTranslation("setup.loading"),
              defaultMessage: "Loading connection status…",
            })}
          </Loader>
        </Flex>
      ) : setupStatus ? (
        <>
          <Flex direction="column" alignItems="stretch" gap={3} paddingTop={2}>
            <Typography variant="omega">
              <Typography tag="span" variant="omega" fontWeight="bold">
                1.{" "}
              </Typography>
              {formatMessage({
                id: getTranslation("setup.checklist.step1"),
                defaultMessage:
                  "In ElevenLabs, create an API key with Text to Speech and Voices → Read.",
              })}{" "}
              <Link href={ELEVENLABS_API_KEYS} isExternal>
                {formatMessage({
                  id: getTranslation("setup.link.elevenKeys"),
                  defaultMessage: "ElevenLabs API keys",
                })}
              </Link>
            </Typography>

            <Typography variant="omega">
              <Typography tag="span" variant="omega" fontWeight="bold">
                2.{" "}
              </Typography>
              {formatMessage({
                id: getTranslation("setup.checklist.step2"),
                defaultMessage:
                  "Set ELEVENLABS_API_KEY in the environment and pass it into narration via config/plugins.ts using env(). Restart Strapi after changes.",
              })}{" "}
              <Link href={DOCS_STRAPI_ENV} isExternal>
                {formatMessage({
                  id: getTranslation("setup.link.strapiEnv"),
                  defaultMessage: "Strapi: Environment variables",
                })}
              </Link>
            </Typography>

            <Typography variant="omega">
              <Typography tag="span" variant="omega" fontWeight="bold">
                3.{" "}
              </Typography>
              {formatMessage({
                id: getTranslation("setup.checklist.step3"),
                defaultMessage: "Confirm voices load and run the Narration test below.",
              })}
            </Typography>
          </Flex>

          <Box paddingTop={3}>
            {setupStatus.apiKeyConfigured ? (
              <Badge
                variant="success"
                size="S"
                paddingTop={2}
                paddingBottom={2}
                paddingLeft={4}
                paddingRight={4}
                role="status"
                aria-label={formatMessage({
                  id: getTranslation("setup.checklist.badge.connected"),
                  defaultMessage: "Connected",
                })}
              >
                <Flex gap={2} alignItems="center" tag="span">
                  <Check width={14} height={14} aria-hidden />
                  <Typography tag="span" variant="omega" fontWeight="bold">
                    {formatMessage({
                      id: getTranslation("setup.checklist.badge.connected"),
                      defaultMessage: "Connected",
                    })}
                  </Typography>
                </Flex>
              </Badge>
            ) : setupStatus.staticVoiceCatalogActive ? (
              <Typography variant="omega" textColor="neutral600">
                {formatMessage({
                  id: getTranslation("setup.checklist.status.catalogNoKey"),
                  defaultMessage:
                    "A static voice catalog is configured; listing voices may not call ElevenLabs. Real TTS still needs a server API key (step 2).",
                })}
              </Typography>
            ) : (
              <Alert closeLabel="Close" title="" variant="warning">
                {formatMessage({
                  id: getTranslation("setup.checklist.status.keyMissing"),
                  defaultMessage:
                    "No ElevenLabs API key detected on this server yet — finish step 2, then reload this page.",
                })}
              </Alert>
            )}
          </Box>
        </>
      ) : (
        <Box paddingTop={3}>
          <Typography variant="omega" textColor="neutral600">
            {formatMessage({
              id: getTranslation("setup.loadError"),
              defaultMessage:
                "Could not load connection status. Open the browser network tab or Strapi server logs if this persists.",
            })}
          </Typography>
        </Box>
      )}
    </>
  );

  const elevenLabsDemo = (
    <>
      <Typography variant="delta" fontWeight="bold">
        {formatMessage({
          id: getTranslation("demo.section.title"),
          defaultMessage: "Narration test",
        })}
      </Typography>
      <Box paddingTop={2}>
        <Typography variant="omega" textColor="neutral600">
          {formatMessage({
            id: getTranslation("demo.section.body"),
            defaultMessage:
              "Plays a short “Hello” sample with the same narration flow as the entry editor. Use it to confirm narration works before generating full posts.",
          })}
        </Typography>
      </Box>

      {voicesLoading ? (
        <Flex paddingTop={4} justifyContent="flex-start">
          <Loader small>Loading voices…</Loader>
        </Flex>
      ) : voices.length === 0 ? (
        <Box paddingTop={3}>
          <Alert closeLabel="Close" title="Voices" variant="warning">
            {formatMessage({
              id: getTranslation("demo.voices.empty"),
              defaultMessage:
                "No voices returned. Set ELEVENLABS_API_KEY or configure a static voice catalog in plugin config.",
            })}
          </Alert>
        </Box>
      ) : (
        <Flex direction="column" gap={2} paddingTop={4} alignItems="stretch">
          <Typography
            variant="pi"
            fontWeight="bold"
            tag="label"
            id="narration-demo-voice-label"
            htmlFor="narration-demo-voice"
          >
            {formatMessage({
              id: getTranslation("demo.voice.label"),
              defaultMessage: "Voice",
            })}
          </Typography>
          <Flex gap={2} alignItems="stretch" wrap="wrap">
            <Box width="50%" style={{ minWidth: "min(100%, 180px)" }}>
              <SingleSelect
                size="M"
                id="narration-demo-voice"
                aria-labelledby="narration-demo-voice-label"
                name="narration-demo-voice"
                placeholder={formatMessage({
                  id: getTranslation("demo.voice.placeholder"),
                  defaultMessage: "Select a voice",
                })}
                value={voiceId || undefined}
                onChange={(value: string | number) => setVoiceId(String(value))}
                disabled={testRunning}
              >
                {voices.map((v) => (
                  <SingleSelectOption key={v.voice_id} value={v.voice_id}>
                    {v.name} ({v.voice_id})
                  </SingleSelectOption>
                ))}
              </SingleSelect>
            </Box>
            <Button
              size="M"
              onClick={runDemo}
              loading={testRunning}
              disabled={!voiceId || testRunning}
              startIcon={<Microphone />}
              style={{
                boxSizing: "border-box",
                /* +2px total vertical size to align optically with SingleSelect borders. */
                paddingTop: "1px",
                paddingBottom: "1px",
              }}
            >
              {formatMessage({
                id: getTranslation("demo.button"),
                defaultMessage: 'Generate "Hello"',
              })}
            </Button>
          </Flex>
        </Flex>
      )}

      {lastDryRun === true ? (
        <Box paddingTop={3}>
          <Alert closeLabel="Close" title="Placeholder audio" variant="warning">
            {formatMessage({
              id: getTranslation("demo.dry-run"),
              defaultMessage:
                "This response used placeholder audio (development mode on the server), not live billed TTS. Ask your team or check server logs if you expected real synthesis.",
            })}
          </Alert>
        </Box>
      ) : null}

      {audioSrc ? (
        <Box paddingTop={4}>
          <NarrationHtmlAudioPlayer
            src={audioSrc}
            aria-label={formatMessage({
              id: getTranslation("demo.player.label"),
              defaultMessage: "Playback",
            })}
            fallbackText={formatMessage({
              id: getTranslation("demo.player.fallback"),
              defaultMessage: "Audio not supported in this browser.",
            })}
          />
        </Box>
      ) : null}
    </>
  );

  const openAiPlaceholder = (kind: "config" | "demo") => (
    <Box paddingTop={2}>
      <Typography variant="omega" textColor="neutral600">
        {kind === "config"
          ? formatMessage({
              id: getTranslation("providers.tab.openai.configComingSoon"),
              defaultMessage:
                "Connection details for this provider will appear here after integration. API keys will continue to be set only via environment variables and config/plugins.ts.",
            })
          : formatMessage({
              id: getTranslation("providers.tab.openai.demoComingSoon"),
              defaultMessage: "Text-to-speech testing will be available here after integration.",
            })}
      </Typography>
    </Box>
  );

  const providerUsagePanel = (id: ProviderId) => {
    const href = id === "elevenlabs" ? ELEVENLABS_DEVELOPER_USAGE_ANALYTICS : OPENAI_PLATFORM_USAGE;
    const usageBody =
      id === "elevenlabs"
        ? formatMessage({
            id: getTranslation("providers.usage.elevenlabs.body"),
            defaultMessage:
              "Open ElevenLabs to review character credits, synthesis history, and other usage analytics for your account.",
          })
        : formatMessage({
            id: getTranslation("providers.usage.openai.body"),
            defaultMessage:
              "Review API usage for your OpenAI organization. OpenAI narration support in this plugin is not live yet.",
          });

    return (
      <>
        <Typography variant="delta" fontWeight="bold">
          {formatMessage({
            id: getTranslation("providers.usage.section.title"),
            defaultMessage: "Usage",
          })}
        </Typography>
        <Box paddingTop={2}>
          <Typography variant="omega" textColor="neutral600">
            {usageBody}
          </Typography>
        </Box>
        <Box paddingTop={3}>
          <Button variant="secondary" tag="a" href={href} target="_blank" rel="noopener noreferrer">
            {formatMessage({
              id: getTranslation("providers.usage.openDashboard"),
              defaultMessage: "Open usage dashboard",
            })}
          </Button>
        </Box>
      </>
    );
  };

  const isPrerelease = pluginInfo?.releaseStability === "prerelease";

  return (
    <Main>
      <Box padding={8} paddingTop={6}>
        <Flex gap={3} alignItems="center" wrap="wrap">
          <Typography variant="alpha">
            {formatMessage({ id: getTranslation("plugin.name") })}
          </Typography>
          {isPrerelease ? (
            <Badge
              variant="secondary"
              size="S"
              paddingTop={1}
              paddingBottom={1}
              paddingLeft={3}
              paddingRight={3}
              role="status"
              aria-label={formatMessage({
                id: getTranslation("plugin.beta.aria"),
                defaultMessage: "Beta release — pre-1.0; breaking changes possible",
              })}
            >
              <Typography tag="span" variant="pi" fontWeight="bold">
                {formatMessage({
                  id: getTranslation("plugin.beta.label"),
                  defaultMessage: "Beta",
                })}
              </Typography>
            </Badge>
          ) : null}
        </Flex>
        <Box paddingTop={2} maxWidth="680px">
          <Typography variant="epsilon" textColor="neutral600">
            {formatMessage({
              id: getTranslation("plugin.description"),
              defaultMessage: "Generate narration audio for entries from configured fields.",
            })}
          </Typography>
        </Box>

        <Box
          marginTop={6}
          padding={4}
          background="neutral0"
          borderColor="neutral150"
          hasRadius
          shadow="tableShadow"
          maxWidth="840px"
        >
          <Typography variant="delta" fontWeight="bold">
            {formatMessage({
              id: getTranslation("providers.section.title"),
              defaultMessage: "Providers",
            })}
          </Typography>

          <Box paddingTop={4}>
            <Tabs.Root
              value={activeTab}
              onValueChange={(v: string) => {
                if (isProviderId(v)) setActiveTab(v);
              }}
            >
              <ProvidersTabsList aria-label="TTS providers">
                {tabProviderIds.map((id) => {
                  const meta = providerMeta(id);
                  const comingSoon = meta?.implementationStatus === "coming_soon";
                  return (
                    <Tabs.Trigger key={id} value={id}>
                      {id === "elevenlabs"
                        ? formatMessage({
                            id: getTranslation("providers.tab.elevenlabs"),
                            defaultMessage: "ElevenLabs",
                          })
                        : formatMessage({
                            id: getTranslation("providers.tab.openai"),
                            defaultMessage: "OpenAI",
                          })}
                      {comingSoon
                        ? ` — ${formatMessage({
                            id: getTranslation("providers.tab.badgeSoon"),
                            defaultMessage: "soon",
                          })}`
                        : ""}
                    </Tabs.Trigger>
                  );
                })}
              </ProvidersTabsList>

              {tabProviderIds.includes("elevenlabs") ? (
                <Tabs.Content value="elevenlabs">
                  <Box paddingTop={4}>
                    <Box padding={4} background="neutral100" borderColor="neutral150" hasRadius>
                      {elevenLabsConnection}
                    </Box>
                    <Box
                      marginTop={4}
                      padding={4}
                      background="neutral100"
                      borderColor="neutral150"
                      hasRadius
                    >
                      {elevenLabsDemo}
                    </Box>
                    <Box
                      marginTop={4}
                      padding={4}
                      background="neutral100"
                      borderColor="neutral150"
                      hasRadius
                    >
                      {providerUsagePanel("elevenlabs")}
                    </Box>
                  </Box>
                </Tabs.Content>
              ) : null}

              {tabProviderIds.includes("openai") ? (
                <Tabs.Content value="openai">
                  <Box paddingTop={4}>
                    <Box padding={4} background="neutral100" borderColor="neutral150" hasRadius>
                      <Typography variant="delta" fontWeight="bold">
                        {formatMessage({
                          id: getTranslation("setup.section.title"),
                          defaultMessage: "Connection",
                        })}
                      </Typography>
                      {openAiPlaceholder("config")}
                    </Box>
                    <Box
                      marginTop={4}
                      padding={4}
                      background="neutral100"
                      borderColor="neutral150"
                      hasRadius
                    >
                      <Typography variant="delta" fontWeight="bold">
                        {formatMessage({
                          id: getTranslation("demo.section.title"),
                          defaultMessage: "Narration test",
                        })}
                      </Typography>
                      {openAiPlaceholder("demo")}
                    </Box>
                    <Box
                      marginTop={4}
                      padding={4}
                      background="neutral100"
                      borderColor="neutral150"
                      hasRadius
                    >
                      {providerUsagePanel("openai")}
                    </Box>
                  </Box>
                </Tabs.Content>
              ) : null}
            </Tabs.Root>
          </Box>
        </Box>

        {pluginInfo ? (
          <Box
            marginTop={6}
            padding={4}
            maxWidth="840px"
            borderColor="neutral150"
            style={{ borderTopWidth: 1, borderTopStyle: "solid" }}
          >
            <Flex justifyContent="space-between" alignItems="center" gap={2} wrap="wrap">
              <Typography variant="pi" textColor="neutral500">
                {formatMessage(
                  {
                    id: isPrerelease
                      ? getTranslation("footer.version.prerelease")
                      : getTranslation("footer.version"),
                    defaultMessage: isPrerelease
                      ? "Version: {packageName} v{version} — Beta"
                      : "Version: {packageName} v{version}",
                  },
                  { packageName: pluginInfo.packageName, version: pluginInfo.version }
                )}
              </Typography>
              {pluginInfo.homepage ? (
                <Link href={pluginInfo.homepage} isExternal>
                  <Typography variant="pi" textColor="neutral500">
                    {formatMessage({
                      id: getTranslation("footer.homepage"),
                      defaultMessage: "Plugin homepage",
                    })}
                  </Typography>
                </Link>
              ) : null}
            </Flex>
          </Box>
        ) : null}
      </Box>
    </Main>
  );
};

export { HomePage };
