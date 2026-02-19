import { onRequest as __api_diagnose_js_onRequest } from "/Users/kanokyo/projects/gbp/cf-mvp/functions/api/diagnose.js"

export const routes = [
    {
      routePath: "/api/diagnose",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_diagnose_js_onRequest],
    },
  ]