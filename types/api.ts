import type { Plan } from "./plan";

export interface GenerateRequest {
  userMessage: string;
  sessionId: string;
}

export interface GenerateResponse {
  success: boolean;
  version?: {
    id: string;
    index: number;
    timestamp: number;
  };
  plan?: Plan;
  code?: string;
  explanation?: string;
  validation?: {
    componentCheck: boolean;
    propCheck: boolean;
  };
  error?: string;
}

export interface ModifyRequest {
  userMessage: string;
  sessionId: string;
  currentVersion: {
    id: string;
    plan: Plan;
    code: string;
  };
}

export interface ModifyResponse {
  success: boolean;
  version?: {
    id: string;
    index: number;
    timestamp: number;
  };
  plan?: Plan;
  code?: string;
  explanation?: string;
  validation?: {
    componentCheck: boolean;
    propCheck: boolean;
  };
  diff?: {
    changedComponents: string[];
  };
  error?: string;
}
