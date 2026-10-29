import { lazy } from "react";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import StyleOutlined from "@mui/icons-material/StyleOutlined";
import ManageSearchOutlined from "@mui/icons-material/ManageSearchOutlined";
import InsightsOutlined from "@mui/icons-material/InsightsOutlined";
import type { WebPluginRegistry } from "./registry";
import type { WebPluginContribution } from "./types";
import {
  NewPlanHeaderAction,
  SearchHeaderAction,
} from "../components/HeaderActions";

const builtinLearning: WebPluginContribution = {
  manifest: {
    id: "multi-lang.builtin.learning",
    version: "0.2.0",
    apiVersion: 1,
    kind: "builtin",
  },
  routes: [
    {
      id: "builtin.today",
      path: "/",
      component: lazy(() => import("../features/today/TodayPage")),
    },
    {
      id: "builtin.library",
      path: "/library",
      component: lazy(() => import("../features/library/LibraryPage")),
    },
    {
      id: "builtin.review",
      path: "/review",
      component: lazy(() => import("../features/review/ReviewPage")),
    },
    {
      id: "builtin.search",
      path: "/search",
      component: lazy(() => import("../features/search/SearchPage")),
    },
    {
      id: "builtin.stats",
      path: "/stats",
      component: lazy(() => import("../features/stats/StatsPage")),
    },
  ],
  sidebarItems: [
    {
      id: "builtin.nav.today",
      routeId: "builtin.today",
      label: "今日学习",
      icon: <HomeOutlined fontSize="small" />,
      section: "learning",
      order: 10,
    },
    {
      id: "builtin.nav.review",
      routeId: "builtin.review",
      label: "记忆复习",
      icon: <StyleOutlined fontSize="small" />,
      section: "learning",
      order: 20,
    },
    {
      id: "builtin.nav.library",
      routeId: "builtin.library",
      label: "教材工坊",
      icon: <MenuBookOutlined fontSize="small" />,
      section: "content",
      order: 10,
    },
    {
      id: "builtin.nav.search",
      routeId: "builtin.search",
      label: "混合检索",
      icon: <ManageSearchOutlined fontSize="small" />,
      section: "tools",
      order: 10,
    },
    {
      id: "builtin.nav.stats",
      routeId: "builtin.stats",
      label: "学习统计",
      icon: <InsightsOutlined fontSize="small" />,
      section: "tools",
      order: 20,
    },
  ],
  headerActions: [
    { id: "builtin.action.search", order: 10, component: SearchHeaderAction },
    { id: "builtin.action.new-plan", order: 20, component: NewPlanHeaderAction },
  ],
};

export function registerBuiltinContributions(registry: WebPluginRegistry) {
  registry.register(builtinLearning);
}
