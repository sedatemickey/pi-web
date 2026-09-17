"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { sendAgentCommand } from "@/lib/agent-client";
import {
  getLastSettingsSelection,
  setLastSettingsSelection,
  type SettingsDetailSection,
} from "@/lib/settings-navigation";
import { VISUAL_CARD_CATALOG } from "@/lib/visual/catalog";
import { VISUAL_CARD_TYPES, type VisualCardType } from "@/lib/visual/schema";
import { CardRenderer } from "./visual/CardRenderer";
import {
  ConfigButton,
  ConfigDetail,
  ConfigDetailActions,
  ConfigDetailHeader,
  ConfigDetailHeaderInfo,
  ConfigDetailStack,
  ConfigDetailTitle,
  ConfigField,
  ConfigFooter,
  ConfigPanelShell,
  ConfigSidebar,
  ConfigSidebarGroupLabel,
  ConfigSidebarItem,
  ConfigSidebarList,
  ConfigSidebarText,
  ConfigSplitView,
  ConfigStatusDot,
  ConfigSwitch,
} from "./SettingsUi";

interface PiUiSettingsState {
  enabled: boolean;
  components: Record<VisualCardType, boolean>;
  reloadRequired?: boolean;
}

type PiUiCategoryId = "foundation" | "interactive" | "charts" | "information";

interface PiUiCategory {
  id: PiUiCategoryId;
  types: readonly VisualCardType[];
}

const PI_UI_CATEGORIES: readonly PiUiCategory[] = [
  { id: "foundation", types: ["metrics", "comparison", "steps"] },
  { id: "interactive", types: ["tabs", "accordion", "data-table"] },
  { id: "charts", types: ["bar-chart", "line-chart", "area-chart", "donut-chart", "sparkline", "heatmap"] },
  { id: "information", types: ["status", "key-value", "progress", "checklist", "callout"] },
];

// Section id used to remember the last selected component across panel opens.
const PI_UI_SECTION = "pi-ui" satisfies SettingsDetailSection;

const SETTINGS_ENDPOINT = "/api/pi-ui/settings";

function settingsEndpoint(sessionId: string | null): string {
  return sessionId
    ? `${SETTINGS_ENDPOINT}?sessionId=${encodeURIComponent(sessionId)}`
    : SETTINGS_ENDPOINT;
}

