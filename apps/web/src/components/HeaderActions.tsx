import { Button, IconButton, Tooltip } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../state/WorkspaceContext";

export function SearchHeaderAction() {
  const navigate = useNavigate();
  return (
    <Tooltip title="检索教材与笔记">
      <IconButton aria-label="检索" onClick={() => navigate("/search")}>
        <SearchOutlined />
      </IconButton>
    </Tooltip>
  );
}

export function NewPlanHeaderAction() {
  const { openPlanComposer } = useWorkspace();
  return (
    <Button
      variant="contained"
      startIcon={<AddOutlined />}
      onClick={openPlanComposer}
      sx={{ whiteSpace: "nowrap" }}
    >
      新建计划
    </Button>
  );
}
