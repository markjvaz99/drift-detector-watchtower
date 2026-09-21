import { useEffect, useState } from "react";
import { getStoredApiKey, getEffectiveApiKey, setStoredApiKey } from "../recommendations/apiKeyStore";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

export interface SuggestNamesButtonProps {
  loading: boolean;
  error: string | null;
  onGenerate: (apiKey: string) => void;
}

// Presentational: the actual API call and its loading/error state live in
// ComparisonView, since naming now also fires automatically there when a key
// is already saved — this button is the manual trigger (for regenerating, or
// for entering a key the first time) sharing that same state, not a second
// independent copy of it.
export function SuggestNamesButton({ loading, error, onGenerate }: SuggestNamesButtonProps) {
  const [hasKey, setHasKey] = useState(() => Boolean(getStoredApiKey()));
  const [showPopover, setShowPopover] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");

  useEffect(() => {
    if (error) setShowPopover(true);
  }, [error]);

  function handleClick() {
    const effectiveKey = getEffectiveApiKey();
    if (!effectiveKey) {
      setShowPopover(true);
      return;
    }
    onGenerate(effectiveKey);
  }

  function handleSaveKey() {
    const trimmed = keyDraft.trim();
    if (!trimmed) return;
    setStoredApiKey(trimmed);
    setHasKey(true);
    setKeyDraft("");
    setShowPopover(false);
    onGenerate(trimmed);
  }

  return (
    <div className="suggest-names">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={handleClick}
        disabled={loading}
        title="Suggest a title and run labels from the actual prompts, using Claude"
      >
        {loading ? <Spinner size={13} /> : <Icon name="sparkle" size={13} />}
        {loading ? "Naming…" : "Suggest names"}
      </button>

      {showPopover && (
        <div className="suggest-names-popover">
          {!hasKey && (
            <div className="api-key-form suggest-names-key-form">
              <label htmlFor="suggest-names-api-key" className="api-key-form-label">
                Anthropic API key
              </label>
              <p className="api-key-form-hint">
                Stored only in this browser's local storage. Used to call the Anthropic API directly — never
                sent anywhere else. Once saved, naming runs automatically for future comparisons.
              </p>
              <div className="api-key-form-row">
                <input
                  id="suggest-names-api-key"
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
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveKey}
                  disabled={!keyDraft.trim()}
                >
                  Save &amp; name
                </button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="suggest-names-error">
              <Icon name="warning" size={13} />
              {error}
            </p>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm suggest-names-close"
            onClick={() => {
              setShowPopover(false);
              setKeyDraft("");
            }}
          >
            <Icon name="close" size={13} />
            Close
          </button>
        </div>
      )}
    </div>
  );
}
