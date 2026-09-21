import { useState } from "react";
import Anthropic from "@anthropic-ai/sdk";
import type { Comparison, Run } from "../types";
import type { ExecutiveSummaryInsight } from "../recommendations/types";
import { generateRecommendations } from "../recommendations/generateRecommendations";
import {
  clearStoredApiKey,
  getEffectiveApiKey,
  getStoredApiKey,
  isUsingDevFallbackKey,
  setStoredApiKey,
} from "../recommendations/apiKeyStore";
import { Icon } from "./Icon";

export interface RecommendationsPanelProps {
  comparison: Comparison;
  runs: Run[];
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "That API key was rejected. Check it and try again.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Rate limited by the Anthropic API. Wait a moment and try again.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach the Anthropic API — check your connection.";
  }
  if (err instanceof Anthropic.APIError) {
    return `Anthropic API error: ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Something went wrong generating the executive summary.";
}

export function RecommendationsPanel({ comparison, runs }: RecommendationsPanelProps) {
  const [hasKey, setHasKey] = useState(() => Boolean(getStoredApiKey()));
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<ExecutiveSummaryInsight[] | null>(null);

  async function runGeneration(apiKey: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await generateRecommendations(comparison, runs, apiKey);
      setInsights(result);
    } catch (err) {
      setError(describeError(err));
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
    <section className="recommendations-panel card" aria-label="AI executive summary">
      <div className="recommendations-panel-header">
        <div>
          <p className="card-title">AI recommendations</p>
          <p className="card-subtitle">
            Sends the run prompts and metrics below to Claude for a root-cause executive summary of what
            actually drove the difference between runs.
            {isUsingDevFallbackKey() && " Using VITE_ANTHROPIC_API_KEY from .env.local (dev only)."}
          </p>
        </div>
        <div className="recommendations-panel-actions">
          {hasKey && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleClearKey} title="Forget saved API key">
              <Icon name="key" size={13} />
              Forget key
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={handleGenerateClick} disabled={loading}>
            <Icon name="sparkle" size={13} />
            {loading ? "Analyzing…" : "Generate executive summary"}
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

      {insights && insights.length === 0 && !error && (
        <p className="recommendations-empty">Nothing in this comparison warranted an executive summary.</p>
      )}

      {insights && insights.length > 0 && (
        <>
          <p className="eyebrow eyebrow--accent recommendations-summary-eyebrow">Executive summary</p>
          <ol className="executive-summary-list">
            {insights.map((insight, i) => (
              <li key={i} className="executive-summary-item">
                <p className="executive-summary-text">
                  <strong>{insight.headline}</strong> {insight.detail}
                </p>
                {insight.supportingMetricKeys.length > 0 && (
                  <p className="executive-summary-tags">
                    {insight.supportingMetricKeys.map((key) => (
                      <span key={key} className="recommendation-metric-tag">
                        {key}
                      </span>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
