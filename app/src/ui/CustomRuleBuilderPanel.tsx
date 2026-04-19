import { useMemo, useState, type ChangeEvent } from 'react';
import type { LeaseDocument } from '../parser/types';
import { analyze } from '../rules/analyze';
import type { Category, Rule, Severity } from '../rules/types';
import {
  buildDraftRule,
  CATEGORIES,
  EMPTY_DRAFT,
  LEAF_MATCHER_TYPES,
  MATCHER_TYPES,
  regexCompileError,
  SEVERITIES,
  validateDraftRule,
  type CustomRuleDraftForm,
  type LeafMatcherType,
  type MatcherType,
} from './customRuleDraft';

type TextFormKey =
  | 'id'
  | 'title'
  | 'explanation'
  | 'regexPattern'
  | 'regexFlags'
  | 'keywordsRaw'
  | 'windowRaw'
  | 'headingPattern'
  | 'jurisdictionsRaw'
  | 'plainEnglish'
  | 'suggestedEdit';

export interface CustomRuleBuilderPanelProps {
  /** When non-null, used to live-preview the draft rule's hit count. */
  doc: LeaseDocument | null;
  /** Existing rule ids (across merged packs) used for duplicate-id checks. */
  existingRuleIds: string[];
  /** Caller is responsible for persistence (e.g. via packStorage). */
  onSave: (rule: Rule) => void;
}

interface PreviewResult {
  kind: 'hit' | 'miss' | 'suppressed';
  count: number;
}

