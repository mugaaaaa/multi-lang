import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import StyleOutlined from "@mui/icons-material/StyleOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import { useNavigate } from "react-router-dom";
import type {
  DueCardDto,
  LearningPlanStatsDto,
  SourceDocumentSummaryDto,
} from "@multi-lang/contracts";
import { api } from "../../lib/api";
import { useWorkspace } from "../../state/WorkspaceContext";
import {
  EmptyState,
  ErrorState,
  MetricCard,
  PageHeader,
  PageLoading,
  formatDateTime,
} from "../../components/Common";

export default function TodayPage() {
  const { activePlan, dataVersion, displayLanguage } = useWorkspace();
  const [stats, setStats] = useState<LearningPlanStatsDto | null>(null);
  const [dueCards, setDueCards] = useState<DueCardDto[]>([]);
  const [documents, setDocuments] = useState<SourceDocumentSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const plan = activePlan;
    if (!plan) return;
    setLoading(true);
    setError(null);
    try {
      const [nextStats, nextDueCards, nextDocuments] = await Promise.all([
        api.get<LearningPlanStatsDto>(`/v1/plans/${plan.id}/stats`),
        api.get<DueCardDto[]>(`/v1/plans/${plan.id}/due-cards?limit=6`),
        api.get<SourceDocumentSummaryDto[]>(
          `/v1/plans/${plan.id}/source-documents`,
        ),
      ]);
      setStats(nextStats);
      setDueCards(nextDueCards);
      setDocuments(nextDocuments);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [activePlan, dataVersion]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <PageLoading />;
  if (error) return <ErrorState message={error} retry={() => void load()} />;
  if (!activePlan || !stats) return null;

  const today = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  return (
    <Box className="page-frame">
      <PageHeader
        eyebrow={`TODAY / ${today}`}
        title="今日学习"
        description={`${activePlan.title} · ${displayLanguage(activePlan.language)}。先处理到期记忆，再回到教材补充新的内容。`}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.55fr 1fr" },
          gap: 2.5,
          mb: 4,
        }}
      >
        <Card
          sx={{
            position: "relative",
            overflow: "hidden",
            minHeight: 310,
            p: { xs: 3, md: 4 },
            color: "#f3f5ef",
            backgroundColor: "#293d36",
            border: "none",
            "&::after": {
              content: '"記"',
              position: "absolute",
              right: { xs: -8, md: 18 },
              bottom: -58,
              color: "rgba(255,255,255,0.045)",
              fontFamily: '"Noto Serif SC Variable", serif',
              fontSize: 230,
              lineHeight: 1,
            },
          }}
        >
          <Stack sx={{ position: "relative", zIndex: 1, height: "100%" }} spacing={3}>
            <Box>
              <Chip
                label="FSRS 到期队列"
                size="small"
                sx={{ color: "#dce9df", backgroundColor: "rgba(255,255,255,0.09)" }}
              />
              <Typography
                variant="h1"
                sx={{ fontSize: { xs: 54, md: 72 }, lineHeight: 1.1, mt: 3 }}
              >
                {stats.dueCards}
                <Box component="span" sx={{ fontSize: 22, ml: 1.5, fontFamily: '"Noto Sans SC Variable", sans-serif' }}>
                  张待复习
                </Box>
              </Typography>
              <Typography sx={{ color: "#b8c9c0", mt: 1.5, lineHeight: 1.8 }}>
                {stats.dueCards > 0
                  ? `下一张是「${dueCards[0]?.front ?? "已到期卡片"}」。短时、专注地完成这一轮。`
                  : "当前没有到期卡片，可以导入新教材或查看学习统计。"}
              </Typography>
            </Box>
            <Box sx={{ mt: "auto" }}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                endIcon={<ArrowForwardOutlined />}
                onClick={() => navigate("/review")}
              >
                {stats.dueCards > 0 ? "开始本轮复习" : "查看复习队列"}
              </Button>
            </Box>
          </Stack>
        </Card>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(3, 1fr)", lg: "1fr" },
            gap: 2,
          }}
        >
          <MetricCard label="记忆库" value={stats.totalCards} caption={`${stats.newCards} 张新卡片`} accent="secondary" />
          <MetricCard label="今日已复习" value={stats.reviewedToday} caption="来自真实 ReviewLog" />
          <MetricCard label="连续学习" value={`${stats.streakDays} 天`} caption={stats.lastReviewedAt ? `最近 ${formatDateTime(stats.lastReviewedAt)}` : "等待第一次复习"} accent="secondary" />
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.6fr 0.8fr" },
          gap: 2.5,
        }}
      >
        <Card sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ fontSize: 9 }}>
                RECENT MATERIALS
              </Typography>
              <Typography variant="h5">最近教材</Typography>
            </Box>
            <Button size="small" onClick={() => navigate("/library")}>全部教材</Button>
          </Stack>
          {documents.length === 0 ? (
            <EmptyState
              icon={<MenuBookOutlined sx={{ fontSize: 34 }} />}
              title="还没有发布教材"
              description="从一份真实 Markdown 教材开始，解析、校订并发布后，这里会显示内容。"
              action={<Button variant="outlined" onClick={() => navigate("/library")}>导入教材</Button>}
            />
          ) : (
            <Stack divider={<Divider flexItem />}>
              {documents.slice(0, 4).map((document) => (
                <Stack
                  key={document.id}
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  sx={{ py: 1.75 }}
                >
                  <Box sx={{ color: "secondary.main" }}><MenuBookOutlined /></Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 620 }}>{document.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {document.noteCount} 条笔记 · {document.cardCount} 张卡片
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                    {formatDateTime(document.updatedAt)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Card>

        <Card sx={{ p: { xs: 2.5, md: 3 }, backgroundColor: "rgba(251,250,246,0.66)" }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontSize: 9 }}>
            NEXT ACTION
          </Typography>
          <Typography variant="h5" sx={{ mb: 2.5 }}>继续建设记忆库</Typography>
          <Stack spacing={1.5}>
            <Button variant="outlined" color="secondary" startIcon={<MenuBookOutlined />} onClick={() => navigate("/library")} sx={{ justifyContent: "flex-start" }}>
              导入并校订教材
            </Button>
            <Button variant="outlined" color="secondary" startIcon={<StyleOutlined />} onClick={() => navigate("/stats")} sx={{ justifyContent: "flex-start" }}>
              查看学习节奏
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3, lineHeight: 1.8 }}>
            当前已有 {documents.length} 份教材。检索与复习都基于已发布的真实内容。
          </Typography>
        </Card>
      </Box>
    </Box>
  );
}
