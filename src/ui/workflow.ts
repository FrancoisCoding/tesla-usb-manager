export interface ApplySelection {
  prepareLayout: boolean;
  installAudio: boolean;
  installLightShow: boolean;
}

export type ApplyStageId =
  | "prepare_layout"
  | "audio_install"
  | "lightshow_install";

export interface ApplyStagePlanItem {
  id: ApplyStageId;
  label: string;
  destructive: boolean;
}

export function buildApplyStagePlan(selection: ApplySelection): ApplyStagePlanItem[] {
  const plan: ApplyStagePlanItem[] = [];

  if (selection.prepareLayout) {
    plan.push({
      id: "prepare_layout",
      label: "Prepare Tesla folder layout",
      destructive: true,
    });
  }

  if (selection.installAudio) {
    plan.push({
      id: "audio_install",
      label: "Install horn/chime audio",
      destructive: false,
    });
  }

  if (selection.installLightShow) {
    plan.push({
      id: "lightshow_install",
      label: "Install selected light show",
      destructive: false,
    });
  }

  return plan;
}

export function hasDestructiveApplyStage(plan: ApplyStagePlanItem[]): boolean {
  return plan.some((stage) => stage.destructive);
}

export interface DestructiveConfirmationInput {
  typedValue: string;
  expectedValue: string;
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateDestructiveConfirmation(
  input: DestructiveConfirmationInput,
): ValidationResult {
  if (input.typedValue.trim() === input.expectedValue) {
    return { ok: true };
  }

  return {
    ok: false,
    error: `Type "${input.expectedValue}" to confirm layout preparation.`,
  };
}

export function computeApplyProgressPercent(totalStages: number, doneStages: number): number {
  if (totalStages <= 0) {
    return 0;
  }

  const raw = (doneStages / totalStages) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}
