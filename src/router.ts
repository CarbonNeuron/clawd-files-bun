type Handler = (req: Request, params: Record<string, string>) => Response | Promise<Response>;
type RouteEntry = {
  method: string;
  pattern: string;
  regex: RegExp;
  paramNames: string[];
  handler: Handler;
};

const routes: RouteEntry[] = [];

export function addRoute(method: string, pattern: string, handler: Handler) {
  const paramNames: string[] = [];
  // Convert pattern to regex:
  // :param → named capture group
  // * at end → wildcard capture (rest of path)
  let regexStr = pattern
    .replace(/:([a-zA-Z_]+)/g, (_match, name) => {
      paramNames.push(name);
      return "([^/]+)";
    });

  // Handle wildcard at end of pattern
  if (regexStr.endsWith("/*")) {
    regexStr = regexStr.slice(0, -2) + "/(.+)";
    paramNames.push("*");
  } else if (regexStr.endsWith("+")) {
    // :path+ pattern — already replaced to ([^/]+), change to (.+)
    regexStr = regexStr.slice(0, -1);
    // The last param capture was ([^/]+), change it to (.+)
    const lastIdx = regexStr.lastIndexOf("([^/]+)");
    if (lastIdx !== -1) {
      regexStr = regexStr.slice(0, lastIdx) + "(.+)" + regexStr.slice(lastIdx + 7);
    }
  }

  const regex = new RegExp(`^${regexStr}$`);
  routes.push({ method: method.toUpperCase(), pattern, regex, paramNames, handler });
}

export function matchRoute(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method.toUpperCase() && route.method !== "ALL") continue;
    const match = pathname.match(route.regex);
    if (match) {
      const params: Record<string, string> = {};
      for (let i = 0; i < route.paramNames.length; i++) {
        params[route.paramNames[i]] = decodeURIComponent(match[i + 1]);
      }
      return { handler: route.handler, params };
    }
  }
  return null;
}

export function clearRoutes() {
  routes.length = 0;
}
