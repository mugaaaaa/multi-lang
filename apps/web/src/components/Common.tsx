import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", sm: "flex-end" }}
      spacing={2}
      sx={{ mb: { xs: 3, md: 4 } }}
    >
      <Box sx={{ maxWidth: 760 }}>
        <Typography variant="overline" color="primary" sx={{ fontSize: 11 }}>
          {eyebrow}
        </Typography>
        <Typography
          component="h1"
          variant="h2"
          sx={{ fontSize: { xs: 30, md: 40 }, mt: 0.75, mb: 1 }}
        >
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>
          {description}
        </Typography>
      </Box>
      {action}
    </Stack>
  );
}

export function PageLoading() {
  return (
    <Box sx={{ pt: 2 }}>
      <Skeleton width={110} height={22} sx={{ mb: 2 }} />
      <Skeleton width="52%" height={58} sx={{ mb: 3 }} />
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Skeleton variant="rounded" height={210} sx={{ flex: 2 }} />
        <Skeleton variant="rounded" height={210} sx={{ flex: 1 }} />
      </Stack>
    </Box>
  );
}

export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <Alert
      severity="error"
      variant="outlined"
      action={
        retry ? (
          <Button color="inherit" size="small" onClick={retry}>
            重试
          </Button>
        ) : undefined
      }
      sx={{ backgroundColor: "background.paper" }}
    >
      {message}
    </Alert>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      alignItems="center"
      spacing={1.5}
      sx={{
        py: { xs: 5, md: 7 },
        px: 3,
        textAlign: "center",
        border: "1px dashed rgba(45,55,47,0.2)",
        borderRadius: 3,
        backgroundColor: "rgba(251,250,246,0.55)",
      }}
    >
      {icon && <Box sx={{ color: "secondary.main", mb: 0.5 }}>{icon}</Box>}
      <Typography variant="h6">{title}</Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: 440, lineHeight: 1.8 }}
      >
        {description}
      </Typography>
      {action && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  );
}

export function MetricCard({
  label,
  value,
  caption,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  caption: string;
  accent?: "primary" | "secondary";
}) {
  return (
    <Card sx={{ p: 2.5, height: "100%", boxSizing: "border-box" }}>
      <Typography variant="overline" color="text.secondary" sx={{ fontSize: 9 }}>
        {label}
      </Typography>
      <Typography
        variant="h3"
        color={`${accent}.main`}
        sx={{ my: 1, fontSize: { xs: 30, md: 36 } }}
      >
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {caption}
      </Typography>
    </Card>
  );
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
