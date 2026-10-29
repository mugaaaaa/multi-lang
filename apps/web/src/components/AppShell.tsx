import { Suspense, useMemo, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import MenuOutlined from "@mui/icons-material/MenuOutlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import type { WebPluginContribution } from "../extensions/types";
import { useWorkspace } from "../state/WorkspaceContext";
import { ErrorState, PageLoading } from "./Common";
import { PlanComposer } from "./PlanComposer";

const drawerWidth = 248;
const sectionLabels = {
  learning: "学习",
  content: "内容",
  tools: "工具",
} as const;

export function AppShell({
  contributions,
}: {
  contributions: WebPluginContribution[];
}) {
  const {
    plans,
    activePlan,
    loading,
    error,
    selectPlan,
    refreshWorkspace,
    displayLanguage,
    openPlanComposer,
  } = useWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const visibleContributions = useMemo(
    () =>
      contributions.filter(
        (contribution) =>
          !contribution.language ||
          contribution.language === activePlan?.language,
      ),
    [activePlan?.language, contributions],
  );
  const routes = useMemo(
    () => visibleContributions.flatMap((item) => item.routes ?? []),
    [visibleContributions],
  );
  const sidebarItems = useMemo(
    () => visibleContributions.flatMap((item) => item.sidebarItems ?? []),
    [visibleContributions],
  );
  const headerActions = useMemo(
    () =>
      visibleContributions
        .flatMap((item) => item.headerActions ?? [])
        .sort((a, b) => a.order - b.order),
    [visibleContributions],
  );

  const navigation = (closeAfterNavigate: boolean) => (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 3, pb: 3.5 }}>
        <Box
          sx={{
            display: "grid",
            placeItems: "center",
            width: 38,
            height: 38,
            borderRadius: "11px 11px 11px 3px",
            color: "primary.contrastText",
            backgroundColor: "primary.main",
            fontFamily: '"Noto Serif SC Variable", serif',
            fontSize: 21,
            fontWeight: 650,
          }}
        >
          文
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 720, letterSpacing: "0.02em" }}>
            学习工作台
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
            MULTI-LANG / STUDY DESK
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ flex: 1, overflowY: "auto", px: 1.5 }}>
        {(Object.keys(sectionLabels) as Array<keyof typeof sectionLabels>).map(
          (section) => {
            const items = sidebarItems
              .filter((item) => item.section === section)
              .sort((a, b) => a.order - b.order);
            if (items.length === 0) return null;
            return (
              <Box key={section} sx={{ mb: 2.5 }}>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ display: "block", px: 1.5, mb: 0.75, fontSize: 9 }}
                >
                  {sectionLabels[section]}
                </Typography>
                <List disablePadding>
                  {items.map((item) => {
                    const route = routes.find((candidate) => candidate.id === item.routeId);
                    if (!route) return null;
                    const selected = location.pathname === route.path;
                    return (
                      <ListItemButton
                        key={item.id}
                        selected={selected}
                        onClick={() => {
                          navigate(route.path);
                          if (closeAfterNavigate) setMobileOpen(false);
                        }}
                        sx={{
                          minHeight: 44,
                          borderRadius: 2,
                          mb: 0.4,
                          color: selected ? "primary.main" : "text.secondary",
                          "&.Mui-selected": {
                            backgroundColor: "rgba(173,67,47,0.085)",
                            "&:hover": { backgroundColor: "rgba(173,67,47,0.12)" },
                          },
                          "& .MuiListItemIcon-root": {
                            minWidth: 36,
                            color: "inherit",
                          },
                        }}
                      >
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 650 : 500 }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Box>
            );
          },
        )}
      </Box>

      {activePlan && (
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2.5,
              color: "#edf3ee",
              backgroundColor: "#293d36",
              backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.055), transparent)",
            }}
          >
            <Typography variant="overline" sx={{ color: "#a9c0b4", fontSize: 9 }}>
              当前学习语言
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.5, mb: 0.25 }}>
              {displayLanguage(activePlan.language)}
            </Typography>
            <Typography variant="caption" sx={{ color: "#b8c9c0" }}>
              {activePlan.language.toUpperCase()} · {activePlan.title}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: drawerWidth, backgroundColor: "#f8f6f0" },
        }}
      >
        {navigation(true)}
      </Drawer>
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid rgba(45,55,47,0.1)",
            backgroundColor: "rgba(248,246,240,0.88)",
          },
        }}
      >
        {navigation(false)}
      </Drawer>

      <Box sx={{ ml: { md: `${drawerWidth}px` } }}>
        <AppBar
          position="sticky"
          color="transparent"
          elevation={0}
          sx={{
            top: 0,
            zIndex: (theme) => theme.zIndex.drawer + 1,
            borderBottom: "1px solid rgba(45,55,47,0.09)",
            backgroundColor: "rgba(242,239,232,0.82)",
            backdropFilter: "blur(18px)",
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 64, md: 72 }, px: { xs: 2, md: 4 }, gap: 1 }}>
            <IconButton
              aria-label="打开导航"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { md: "none" } }}
            >
              <MenuOutlined />
            </IconButton>
            <Box sx={{ flex: 1 }}>
              <Select
                aria-label="切换学习计划"
                size="small"
                displayEmpty
                value={activePlan?.id ?? ""}
                onChange={(event) => selectPlan(event.target.value)}
                disabled={plans.length === 0}
                variant="standard"
                disableUnderline
                renderValue={() => activePlan?.title ?? "选择学习计划"}
                sx={{
                  maxWidth: { xs: 170, sm: 300 },
                  fontWeight: 620,
                  "& .MuiSelect-select": { py: 1 },
                }}
              >
                {plans.map((plan) => (
                  <MenuItem key={plan.id} value={plan.id}>
                    <Stack>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {plan.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {displayLanguage(plan.language)}
                      </Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </Box>
            <Stack direction="row" spacing={0.75} alignItems="center">
              {headerActions.map((action) => {
                const Action = action.component;
                return <Action key={action.id} />;
              })}
            </Stack>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            width: "100%",
            maxWidth: 1440,
            mx: "auto",
            px: { xs: 2, sm: 3, md: 4, lg: 5 },
            py: { xs: 3, md: 5 },
            boxSizing: "border-box",
          }}
        >
          {loading ? (
            <PageLoading />
          ) : error ? (
            <ErrorState message={error} retry={() => void refreshWorkspace()} />
          ) : activePlan ? (
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          ) : (
            <Stack
              direction={{ xs: "column", md: "row" }}
              alignItems="center"
              spacing={{ xs: 4, md: 8 }}
              sx={{ minHeight: "calc(100vh - 190px)", py: 4 }}
            >
              <Box sx={{ flex: 1, maxWidth: 620 }}>
                <Typography variant="overline" color="primary">
                  A QUIET PLACE TO LEARN
                </Typography>
                <Typography
                  variant="h1"
                  sx={{ fontSize: { xs: 38, md: 58 }, lineHeight: 1.25, my: 2 }}
                >
                  让每一次学习，
                  <br />
                  都有迹可循。
                </Typography>
                <Typography color="text.secondary" sx={{ lineHeight: 1.9, mb: 3.5 }}>
                  导入真实教材，整理笔记与卡片，在恰好的时间复习。选择一个语言插件，建立你的第一个学习计划。
                </Typography>
                <Button
                  size="large"
                  variant="contained"
                  endIcon={<ArrowForwardOutlined />}
                  onClick={openPlanComposer}
                >
                  创建学习计划
                </Button>
              </Box>
              <Box
                aria-hidden
                sx={{
                  display: "grid",
                  placeItems: "center",
                  flex: 1,
                  width: "100%",
                  minHeight: 320,
                  border: "1px solid rgba(45,55,47,0.1)",
                  borderRadius: "48% 48% 16px 16px",
                  color: "rgba(49,95,89,0.13)",
                  backgroundColor: "rgba(251,250,246,0.5)",
                  fontFamily: '"Noto Serif SC Variable", serif',
                  fontSize: { xs: 150, md: 210 },
                  fontWeight: 600,
                }}
              >
                学
              </Box>
            </Stack>
          )}
        </Box>
      </Box>
      <PlanComposer />
    </Box>
  );
}
