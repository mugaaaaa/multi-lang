import type {
  ComponentType,
  LazyExoticComponent,
  ReactNode,
} from "react";
import type { LanguageCode } from "@multi-lang/contracts";

export interface WebContributionManifest {
  id: string;
  version: string;
  apiVersion: 1;
  kind: "builtin" | "language" | "importer" | "scheduler";
}

export interface PluginRouteContribution {
  id: string;
  path: string;
  component: LazyExoticComponent<ComponentType>;
}

export interface SidebarItemContribution {
  id: string;
  routeId: string;
  label: string;
  icon?: ReactNode;
  section: "learning" | "content" | "tools";
  order: number;
}

export interface HeaderActionContribution {
  id: string;
  order: number;
  component: ComponentType;
}

export interface WebPluginContribution {
  manifest: WebContributionManifest;
  language?: LanguageCode;
  routes?: PluginRouteContribution[];
  sidebarItems?: SidebarItemContribution[];
  headerActions?: HeaderActionContribution[];
}

export interface PluginRegistration {
  dispose(): void;
}