export function CustomRuleBuilderPanel({
  doc,
  existingRuleIds,
  onSave,
}: CustomRuleBuilderPanelProps): JSX.Element {
  const [form, setForm] = useState<CustomRuleDraftForm>(EMPTY_DRAFT);

  const regexError = regexCompileError(form);
  const draftRule = useMemo(() => buildDraftRule(form), [form]);
  const validation = useMemo(() => validateDraftRule(draftRule), [draftRule]);
  const duplicateId =
    form.id.length > 0 && existingRuleIds.includes(form.id);

  const preview = useMemo<PreviewResult | null>(() => {
    if (!doc) return null;
    if (regexError) return { kind: 'suppressed', count: 0 };
    if (!validation.ok) return { kind: 'suppressed', count: 0 };
    try {
      const findings = analyze(doc, [draftRule]);
      return {
        kind: findings.length > 0 ? 'hit' : 'miss',
        count: findings.length,
      };
    } catch {
      // analyze shouldn't throw for a schema-valid rule, but guard anyway:
      // a live preview crash must never take down the panel.
      return { kind: 'suppressed', count: 0 };
    }
  }, [doc, regexError, validation.ok, draftRule]);

  const canSave = validation.ok && !duplicateId && !regexError;

  function patch<K extends keyof CustomRuleDraftForm>(
    key: K,
    value: CustomRuleDraftForm[K],
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Every form field is a string (enums like `severity` are stored as their
  // literal string value). A single text-change handler factory keeps the
  // JSX tidy without a second layer of generics.
  function onText(key: TextFormKey) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      patch(key, e.target.value as CustomRuleDraftForm[typeof key]);
    };
  }

  function onSelectCategory(e: ChangeEvent<HTMLSelectElement>): void {
    patch('category', e.target.value as Category);
  }
  function onSelectSeverity(e: ChangeEvent<HTMLSelectElement>): void {
    patch('severity', e.target.value as Severity);
  }
  function onSelectMatcherType(e: ChangeEvent<HTMLSelectElement>): void {
    patch('matcherType', e.target.value as MatcherType);
  }
  function onSelectChildType(e: ChangeEvent<HTMLSelectElement>): void {
    patch('childType', e.target.value as LeafMatcherType);
  }

  function handleSave(): void {
    if (!canSave) return;
    onSave(draftRule);
  }

  return (
    <section aria-label="custom rule builder">
      <h2>Custom rule builder</h2>

      <div>
        <label htmlFor="crb-id">Rule ID</label>
        <input
          id="crb-id"
          type="text"
          value={form.id}
          onChange={onText('id')}
          aria-describedby={duplicateId ? 'crb-id-error' : undefined}
          aria-invalid={duplicateId || undefined}
        />
        {duplicateId && (
          <p id="crb-id-error" role="alert">
            A rule with id &ldquo;{form.id}&rdquo; already exists.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="crb-title">Title</label>
        <input
          id="crb-title"
          type="text"
          value={form.title}
          onChange={onText('title')}
        />
      </div>

      <div>
        <label htmlFor="crb-explanation">Explanation</label>
        <textarea
          id="crb-explanation"
          value={form.explanation}
          onChange={onText('explanation')}
        />
      </div>

      <div>
        <label htmlFor="crb-category">Category</label>
        <select
          id="crb-category"
          value={form.category}
          onChange={onSelectCategory}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="crb-severity">Severity</label>
        <select
          id="crb-severity"
          value={form.severity}
          onChange={onSelectSeverity}
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="crb-matcher-type">Matcher type</label>
        <select
          id="crb-matcher-type"
          value={form.matcherType}
          onChange={onSelectMatcherType}
        >
          {MATCHER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {form.matcherType === 'regex' && (
        <RegexFields form={form} onText={onText} regexError={regexError} />
      )}

      {form.matcherType === 'keywordProximity' && (
        <KeywordFields form={form} onText={onText} />
      )}

      {form.matcherType === 'sectionAnchored' && (
        <fieldset>
          <legend>Section-anchored matcher</legend>
          <div>
            <label htmlFor="crb-heading">Heading pattern</label>
            <input
              id="crb-heading"
              type="text"
              value={form.headingPattern}
              onChange={onText('headingPattern')}
            />
          </div>
          <div>
            <label htmlFor="crb-child-type">Child matcher type</label>
            <select
              id="crb-child-type"
              value={form.childType}
              onChange={onSelectChildType}
            >
              {LEAF_MATCHER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {form.childType === 'regex' ? (
            <RegexFields form={form} onText={onText} regexError={regexError} />
          ) : (
            <KeywordFields form={form} onText={onText} />
          )}
        </fieldset>
      )}

      <fieldset>
        <legend>Optional metadata</legend>
        <div>
          <label htmlFor="crb-jurisdictions">
            Jurisdictions (comma-separated)
          </label>
          <input
            id="crb-jurisdictions"
            type="text"
            value={form.jurisdictionsRaw}
            onChange={onText('jurisdictionsRaw')}
          />
        </div>
        <div>
          <label htmlFor="crb-plain-english">Plain-English summary</label>
          <textarea
            id="crb-plain-english"
            value={form.plainEnglish}
            onChange={onText('plainEnglish')}
          />
        </div>
        <div>
          <label htmlFor="crb-suggested-edit">Suggested edit</label>
          <textarea
            id="crb-suggested-edit"
            value={form.suggestedEdit}
            onChange={onText('suggestedEdit')}
          />
        </div>
      </fieldset>

      {preview && (
        <p aria-live="polite" data-testid="crb-preview">
          {preview.kind === 'suppressed' && 'Preview unavailable.'}
          {preview.kind === 'hit' && `Fires at ${preview.count} location${preview.count === 1 ? '' : 's'}.`}
          {preview.kind === 'miss' && 'Does not fire on the loaded document.'}
        </p>
      )}

      {!validation.ok && form.id.length > 0 && (
        <ul aria-label="validation errors">
          {validation.errors.map((err) => (
            <li key={err} role="alert">
              {err}
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={handleSave} disabled={!canSave}>
        Save rule
      </button>
    </section>
  );
}

interface SubFieldProps {
  form: CustomRuleDraftForm;
  onText: (
    key: TextFormKey,
  ) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

function RegexFields({
  form,
  onText,
  regexError,
}: SubFieldProps & { regexError: string | null }): JSX.Element {
  return (
    <div>
      <div>
        <label htmlFor="crb-regex-pattern">Regex pattern</label>
        <input
          id="crb-regex-pattern"
          type="text"
          value={form.regexPattern}
          onChange={onText('regexPattern')}
          aria-describedby={regexError ? 'crb-regex-error' : undefined}
          aria-invalid={regexError ? true : undefined}
        />
        {regexError && (
          <p id="crb-regex-error" role="alert">
            Regex compile error: {regexError}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="crb-regex-flags">Flags</label>
        <input
          id="crb-regex-flags"
          type="text"
          value={form.regexFlags}
          onChange={onText('regexFlags')}
        />
      </div>
    </div>
  );
}

function KeywordFields({ form, onText }: SubFieldProps): JSX.Element {
  return (
    <div>
      <div>
        <label htmlFor="crb-keywords">Keywords (comma-separated)</label>
        <input
          id="crb-keywords"
          type="text"
          value={form.keywordsRaw}
          onChange={onText('keywordsRaw')}
        />
      </div>
      <div>
        <label htmlFor="crb-window">Window (characters)</label>
        <input
          id="crb-window"
          type="number"
          value={form.windowRaw}
          onChange={onText('windowRaw')}
        />
      </div>
    </div>
  );
}
