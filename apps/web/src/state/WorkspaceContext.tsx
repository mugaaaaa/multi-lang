import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  CreateLearningPlanInput,
  LanguageCode,
  LanguageDescriptor,
  LearningPlanDto,
} from "@multi-lang/contracts";
import { api } from "../lib/api";

const ACTIVE_PLAN_KEY = "multi-lang.active-plan";

interface WorkspaceContextValue {
  languages: LanguageDescriptor[];
  plans: LearningPlanDto[];
  activePlan: LearningPlanDto | null;
  loading: boolean;
  error: string | null;
  dataVersion: number;
  composerOpen: boolean;
  selectPlan: (planId: string) => void;
  createPlan: (input: CreateLearningPlanInput) => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  notifyDataChanged: () => void;
  displayLanguage: (language: LanguageCode) => string;
  openPlanComposer: () => void;
  closePlanComposer: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [languages, setLanguages] = useState<LanguageDescriptor[]>([]);
  const [plans, setPlans] = useState<LearningPlanDto[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);

  const refreshWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextLanguages, nextPlans] = await Promise.all([
        api.get<LanguageDescriptor[]>("/v1/languages"),
        api.get<LearningPlanDto[]>("/v1/plans"),
      ]);
      setLanguages(nextLanguages);
      setPlans(nextPlans);
      setActivePlanId((current) => {
        const preferred = current ?? localStorage.getItem(ACTIVE_PLAN_KEY);
        return nextPlans.some((plan) => plan.id === preferred)
          ? preferred
          : (nextPlans[0]?.id ?? null);
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshWorkspace();
  }, [refreshWorkspace]);

  const activePlan = useMemo(
    () => plans.find((plan) => plan.id === activePlanId) ?? null,
    [activePlanId, plans],
  );

  useEffect(() => {
    if (activePlanId) {
      localStorage.setItem(ACTIVE_PLAN_KEY, activePlanId);
    } else {
      localStorage.removeItem(ACTIVE_PLAN_KEY);
    }
  }, [activePlanId]);

  const selectPlan = useCallback((planId: string) => {
    setActivePlanId(planId);
  }, []);

  const createPlan = useCallback(async (input: CreateLearningPlanInput) => {
    const created = await api.post<LearningPlanDto>("/v1/plans", input);
    setPlans((current) => [
      created,
      ...current.filter((plan) => plan.id !== created.id),
    ]);
    setActivePlanId(created.id);
    setComposerOpen(false);
    setDataVersion((version) => version + 1);
  }, []);

  const displayLanguage = useCallback(
    (language: LanguageCode) =>
      languages.find((item) => item.language === language)?.displayName ??
      language,
    [languages],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      languages,
      plans,
      activePlan,
      loading,
      error,
      dataVersion,
      composerOpen,
      selectPlan,
      createPlan,
      refreshWorkspace,
      notifyDataChanged: () => setDataVersion((version) => version + 1),
      displayLanguage,
      openPlanComposer: () => setComposerOpen(true),
      closePlanComposer: () => setComposerOpen(false),
    }),
    [
      languages,
      plans,
      activePlan,
      loading,
      error,
      dataVersion,
      composerOpen,
      selectPlan,
      createPlan,
      refreshWorkspace,
      displayLanguage,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
