import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import StyleOutlined from "@mui/icons-material/StyleOutlined";
import { useNavigate } from "react-router-dom";
import type {
  DueCardDto,
  ReviewCardResult,
  ReviewRating,
} from "@multi-lang/contracts";
import { api } from "../../lib/api";
import { useWorkspace } from "../../state/WorkspaceContext";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  PageLoading,
  formatDateTime,
} from "../../components/Common";

const ratingOptions = [
  { value: "again", label: "忘记", key: "1", color: "error" },
  { value: "hard", label: "困难", key: "2", color: "warning" },
  { value: "good", label: "良好", key: "3", color: "secondary" },
  { value: "easy", label: "简单", key: "4", color: "primary" },
] as const;

export default function ReviewPage() {
  const { activePlan, notifyDataChanged } = useWorkspace();
  const [cards, setCards] = useState<DueCardDto[]>([]);
  const [showBack, setShowBack] = useState(false);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [lastResult, setLastResult] = useState<ReviewCardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const navigate = useNavigate();
  const currentCard = cards[0] ?? null;

  const load = useCallback(async () => {
    const plan = activePlan;
    if (!plan) return;
    setLoading(true);
    setError(null);
    try {
      const nextCards = await api.get<DueCardDto[]>(
        `/v1/plans/${plan.id}/due-cards?limit=50`,
      );
      setCards(nextCards);
      setSessionTotal(nextCards.length);
      setCompleted(0);
      setShowBack(false);
      setLastResult(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [activePlan]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    startedAt.current = Date.now();
  }, [currentCard?.cardId]);

  const rate = useCallback(
    async (rating: ReviewRating) => {
      if (!currentCard || busy) return;
      setBusy(true);
      setError(null);
      try {
        const result = await api.post<ReviewCardResult>("/v1/reviews", {
          cardId: currentCard.cardId,
          rating,
          durationMs: Date.now() - startedAt.current,
        });
        setLastResult(result);
        setCards((current) =>
          current.filter((card) => card.cardId !== currentCard.cardId),
        );
        setCompleted((count) => count + 1);
        setShowBack(false);
        notifyDataChanged();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setBusy(false);
      }
    },
    [busy, currentCard, notifyDataChanged],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, select") ||
        target?.isContentEditable ||
        !currentCard ||
        busy
      ) {
        return;
      }
      if (event.code === "Space" && !showBack) {
        event.preventDefault();
        setShowBack(true);
        return;
      }
      const option = ratingOptions.find((item) => item.key === event.key);
      if (showBack && option) {
        event.preventDefault();
        void rate(option.value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, currentCard, rate, showBack]);

  if (loading) return <PageLoading />;

  return (
    <Box className="page-frame" sx={{ maxWidth: 1040, mx: "auto" }}>
      <PageHeader
        eyebrow="MEMORY / FSRS SESSION"
        title="记忆复习"
        description="先回忆，再揭示答案。评分会写入真实 ReviewLog，并由 FSRS 计算下一次到期时间。"
        action={<Chip label={`剩余 ${cards.length} 张`} color="secondary" variant="outlined" />}
      />

      {error && <Box sx={{ mb: 2 }}><ErrorState message={error} /></Box>}

      {!currentCard ? (
        <EmptyState
          icon={sessionTotal > 0 ? <CheckCircleOutline sx={{ fontSize: 42 }} /> : <StyleOutlined sx={{ fontSize: 42 }} />}
          title={sessionTotal > 0 ? "本轮复习完成" : "当前没有到期卡片"}
          description={
            sessionTotal > 0
              ? `已完成 ${completed} 次真实评分。新的到期时间已经保存，可以稍后再回来。`
              : "新导入的卡片会进入队列；已经复习且尚未到期的卡片不会提前出现。"
          }
          action={
            <Stack direction="row" spacing={1.5}>
              <Button variant="outlined" onClick={() => navigate("/library")}>导入教材</Button>
              <Button variant="contained" onClick={() => navigate("/")}>返回今日学习</Button>
            </Stack>
          }
        />
      ) : (
        <>
          <Box sx={{ mb: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                本轮进度 {completed} / {sessionTotal}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {currentCard.scheduling?.state === "new" ? "新卡片" : "到期复习"}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={sessionTotal > 0 ? (completed / sessionTotal) * 100 : 0}
              color="secondary"
              sx={{ height: 4 }}
            />
          </Box>

          <Card
            className="study-card"
            sx={{
              minHeight: { xs: 370, md: 440 },
              p: { xs: 3, md: 5 },
              display: "flex",
              flexDirection: "column",
              backgroundColor: "rgba(251,250,246,0.9)",
            }}
          >
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: 9 }}>
              {showBack ? "ANSWER" : "RECALL"}
            </Typography>
            <Box
              sx={{
                flex: 1,
                display: "grid",
                placeItems: "center",
                py: 4,
                textAlign: "center",
              }}
            >
              <Typography
                variant="h2"
                sx={{
                  maxWidth: 760,
                  fontSize: { xs: 34, md: 52 },
                  lineHeight: 1.45,
                  overflowWrap: "anywhere",
                }}
              >
                {currentCard.front}
              </Typography>
            </Box>

            {showBack ? (
              <Box className="review-answer">
                <Divider sx={{ mb: 3, borderStyle: "dashed" }} />
                <Typography
                  sx={{
                    textAlign: "center",
                    fontSize: { xs: 20, md: 26 },
                    lineHeight: 1.7,
                    color: "secondary.main",
                    overflowWrap: "anywhere",
                  }}
                >
                  {currentCard.back}
                </Typography>
              </Box>
            ) : (
              <Stack alignItems="center">
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => setShowBack(true)}
                  sx={{ minWidth: 180 }}
                >
                  显示答案
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5 }}>
                  按空格键揭示
                </Typography>
              </Stack>
            )}
          </Card>

          {showBack && (
            <Box
              className="review-answer"
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
                gap: 1.5,
                mt: 2,
              }}
            >
              {ratingOptions.map((option) => (
                <Button
                  key={option.value}
                  variant="outlined"
                  color={option.color}
                  disabled={busy}
                  onClick={() => void rate(option.value)}
                  sx={{ py: 1.5, backgroundColor: "rgba(251,250,246,0.72)" }}
                >
                  <Stack>
                    <span>{option.label}</span>
                    <Box component="span" sx={{ opacity: 0.55, fontSize: 10 }}>
                      按 {option.key}
                    </Box>
                  </Stack>
                </Button>
              ))}
            </Box>
          )}

          {lastResult && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 2 }}>
              上次评分已保存 · 下次到期 {formatDateTime(lastResult.scheduling.dueAt)}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
