import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import { useNavigate } from "react-router-dom";
import type {
  ContentBlock,
  ImportDraft,
  PublishImportResult,
  SourceDocumentSummaryDto,
} from "@multi-lang/contracts";
import { api } from "../../lib/api";
import { useWorkspace } from "../../state/WorkspaceContext";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  formatDateTime,
} from "../../components/Common";

type Draft = ImportDraft & { revision: number };

export default function LibraryPage() {
  const { activePlan, dataVersion, notifyDataChanged } = useWorkspace();
  const [filename, setFilename] = useState("lesson.md");
  const [markdown, setMarkdown] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [publishResult, setPublishResult] = useState<PublishImportResult | null>(null);
  const [documents, setDocuments] = useState<SourceDocumentSummaryDto[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadDocuments = useCallback(async () => {
    const plan = activePlan;
    if (!plan) return;
    setDocumentsLoading(true);
    try {
      const items = await api.get<SourceDocumentSummaryDto[]>(
        `/v1/plans/${plan.id}/source-documents`,
      );
      setDocuments(items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDocumentsLoading(false);
    }
  }, [activePlan, dataVersion]);

  useEffect(() => {
    setDraft(null);
    setPublishResult(null);
    setError(null);
  }, [activePlan?.id]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const parseDraft = async () => {
    if (!activePlan) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = await api.post<Draft>("/v1/imports/markdown", {
        planId: activePlan.id,
        language: activePlan.language,
        filename,
        content: markdown,
      });
      setDraft(parsed);
      setPublishResult(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!activePlan || !draft) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<PublishImportResult>(
        `/v1/imports/${draft.id}/publish`,
        {
          planId: activePlan.id,
          expectedDraftRevision: draft.revision,
        },
      );
      setPublishResult(result);
      notifyDataChanged();
      await loadDocuments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      setMarkdown(await file.text());
      setFilename(file.name);
      setDraft(null);
      setPublishResult(null);
    } catch {
      setError("无法读取所选文件，请确认它是有效的文本文件。");
    }
  };

  return (
    <Box className="page-frame">
      <PageHeader
        eyebrow="LIBRARY / IMPORT STUDIO"
        title="教材工坊"
        description="导入 Markdown，检查解析结果，返回修改或直接发布。业务内容与检索文档会在同一事务中写入。"
        action={
          <Button component="label" variant="outlined" startIcon={<UploadFileOutlined />}>
            选择 Markdown
            <input
              hidden
              type="file"
              accept=".md,.markdown,text/markdown"
              onChange={(event) => void readFile(event.target.files?.[0])}
            />
          </Button>
        }
      />

      <Stepper activeStep={publishResult ? 3 : draft ? 1 : 0} sx={{ mb: 3, maxWidth: 700 }}>
        <Step><StepLabel>导入与修改</StepLabel></Step>
        <Step><StepLabel>校订预览</StepLabel></Step>
        <Step><StepLabel>发布完成</StepLabel></Step>
      </Stepper>

      {error && <Box sx={{ mb: 2 }}><ErrorState message={error} /></Box>}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.7fr) minmax(250px, 0.65fr)" },
          gap: 2.5,
          mb: 4,
        }}
      >
        <Card sx={{ p: { xs: 2.5, md: 3 }, minWidth: 0 }}>
          {!draft ? (
            <>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label="文件名"
                  value={filename}
                  onChange={(event) => setFilename(event.target.value)}
                  size="small"
                  sx={{ width: { sm: 240 } }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    使用 `#` 标记标题；每行 `| 正面 | 背面 |` 会生成一条笔记和一张卡片。
                  </Typography>
                </Box>
              </Stack>
              <TextField
                multiline
                fullWidth
                minRows={16}
                value={markdown}
                onChange={(event) => setMarkdown(event.target.value)}
                placeholder={"# Lesson 01\n\n粘贴真实教材内容。\n\n| ocean | a large body of salt water |"}
                InputProps={{
                  sx: {
                    alignItems: "flex-start",
                    fontFamily: '"IBM Plex Mono", "SFMono-Regular", monospace',
                    fontSize: 13,
                    lineHeight: 1.8,
                    backgroundColor: "rgba(242,239,232,0.45)",
                  },
                }}
              />
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {markdown.length} 个字符 · 不在前端提供示例数据
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => void parseDraft()}
                  disabled={busy || !markdown.trim() || !filename.trim()}
                >
                  {busy ? "正在解析…" : "解析为草稿"}
                </Button>
              </Stack>
            </>
          ) : (
            <>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 2.5 }}>
                <Box>
                  <Typography variant="overline" color="secondary" sx={{ fontSize: 9 }}>
                    DRAFT / REVISION {draft.revision}
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 0.5 }}>{draft.title}</Typography>
                </Box>
                <Chip label={`${draft.notes.length} 条笔记`} color="secondary" />
              </Stack>

              {draft.warnings.map((warning) => (
                <Alert key={warning.code} severity="warning" sx={{ mb: 2 }}>
                  {warning.message}
                </Alert>
              ))}
              {publishResult && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  已发布 {publishResult.cardIds.length} 张卡片和 {publishResult.noteIds.length} 条笔记。
                </Alert>
              )}

              <Typography variant="overline" color="text.secondary" sx={{ fontSize: 9 }}>
                CONTENT PREVIEW
              </Typography>
              <Stack divider={<Divider flexItem />} sx={{ mb: 3, borderBlock: "1px solid", borderColor: "divider" }}>
                {draft.blocks.slice(0, 8).map((block) => (
                  <Box key={block.id} sx={{ py: 1.5 }}>
                    <Typography
                      sx={{
                        fontFamily: block.type === "heading" ? '"Noto Serif SC Variable", serif' : undefined,
                        fontWeight: block.type === "heading" ? 650 : 400,
                        color: block.type === "heading" ? "text.primary" : "text.secondary",
                      }}
                    >
                      {blockText(block)}
                    </Typography>
                  </Box>
                ))}
              </Stack>

              {draft.notes.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontSize: 9 }}>
                    CARD PREVIEW
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 1.5, mt: 1 }}>
                    {draft.notes.slice(0, 6).map((note, index) => (
                      <Box key={`${note.noteTypeId}-${index}`} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                        <Typography sx={{ fontWeight: 650 }}>{String(note.fields.front ?? "")}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {String(note.fields.back ?? "")}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
                <Button
                  startIcon={<ArrowBackOutlined />}
                  onClick={() => {
                    setDraft(null);
                    setPublishResult(null);
                  }}
                  disabled={busy}
                >
                  返回修改原文
                </Button>
                {publishResult ? (
                  <Button variant="contained" onClick={() => navigate("/review")}>前往复习</Button>
                ) : (
                  <Button variant="contained" onClick={() => void publish()} disabled={busy}>
                    {busy ? "正在发布…" : "确认校订并发布"}
                  </Button>
                )}
              </Stack>
            </>
          )}
        </Card>

        <Card sx={{ p: 3, backgroundColor: "#e8ece5", borderColor: "rgba(49,95,89,0.14)", height: "fit-content" }}>
          <Typography variant="overline" color="secondary" sx={{ fontSize: 9 }}>
            IMPORT NOTES
          </Typography>
          <Typography variant="h5" sx={{ mb: 2 }}>发布前检查</Typography>
          <Stack spacing={2}>
            {[
              ["01", "正文结构", "标题与段落会保留为安全 Content AST。"],
              ["02", "笔记字段", "表格行会匹配当前语言插件提供的基础 NoteType。"],
              ["03", "真实发布", "只有确认后才生成卡片与检索文档，不以预览冒充结果。"],
            ].map(([number, title, description]) => (
              <Stack key={number} direction="row" spacing={1.5}>
                <Typography variant="caption" color="primary" sx={{ pt: 0.3 }}>{number}</Typography>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 650 }}>{title}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>{description}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Card>
      </Box>

      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ fontSize: 9 }}>
          PUBLISHED LIBRARY
        </Typography>
        <Typography variant="h4" sx={{ mb: 2 }}>已发布教材</Typography>
        {documentsLoading ? (
          <Stack spacing={1}><Skeleton variant="rounded" height={72} /><Skeleton variant="rounded" height={72} /></Stack>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<MenuBookOutlined sx={{ fontSize: 36 }} />}
            title="书架还是空的"
            description="发布第一份教材后，这里会显示真实段落、笔记和卡片数量。"
          />
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>
            {documents.map((document) => (
              <Card key={document.id} sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box sx={{ p: 1.25, borderRadius: 2, color: "secondary.main", backgroundColor: "rgba(49,95,89,0.08)" }}>
                    <MenuBookOutlined />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap variant="h6">{document.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      修订 {document.currentRevision} · 更新于 {formatDateTime(document.updatedAt)}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", gap: 0.75 }}>
                      <Chip size="small" label={`${document.blockCount} 段`} variant="outlined" />
                      <Chip size="small" label={`${document.noteCount} 笔记`} variant="outlined" />
                      <Chip size="small" label={`${document.cardCount} 卡片`} variant="outlined" />
                    </Stack>
                  </Box>
                </Stack>
              </Card>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function blockText(block: ContentBlock) {
  return block.children
    .map((child) => (child.type === "text" ? child.text : ""))
    .join("");
}
