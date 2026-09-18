import { NextResponse } from "next/server";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";
import { readPiUiSettings, updatePiUiSettings, type PiUiSettings, type PiUiSettingsPatch } from "@/lib/pi-ui-settings";
import { advancePiUiSettingsGeneration, isPiUiSessionPromptStale } from "@/lib/pi-ui-session-state";
import { VISUAL_CARD_TYPES, type VisualCardType } from "@/lib/visual/schema";

export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function internalError(error: unknown) {
  return errorResponse(error instanceof Error ? error.message : String(error), 500);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isVisualCardType(value: string): value is VisualCardType {
  return (VISUAL_CARD_TYPES as readonly string[]).includes(value);
}

function settingsResponse(settings: PiUiSettings, request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  return NextResponse.json({
    ...settings,
    ...(sessionId ? { reloadRequired: isPiUiSessionPromptStale(sessionId) } : {}),
  });
}

export async function GET(request: Request) {
  try {
    return settingsResponse(readPiUiSettings(), request);
  } catch (error) {
    return internalError(error);
  }
}

export async function PUT(req: Request) {
  if (!isApiRequestAllowed(req)) {
    return errorResponse("Untrusted API request", 403);
  }
  if (!hasJsonContentType(req)) {
    return errorResponse("Content-Type must be application/json", 415);
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Request body must be valid JSON", 400);
    }
    if (!isRecord(body)) {
      return errorResponse("Request body must be an object", 400);
    }

    const unknownFields = Object.keys(body).filter((key) => key !== "enabled" && key !== "components");
    if (unknownFields.length > 0) {
      return errorResponse(`Unknown field: ${unknownFields[0]}`, 400);
    }
    if (!Object.hasOwn(body, "enabled") && !Object.hasOwn(body, "components")) {
      return errorResponse("enabled or components is required", 400);
    }

    const patch: PiUiSettingsPatch = {};
    if (Object.hasOwn(body, "enabled")) {
      if (typeof body.enabled !== "boolean") {
        return errorResponse("enabled must be a boolean", 400);
      }
      patch.enabled = body.enabled;
    }

    if (Object.hasOwn(body, "components")) {
      const value = body.components;
      if (!isRecord(value)) {
        return errorResponse("components must be an object", 400);
      }
      const components: Partial<Record<VisualCardType, boolean>> = {};
      for (const [key, entry] of Object.entries(value)) {
        if (!isVisualCardType(key)) {
          return errorResponse(`Unknown pi-ui component: ${key}`, 400);
        }
        if (typeof entry !== "boolean") {
          return errorResponse(`pi-ui component ${key} must be a boolean`, 400);
        }
        components[key] = entry;
      }
      patch.components = components;
    }

    const settings = updatePiUiSettings(patch);
    advancePiUiSettingsGeneration();
    return settingsResponse(settings, req);
  } catch (error) {
    return internalError(error);
  }
}
