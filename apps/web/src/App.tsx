import type { ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { registerBuiltinContributions } from "./extensions/builtin";
import { WebPluginRegistry } from "./extensions/registry";
import type {
  PluginRouteContribution,
  WebPluginContribution,
} from "./extensions/types";
import { useWorkspace, WorkspaceProvider } from "./state/WorkspaceContext";

function createWebRegistry() {
  const registry = new WebPluginRegistry();
  registerBuiltinContributions(registry);
  return registry;
}

const webRegistry = createWebRegistry();
const contributions = webRegistry.list();

function ContributionRoute({
  contribution,
  route,
}: {
  contribution: WebPluginContribution;
  route: PluginRouteContribution;
}) {
  const { activePlan, loading } = useWorkspace();
  if (
    !loading &&
    contribution.language &&
    contribution.language !== activePlan?.language
  ) {
    return <Navigate to="/" replace />;
  }
  const Page = route.component as ComponentType;
  return <Page />;
}

export default function App() {
  return (
    <WorkspaceProvider>
      <Routes>
        <Route element={<AppShell contributions={contributions} />}>
          {contributions.flatMap((contribution) =>
            (contribution.routes ?? []).map((route) => (
              <Route
                key={route.id}
                path={route.path}
                element={
                  <ContributionRoute contribution={contribution} route={route} />
                }
              />
            )),
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </WorkspaceProvider>
  );
}
