import { useState } from "react";
import type { Comparison, LogFile, Run } from "../types";
import type { BusinessInsights } from "../recommendations/types";
import { generateBusinessInsights } from "../recommendations/generateBusinessInsights";
import {
  clearStoredApiKey,
  getEffectiveApiKey,
  getStoredApiKey,
  setStoredApiKey,
} from "../recommendations/apiKeyStore";
import { describeAnthropicError } from "../recommendations/describeAnthropicError";
import { BusinessStatCard } from "./BusinessStatCard";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

export interface RecommendationsPanelProps {
  comparison: Comparison;
  runs: Run[];
  logFilesById: Map<string, LogFile>;
}

export function RecommendationsPanel({ comparison, runs, logFilesById }: RecommendationsPanelProps) {
  const [hasKey, setHasKey] = useState(() => Boolean(getStoredApiKey()));
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<BusinessInsights | null>(null);

  async function runGeneration(apiKey: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await generateBusinessInsights(comparison, runs, logFilesById, apiKey);
      setInsights(result);
    } catch (err) {
      setError(describeAnthropicError(err));
    } finally {
      setLoading(false);
    }
  }

  function handleGenerateClick() {
    const effectiveKey = getEffectiveApiKey();
    if (!effectiveKey) {
      setShowKeyForm(true);
      return;
    }
    void runGeneration(effectiveKey);
  }

  function handleSaveKey() {
    const trimmed = keyDraft.trim();
    if (!trimmed) return;
    setStoredApiKey(trimmed);
    setHasKey(true);
    setShowKeyForm(false);
    setKeyDraft("");
    void runGeneration(trimmed);
  }

  function handleClearKey() {
    clearStoredApiKey();
    setHasKey(false);
    setInsights(null);
    setError(null);
  }

  return (
    <section className="recommendations-panel card" aria-label="AI business insights">
      <div className="recommendations-panel-header">
        <div>
          <p className="card-title">AI business insights</p>
          <p className="card-subtitle">
            Generate insights through AI to understand what changed between these runs, why it matters, and what
            to do about it.
          </p>
        </div>
        <div className="recommendations-panel-actions">
          {hasKey && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleClearKey} title="Forget saved API key">
              <Icon name="key" size={13} />
              Forget key
            </button>
          )}
          <button
            type="button"
            className={`btn btn-primary btn-sm${loading ? " btn-loading" : ""}`}
            onClick={handleGenerateClick}
            disabled={loading}
          >
            {loading ? <Spinner size={13} /> : <Icon name="sparkle" size={13} />}
            {loading ? "Analyzing…" : "Generate business insights"}
          </button>
        </div>
      </div>

      {showKeyForm && (
        <div className="api-key-form">
          <label htmlFor="anthropic-api-key" className="api-key-form-label">
            Anthropic API key
          </label>
          <p className="api-key-form-hint">
            Stored only in this browser's local storage. Used to call the Anthropic API directly — never sent
            anywhere else.
          </p>
          <div className="api-key-form-row">
            <input
              id="anthropic-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-..."
              className="text-input"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveKey();
              }}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveKey} disabled={!keyDraft.trim()}>
              Save &amp; generate
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setShowKeyForm(false);
                setKeyDraft("");
              }}
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="recommendations-error">
          <Icon name="warning" size={14} />
          {error}
        </p>
      )}

      {insights && insights.businessStats.length === 0 && !error && (
        <p className="recommendations-empty">Nothing in this comparison warranted a business insight.</p>
      )}

      {insights && (
        <>
          <div className="recommended-action">
            <p className="eyebrow eyebrow--accent">Recommended action</p>
            <p className="recommended-action-text">{insights.recommendedAction}</p>
          </div>

          {insights.businessStats.length > 0 && (
            <div className="business-stats-grid">
              {insights.businessStats.map((stat) => (
                <BusinessStatCard key={stat.id} stat={stat} />
              ))}
            </div>
          )}

          {insights.dataQualityCaveats.length > 0 && (
            <div className="data-quality-caveats">
              <p className="eyebrow">Data-quality caveats</p>
              <ul className="data-quality-caveats-list">
                {insights.dataQualityCaveats.map((caveat, i) => (
                  <li key={i}>
                    <strong>{caveat.issue}</strong> {caveat.impact}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
