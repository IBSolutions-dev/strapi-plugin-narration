import type { Core } from "@strapi/strapi";

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.customFields.register({
    name: "narration",
    plugin: "narration",
    type: "json",
  });
};

export default register;
