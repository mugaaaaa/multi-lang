import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#ad432f",
      dark: "#87311f",
      contrastText: "#fffaf4",
    },
    secondary: {
      main: "#315f59",
      contrastText: "#f7fbf8",
    },
    background: {
      default: "#f2efe8",
      paper: "#fbfaf6",
    },
    text: {
      primary: "#202723",
      secondary: "#68716a",
    },
    divider: "rgba(45, 55, 47, 0.12)",
    success: { main: "#397254" },
    warning: { main: "#a96e24" },
    error: { main: "#a43c35" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Noto Sans SC Variable", "Noto Sans SC", sans-serif',
    h1: {
      fontFamily: '"Noto Serif SC Variable", "Noto Serif SC", serif',
      fontWeight: 620,
      letterSpacing: "-0.035em",
    },
    h2: {
      fontFamily: '"Noto Serif SC Variable", "Noto Serif SC", serif',
      fontWeight: 620,
      letterSpacing: "-0.025em",
    },
    h3: {
      fontFamily: '"Noto Serif SC Variable", "Noto Serif SC", serif',
      fontWeight: 620,
      letterSpacing: "-0.02em",
    },
    h4: {
      fontFamily: '"Noto Serif SC Variable", "Noto Serif SC", serif',
      fontWeight: 600,
    },
    h5: { fontWeight: 650 },
    h6: { fontWeight: 650 },
    button: { textTransform: "none", fontWeight: 600 },
    overline: { fontWeight: 650, letterSpacing: "0.16em" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { minWidth: 320 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 9, paddingInline: 16 },
        contained: { boxShadow: "none" },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 9 } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid rgba(45, 55, 47, 0.11)",
          backgroundImage: "none",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 7, fontWeight: 550 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 18, backgroundColor: "#fbfaf6" },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 99, backgroundColor: "rgba(45,55,47,0.09)" },
      },
    },
  },
});
