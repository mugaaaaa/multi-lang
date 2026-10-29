import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Card,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import InsightsOutlined from "@mui/icons-material/InsightsOutlined";
import type { LearningPlanStatsDto } from "@multi-lang/contracts";
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

export default function StatsPage() {
  const { activePlan, dataVersion } = useWorkspace();
  const [stats, setStats] = useState<LearningPlanStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const plan = activePlan;
    if (!plan) return;
    setLoading(true);
    setError(null);
    try {
      setStats(
        await api.get<LearningPlanStatsDto>(`/v1/plans/${plan.id}/stats`),
      );
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
  if (!stats) return null;

  const daily = fillFourteenDays(stats.daily);
  const maxReviews = Math.max(1, ...daily.map((day) => day.reviews));
  const newRatio = stats.totalCards > 0 ? (stats.newCards / stats.totalCards) * 100 : 0;
  const dueRatio = stats.totalCards > 0 ? (stats.dueCards / stats.totalCards) * 100 : 0;

  return (
    <Box className="page-frame">
      <PageHeader
        eyebrow="PROGRESS / REVIEW LOG"
        title="学习统计"
        description="所有数字都来自卡片调度状态与真实 ReviewLog；没有复习记录时保持空白，不生成演示曲线。"
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
        <MetricCard label="累计复习" value={stats.totalReviews} caption="当前计划全部评分" accent="secondary" />
        <MetricCard label="今日复习" value={stats.reviewedToday} caption="今天已完成的评分" />
        <MetricCard
          label="记忆保持率"
          value={stats.successRate === null ? "—" : `${Math.round(stats.successRate * 100)}%`}
          caption="非“忘记”评分占比"
          accent="secondary"
        />
        <MetricCard label="连续学习" value={`${stats.streakDays} 天`} caption={stats.lastReviewedAt ? `最近 ${formatDateTime(stats.lastReviewedAt)}` : "尚无复习记录"} />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.7fr 0.75fr" }, gap: 2.5 }}>
        <Card sx={{ p: { xs: 2.5, md: 3 }, minWidth: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 3 }}>
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ fontSize: 9 }}>
                LAST 14 DAYS
              </Typography>
              <Typography variant="h5">复习节奏</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">柱高表示每日评分数</Typography>
          </Stack>

          {stats.totalReviews === 0 ? (
            <EmptyState
              icon={<InsightsOutlined sx={{ fontSize: 38 }} />}
              title="还没有复习曲线"
              description="完成第一次评分后，这里会按日期呈现真实复习次数。"
            />
          ) : (
            <Box sx={{ overflowX: "auto", pb: 1 }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(14, minmax(28px, 1fr))",
                    alignItems: "end",
                    gap: 1,
                    minWidth: 560,
                    height: 240,
                    pt: 3,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  {daily.map((day) => (
                    <Tooltip
                      key={day.date}
                      title={`${day.date} · ${day.reviews} 次复习 · ${day.successful} 次非忘记`}
                    >
                      <Stack alignItems="center" justifyContent="flex-end" sx={{ height: "100%" }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontSize: 9 }}>
                          {day.reviews || ""}
                        </Typography>
                        <Box
                          sx={{
                            width: "70%",
                            minHeight: day.reviews > 0 ? 5 : 1,
                            height: `${Math.max(2, (day.reviews / maxReviews) * 78)}%`,
                            maxHeight: "78%",
                            borderRadius: "5px 5px 1px 1px",
                            backgroundColor: day.reviews > 0 ? "secondary.main" : "divider",
                            opacity: day.reviews > 0 ? 0.45 + 0.55 * (day.successful / day.reviews) : 1,
                            transition: "height 300ms ease",
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, fontSize: 9 }}>
                          {day.label}
                        </Typography>
                      </Stack>
                    </Tooltip>
                  ))}
                </Box>
            </Box>
          )}
        </Card>

        <Card sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontSize: 9 }}>
            MEMORY INVENTORY
          </Typography>
          <Typography variant="h5" sx={{ mb: 3 }}>记忆库概况</Typography>
          <Stack spacing={3}>
            <Box>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="body2">新卡片</Typography>
                <Typography variant="body2" color="text.secondary">{stats.newCards} / {stats.totalCards}</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={newRatio} color="secondary" />
            </Box>
            <Box>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="body2">当前到期</Typography>
                <Typography variant="body2" color="text.secondary">{stats.dueCards} / {stats.totalCards}</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={dueRatio} color="primary" />
            </Box>
            <Box sx={{ pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.85 }}>
                记忆库共 {stats.totalCards} 张卡片。到期队列只包含已经到达复习时间的卡片，未来任务不会提前计入。
              </Typography>
            </Box>
          </Stack>
        </Card>
      </Box>
    </Box>
  );
}

function fillFourteenDays(days: LearningPlanStatsDto["daily"]) {
  const values = new Map(days.map((day) => [day.date, day]));
  const cursor = new Date();
  cursor.setUTCDate(cursor.getUTCDate() - 13);
  return Array.from({ length: 14 }, (_, index) => {
    const date = cursor.toISOString().slice(0, 10);
    const value = values.get(date);
    const label = `${cursor.getUTCMonth() + 1}/${cursor.getUTCDate()}`;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    return {
      date,
      reviews: value?.reviews ?? 0,
      successful: value?.successful ?? 0,
      label: index === 13 ? "今天" : label,
    };
  });
}
