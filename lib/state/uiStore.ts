import { create } from "zustand";
import type { Plan } from "../../types/plan";
import type {
  GenerateRequest,
  GenerateResponse,
  ModifyRequest,
  ModifyResponse,
} from "../../types/api";

export interface UiVersion {
  id: string;
  index: number;
  timestamp: number;
  plan: Plan;
  code: string;
  explanation: string;
}

interface UiState {
  sessionId: string;
  userMessage: string;
  lastSuccessfulMessage: string;
  isLoading: boolean;
  error: string | null;
  validation: {
    componentCheck: boolean;
    propCheck: boolean;
  } | null;
  versions: UiVersion[];
  currentVersionIndex: number;
  plan: Plan | null;
  code: string;
  explanation: string;
  setUserMessage: (value: string) => void;
  setSessionId: (value: string) => void;
  generate: () => Promise<void>;
  regenerate: () => Promise<void>;
  modify: () => Promise<void>;
  rollback: () => void;
  selectVersion: (index: number) => void;
}

async function postJson<TRequest, TResponse>(
  url: string,
  payload: TRequest
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as TResponse;
  return data;
}

export const useUiStore = create<UiState>((set, get) => ({
  sessionId: "local-session",
  userMessage: "",
  lastSuccessfulMessage: "",
  isLoading: false,
  error: null,
  validation: null,
  versions: [],
  currentVersionIndex: -1,
  plan: null,
  code: "",
  explanation: "",
  setUserMessage: (value) => set({ userMessage: value }),
  setSessionId: (value) => set({ sessionId: value }),
  generate: async () => {
    const { userMessage, sessionId } = get();
    if (!userMessage.trim()) {
      set({ error: "Enter a request to generate UI." });
      return;
    }

    set({ isLoading: true, error: null });

    const payload: GenerateRequest = { userMessage, sessionId };
    try {
      const response = await postJson<GenerateRequest, GenerateResponse>(
        "/api/generate",
        payload
      );

      if (!response.success || !response.plan || !response.code || !response.explanation || !response.version) {
        set({
          isLoading: false,
          error: response.error || "Generation failed.",
          validation: response.validation ?? null,
        });
        return;
      }

      const nextIndex = get().versions.length;
      const version: UiVersion = {
        id: response.version.id,
        index: nextIndex,
        timestamp: response.version.timestamp,
        plan: response.plan,
        code: response.code,
        explanation: response.explanation,
      };

      const versions = [...get().versions, version];
      set({
        versions,
        currentVersionIndex: nextIndex,
        plan: response.plan,
        code: response.code,
        explanation: response.explanation,
        lastSuccessfulMessage: userMessage,
        validation: response.validation ?? null,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Generation failed.",
      });
    }
  },
  regenerate: async () => {
    const { userMessage, lastSuccessfulMessage, sessionId } = get();
    const message = userMessage.trim() || lastSuccessfulMessage;
    if (!message.trim()) {
      set({ error: "Enter a request to regenerate UI." });
      return;
    }

    set({ isLoading: true, error: null });

    const payload: GenerateRequest = { userMessage: message, sessionId };
    try {
      const response = await postJson<GenerateRequest, GenerateResponse>(
        "/api/generate",
        payload
      );

      if (!response.success || !response.plan || !response.code || !response.explanation || !response.version) {
        set({
          isLoading: false,
          error: response.error || "Regeneration failed.",
          validation: response.validation ?? null,
        });
        return;
      }

      const nextIndex = get().versions.length;
      const version: UiVersion = {
        id: response.version.id,
        index: nextIndex,
        timestamp: response.version.timestamp,
        plan: response.plan,
        code: response.code,
        explanation: response.explanation,
      };

      const versions = [...get().versions, version];
      set({
        versions,
        currentVersionIndex: nextIndex,
        plan: response.plan,
        code: response.code,
        explanation: response.explanation,
        lastSuccessfulMessage: message,
        validation: response.validation ?? null,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Regeneration failed.",
      });
    }
  },
  modify: async () => {
    const { userMessage, sessionId, versions, currentVersionIndex } = get();
    if (!userMessage.trim()) {
      set({ error: "Enter a request to modify UI." });
      return;
    }

    const currentVersion = versions[currentVersionIndex];
    if (!currentVersion) {
      set({ error: "No version available to modify." });
      return;
    }

    set({ isLoading: true, error: null });

    const payload: ModifyRequest = {
      userMessage,
      sessionId,
      currentVersion: {
        id: currentVersion.id,
        plan: currentVersion.plan,
        code: currentVersion.code,
      },
    };

    try {
      const response = await postJson<ModifyRequest, ModifyResponse>(
        "/api/modify",
        payload
      );

      if (!response.success || !response.plan || !response.code || !response.explanation || !response.version) {
        set({
          isLoading: false,
          error: response.error || "Modification failed.",
          validation: response.validation ?? null,
        });
        return;
      }

      const nextIndex = versions.length;
      const version: UiVersion = {
        id: response.version.id,
        index: nextIndex,
        timestamp: response.version.timestamp,
        plan: response.plan,
        code: response.code,
        explanation: response.explanation,
      };

      const nextVersions = [...versions, version];
      set({
        versions: nextVersions,
        currentVersionIndex: nextIndex,
        plan: response.plan,
        code: response.code,
        explanation: response.explanation,
        lastSuccessfulMessage: userMessage,
        validation: response.validation ?? null,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Modification failed.",
      });
    }
  },
  rollback: () => {
    const { currentVersionIndex, versions } = get();
    if (currentVersionIndex <= 0) {
      return;
    }

    const nextIndex = currentVersionIndex - 1;
    const version = versions[nextIndex];
    if (!version) {
      return;
    }

    set({
      currentVersionIndex: nextIndex,
      plan: version.plan,
      code: version.code,
      explanation: version.explanation,
    });
  },
  selectVersion: (index) => {
    const version = get().versions[index];
    if (!version) {
      return;
    }

    set({
      currentVersionIndex: index,
      plan: version.plan,
      code: version.code,
      explanation: version.explanation,
    });
  },
}));
