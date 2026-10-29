import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import ManageSearchOutlined from "@mui/icons-material/ManageSearchOutlined";
import type { SearchResultItem } from "@multi-lang/contracts";
import { api } from "../../lib/api";
import { useWorkspace } from "../../state/WorkspaceContext";
import { EmptyState, ErrorState, PageHeader } from "../../components/Common";

type SearchKind = SearchResultItem["kind"];

const kindLabels: Record<SearchKind, string> = {
  source_block: "教材段落",
  note: "学习笔记",
  example: "例句",
};

export default function SearchPage() {
  const { activePlan, displayLanguage } = useWorkspace();
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<SearchKind[]>([]);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResults([]);
    setSearched(false);
    setError(null);
  }, [activePlan?.id]);

  const search = async () => {
    if (!activePlan || !query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const items = await api.post<SearchResultItem[]>("/v1/search", {
        planId: activePlan.id,
        query: query.trim(),
        kinds: kinds.length > 0 ? kinds : undefined,
        limit: 30,
      });
      setResults(items);
      setSearched(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box className="page-frame" sx={{ maxWidth: 1080, mx: "auto" }}>
      <PageHeader
        eyebrow="SEEKDB / HYBRID RETRIEVAL"
        title="混合检索"
        description={`在「${activePlan?.title ?? "当前计划"}」中查找有来源的教材与笔记。当前使用 ${displayLanguage(activePlan?.language ?? "")} 插件提供的规范化与全文检索配置。`}
      />

      <Card sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            fullWidth
            autoFocus
            placeholder="输入原文、读音或释义"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void search();
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><SearchOutlined color="action" /></InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            size="large"
            onClick={() => void search()}
            disabled={busy || !query.trim()}
            sx={{ minWidth: 120 }}
          >
            {busy ? "检索中…" : "检索"}
          </Button>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={1.5} sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">内容类型</Typography>
          <ToggleButtonGroup
            value={kinds}
            size="small"
            onChange={(_, next: SearchKind[]) => setKinds(next)}
            aria-label="内容类型"
          >
            {(Object.keys(kindLabels) as SearchKind[]).map((kind) => (
              <ToggleButton key={kind} value={kind} sx={{ px: 1.5 }}>
                {kindLabels[kind]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary">不选择时检索全部类型</Typography>
        </Stack>
      </Card>

      {error && <Box sx={{ mb: 2 }}><ErrorState message={error} retry={() => void search()} /></Box>}

      {!searched && !busy ? (
        <EmptyState
          icon={<ManageSearchOutlined sx={{ fontSize: 40 }} />}
          title="从记忆中找出出处"
          description="检索只覆盖当前计划中已发布的真实内容。英语使用空格分词配置，日语使用对应语言插件的 ngram 配置。"
        />
      ) : searched && results.length === 0 && !busy ? (
        <EmptyState
          icon={<SearchOutlined sx={{ fontSize: 40 }} />}
          title="没有找到匹配内容"
          description="尝试更短的关键词、原文中的连续片段，或清除内容类型筛选。"
        />
      ) : (
        <Stack spacing={1.5}>
          {results.map((result, index) => (
            <Card key={result.documentId} sx={{ p: { xs: 2.5, md: 3 } }}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Typography
                  variant="caption"
                  color="primary"
                  sx={{ pt: 0.5, minWidth: 24, fontVariantNumeric: "tabular-nums" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: "wrap", gap: 0.75 }}>
                    <Chip size="small" color="secondary" label={kindLabels[result.kind]} />
                    <Typography variant="caption" color="text.secondary">
                      来源修订 {result.source.sourceRevision}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      相关度 {result.score.toFixed(3)}
                    </Typography>
                  </Stack>
                  {result.title && <Typography variant="h6" sx={{ mb: 0.75 }}>{result.title}</Typography>}
                  <Typography color="text.secondary" sx={{ lineHeight: 1.85, overflowWrap: "anywhere" }}>
                    {result.snippet}
                  </Typography>
                </Box>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
