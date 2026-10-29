import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useWorkspace } from "../state/WorkspaceContext";

export function PlanComposer() {
  const {
    languages,
    composerOpen,
    closePlanComposer,
    createPlan,
  } = useWorkspace();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (composerOpen) {
      setTitle("");
      setLanguage(languages[0]?.language ?? "");
      setError(null);
    }
  }, [composerOpen, languages]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await createPlan({ title: title.trim(), language });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={composerOpen}
      onClose={busy ? undefined : closePlanComposer}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle component="div" sx={{ px: 3.5, pt: 3.5, pb: 1 }}>
        <Typography variant="overline" color="primary">
          NEW LEARNING PLAN
        </Typography>
        <Typography variant="h4" component="h2" sx={{ mt: 0.5 }}>
          开始一段新的学习
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ px: 3.5 }}>
        <Stack spacing={2.5} sx={{ pt: 1.5 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            autoFocus
            label="计划名称"
            placeholder="例如：日语 N4 核心词汇"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && title.trim() && language && !busy) {
                void submit();
              }
            }}
            inputProps={{ maxLength: 200 }}
            fullWidth
          />
          <TextField
            select
            label="学习语言"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            helperText="可用语言由服务端语言插件注册"
            fullWidth
          >
            {languages.map((item) => (
              <MenuItem key={item.language} value={item.language}>
                <Box
                  component="span"
                  sx={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "primary.main",
                    mr: 1.5,
                  }}
                />
                {item.displayName}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3.5, pb: 3.5, pt: 2 }}>
        <Button onClick={closePlanComposer} disabled={busy}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={busy || !title.trim() || !language}
        >
          {busy ? "正在创建…" : "创建学习计划"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
