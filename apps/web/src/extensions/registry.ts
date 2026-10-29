import type {
  PluginRegistration,
  WebPluginContribution,
} from "./types";

export class WebPluginRegistry {
  private readonly contributions: WebPluginContribution[] = [];

  register(plugin: WebPluginContribution): PluginRegistration {
    validateContributions([...this.contributions, plugin]);
    this.contributions.push(plugin);
    return {
      dispose: () => {
        const index = this.contributions.indexOf(plugin);
        if (index >= 0) this.contributions.splice(index, 1);
      },
    };
  }

  list(): WebPluginContribution[] {
    return [...this.contributions];
  }
}

function validateContributions(contributions: WebPluginContribution[]) {
  const pluginIds = new Set<string>();
  const routeIds = new Set<string>();
  const routePaths = new Set<string>();
  const sidebarIds = new Set<string>();
  const headerActionIds = new Set<string>();
  const sidebarItems = contributions.flatMap(
    (contribution) => contribution.sidebarItems ?? [],
  );

  for (const contribution of contributions) {
    if (pluginIds.has(contribution.manifest.id)) {
      throw new Error(`Duplicate web plugin: ${contribution.manifest.id}`);
    }
    pluginIds.add(contribution.manifest.id);

    for (const route of contribution.routes ?? []) {
      if (routeIds.has(route.id) || routePaths.has(route.path)) {
        throw new Error(`Duplicate web route: ${route.id} (${route.path})`);
      }
      routeIds.add(route.id);
      routePaths.add(route.path);
    }
    for (const item of contribution.sidebarItems ?? []) {
      if (sidebarIds.has(item.id)) {
        throw new Error(`Duplicate sidebar item: ${item.id}`);
      }
      sidebarIds.add(item.id);
    }
    for (const action of contribution.headerActions ?? []) {
      if (headerActionIds.has(action.id)) {
        throw new Error(`Duplicate header action: ${action.id}`);
      }
      headerActionIds.add(action.id);
    }
  }

  for (const item of sidebarItems) {
    if (!routeIds.has(item.routeId)) {
      throw new Error(
        `Sidebar item ${item.id} references missing route ${item.routeId}`,
      );
    }
  }
}
