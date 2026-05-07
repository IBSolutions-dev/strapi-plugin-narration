import { Microphone } from "@strapi/icons";
import { Initializer } from "./components/Initializer";
import { PluginIcon } from "./components/PluginIcon";
import { NarrationCtbDefaultVoice } from "./ctb/NarrationCtbDefaultVoice";
import { NarrationCtbDelimiterPairs } from "./ctb/NarrationCtbDelimiterPairs";
import { NarrationCtbSources } from "./ctb/NarrationCtbSources";
import { narrationCustomFieldFormOptions } from "./narrationCtbOptions";
import { PLUGIN_ID } from "./pluginId";

const CTB_PLUGIN_ID = "content-type-builder";

type ContentTypeBuilderPluginApi = {
  apis?: {
    forms?: {
      components?: {
        add: (args: { id: string; component: React.ComponentType<unknown> }) => void;
      };
    };
  };
};

type StrapiAdminApp = {
  getPlugin?: (pluginId: string) => ContentTypeBuilderPluginApi | undefined;
  customFields: {
    register: (args: {
      name: string;
      pluginId: string;
      type: string;
      intlLabel: { id: string; defaultMessage: string };
      intlDescription: { id: string; defaultMessage: string };
      icon: unknown;
      components: { Input: () => Promise<unknown> };
      options: unknown;
    }) => void;
  };
  addMenuLink: (args: {
    to: string;
    icon: React.ComponentType;
    intlLabel: { id: string; defaultMessage: string };
    Component: () => Promise<React.ComponentType>;
  }) => void;
  registerPlugin: (args: {
    id: string;
    initializer: React.ComponentType<{ setPlugin: (id: string) => void }>;
    isReady: boolean;
    name: string;
  }) => void;
};

export default {
  register(app: StrapiAdminApp) {
    const ctb = app.getPlugin?.(CTB_PLUGIN_ID);
    ctb?.apis?.forms?.components?.add({
      id: "narration-ctb-default-voice",
      component: NarrationCtbDefaultVoice as React.ComponentType<unknown>,
    });
    ctb?.apis?.forms?.components?.add({
      id: "narration-ctb-sources",
      component: NarrationCtbSources as React.ComponentType<unknown>,
    });
    ctb?.apis?.forms?.components?.add({
      id: "narration-ctb-strip-delimiters",
      component: NarrationCtbDelimiterPairs as React.ComponentType<unknown>,
    });

    app.customFields.register({
      name: "narration",
      pluginId: PLUGIN_ID,
      type: "json",
      intlLabel: {
        id: `${PLUGIN_ID}.customField.label`,
        defaultMessage: "Narration",
      },
      intlDescription: {
        id: `${PLUGIN_ID}.customField.description`,
        defaultMessage:
          "Configure sources and required default voice in Content-Type Builder; connect narration by generating audio or choosing Media Library MP3.",
      },
      icon: Microphone,
      components: {
        // Strapi resolves `modules[index].default` after awaiting Input() — use default export.
        Input: async () => import("./components/NarrationFieldInput"),
      },
      options: narrationCustomFieldFormOptions,
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: "Narration",
      },
      Component: async () => {
        const { App } = await import("./pages/App");

        return App;
      },
    });

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(`./translations/${locale}.json`);

          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};