/** Convert a protocol type id such as `bar-chart` to its camelCase translation key. */
function componentKey(type: VisualCardType): string {
  return type.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function isVisualCardType(value: string | null): value is VisualCardType {
  return value !== null && (VISUAL_CARD_TYPES as readonly string[]).includes(value);
}

function emptyComponents(): Record<VisualCardType, boolean> {
  const state = {} as Record<VisualCardType, boolean>;
  for (const type of VISUAL_CARD_TYPES) state[type] = false;
  return state;
}

/** Keep only known protocol types so a stale or malformed response cannot leak keys. */
function mergeComponents(source: Partial<Record<VisualCardType, boolean>> | undefined): Record<VisualCardType, boolean> {
  const next = emptyComponents();
  for (const type of VISUAL_CARD_TYPES) next[type] = source?.[type] === true;
  return next;
}

interface PiUiSettingsPayload {
  enabled?: boolean;
  components?: Partial<Record<VisualCardType, boolean>>;
}

export function PiUiConfig({
  sessionId = null,
  onClose,
  onReloaded,
  embedded = false,
}: {
  sessionId?: string | null;
  onClose: () => void;
  onReloaded?: () => void;
  embedded?: boolean;
}) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [components, setComponents] = useState<Record<VisualCardType, boolean>>(emptyComponents);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const savingRef = useRef(false);
  const reloadingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNeeded, setReloadNeeded] = useState(false);
  const [selectedType, setSelectedType] = useState<VisualCardType>(() => {
    const remembered = getLastSettingsSelection(PI_UI_SECTION);
    return isVisualCardType(remembered) ? remembered : "metrics";
  });

  const applyState = useCallback((data: PiUiSettingsState) => {
    setEnabled(data.enabled);
    setComponents(mergeComponents(data.components));
    setReloadNeeded(data.reloadRequired === true);
  }, []);

  // Fetch on mount so closing and reopening the panel always reflects the server
  // state instead of a cached copy.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(settingsEndpoint(sessionId), {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json() as Partial<PiUiSettingsState> & { error?: string };
        if (!response.ok || data.error || typeof data.enabled !== "boolean" || !data.components) {
          throw new Error(data.error ?? `HTTP ${response.status}`);
        }
        applyState({
          enabled: data.enabled,
          components: mergeComponents(data.components),
          reloadRequired: data.reloadRequired === true,
        });
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [applyState, sessionId]);

  useEffect(() => {
    setLastSettingsSelection(PI_UI_SECTION, selectedType);
  }, [selectedType]);

  const saveSettings = async (payload: PiUiSettingsPayload) => {
    if (savingRef.current || reloadingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(settingsEndpoint(sessionId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as Partial<PiUiSettingsState> & { error?: string };
      if (!response.ok || data.error || typeof data.enabled !== "boolean" || !data.components) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      applyState({
        enabled: data.enabled,
        components: mergeComponents(data.components),
        reloadRequired: data.reloadRequired === true,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const reloadSession = async () => {
    if (!sessionId || savingRef.current || reloadingRef.current) return;
    reloadingRef.current = true;
    setReloading(true);
    setError(null);
    try {
      await sendAgentCommand(sessionId, { type: "reload" });
      onReloaded?.();
      const response = await fetch(settingsEndpoint(sessionId), { cache: "no-store" });
      const data = await response.json() as Partial<PiUiSettingsState> & { error?: string };
      if (!response.ok || data.error || typeof data.enabled !== "boolean" || !data.components) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      applyState({
        enabled: data.enabled,
        components: mergeComponents(data.components),
        reloadRequired: data.reloadRequired === true,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      reloadingRef.current = false;
      setReloading(false);
    }
  };

  const selectedEntry = VISUAL_CARD_CATALOG[selectedType];
  const selectedName = t(`piUi.component.${componentKey(selectedType)}.name`);
  const selectedDescription = t(`piUi.component.${componentKey(selectedType)}.description`);
  const componentDisabled = !enabled || loading || saving || reloading;

  return (
    <ConfigPanelShell
      embedded={embedded}
      title={t("piUi.title")}
      subtitle={t("piUi.subtitle")}
      closeLabel={t("piUi.close")}
      onClose={onClose}
    >
      <div className="pi-ui-feature-setting">
        <div className="pi-ui-feature-copy">
          <strong>{t("piUi.enabledTitle")}</strong>
          <span>{t("piUi.enabledDescription")}</span>
          {reloadNeeded && (
            <span role="status" className="pi-ui-feature-reload-notice">
              {t("piUi.reloadRequired")}
            </span>
          )}
        </div>
        <div className="pi-ui-feature-actions">
          {reloadNeeded && sessionId && (
            <ConfigButton size="small" onClick={() => void reloadSession()} disabled={reloading || saving}>
              {reloading ? t("piUi.reloading") : t("piUi.reloadSession")}
            </ConfigButton>
          )}
          <ConfigSwitch
            checked={enabled}
            disabled={loading || reloading}
            loading={saving}
            label={t("piUi.enabledTitle")}
            onChange={(next) => void saveSettings({ enabled: next })}
          />
        </div>
      </div>
      <ConfigSplitView>
        <ConfigSidebar>
          <ConfigSidebarList>
            {loading ? (
              <div className="pi-ui-loading" role="status">
                {t("piUi.loading")}
              </div>
            ) : (
              PI_UI_CATEGORIES.map((category) => (
                <div key={category.id} className="config-sidebar-group">
                  <ConfigSidebarGroupLabel>{t(`piUi.category.${category.id}`)}</ConfigSidebarGroupLabel>
                  {category.types.map((type) => {
                    const name = t(`piUi.component.${componentKey(type)}.name`);
                    return (
                      <ConfigSidebarItem
                        key={type}
                        active={selectedType === type}
                        aria-label={t("piUi.selectComponent", { name })}
                        onClick={() => setSelectedType(type)}
                      >
                        <ConfigStatusDot active={enabled && components[type]} />
                        <ConfigSidebarText className={`is-grow${enabled && components[type] ? "" : " is-muted"}`}>
                          {name}
                        </ConfigSidebarText>
                      </ConfigSidebarItem>
                    );
                  })}
                </div>
              ))
            )}
          </ConfigSidebarList>
        </ConfigSidebar>

        <ConfigDetail>
          <ConfigDetailStack className="is-fill">
            <ConfigDetailStack>
              <ConfigDetailHeader>
                <ConfigDetailHeaderInfo className="pi-ui-detail-header-info">
                  <ConfigDetailTitle>{selectedName}</ConfigDetailTitle>
                  <span className="pi-ui-component-description">{selectedDescription}</span>
                  <code className="pi-ui-protocol-type" title={t("piUi.protocolType")}>
                    {selectedType}
                  </code>
                </ConfigDetailHeaderInfo>
                <ConfigDetailActions>
                  <ConfigSwitch
                    checked={components[selectedType]}
                    disabled={componentDisabled}
                    loading={saving}
                    label={t("piUi.componentToggle", { name: selectedName })}
                    onChange={(next) => void saveSettings({ components: { [selectedType]: next } })}
                  />
                </ConfigDetailActions>
              </ConfigDetailHeader>

              <ConfigField label={t("piUi.fields")}>
                <p className="pi-ui-fields">{selectedEntry.fields}</p>
              </ConfigField>

              <ConfigField label={t("piUi.preview")}>
                {/* Settings only affect prompt generation, so existing cards are never render-gated. */}
                <div className="pi-ui-preview">
                  <CardRenderer card={selectedEntry.example} />
                </div>
              </ConfigField>

              <ConfigField label={t("piUi.jsonExample")}>
                <pre className="pi-ui-json">
                  <code>{JSON.stringify(selectedEntry.example, null, 2)}</code>
                </pre>
              </ConfigField>
            </ConfigDetailStack>
          </ConfigDetailStack>
        </ConfigDetail>
      </ConfigSplitView>
      <ConfigFooter
        status={error && (
          <span role="alert" style={{ color: "#ef4444" }}>
            {t("piUi.error", { message: error })}
          </span>
        )}
      >
        <span className="pi-ui-footer-note">{t("piUi.promptOnlyNote")}</span>
      </ConfigFooter>
    </ConfigPanelShell>
  );
}