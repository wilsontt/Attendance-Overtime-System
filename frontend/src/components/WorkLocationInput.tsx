/**
 * 工作地點輸入：支援共用詞庫前綴建議（需登入）；未登入則一般文字框。
 */

import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type ReactElement,
  type Ref,
} from 'react';
import { searchWorkLocations } from '../api/workLocations';

type WorkLocationInputProps = {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  inputRef?: Ref<HTMLInputElement>;
  /** 已登入才打詞庫 API */
  dictionaryEnabled?: boolean;
  normalize: (input: string) => string;
};

export function WorkLocationInput({
  value,
  onChange,
  maxLength,
  placeholder,
  inputRef,
  dictionaryEnabled = false,
  normalize,
}: WorkLocationInputProps): ReactElement {
  const listId = useId();
  const [fetchedSuggestions, setFetchedSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!dictionaryEnabled) {
      return;
    }
    const q = value.trim();
    if (!q) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const items = await searchWorkLocations(q, 20);
          if (!cancelled) {
            setFetchedSuggestions(items.map((i) => i.text));
          }
        } catch {
          if (!cancelled) setFetchedSuggestions([]);
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, dictionaryEnabled]);

  const suggestions =
    dictionaryEnabled && value.trim() ? fetchedSuggestions : [];

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(normalize(event.target.value));
  };

  return (
    <>
      <input
        type="text"
        ref={inputRef}
        value={value}
        maxLength={maxLength}
        list={dictionaryEnabled ? listId : undefined}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete="off"
      />
      {dictionaryEnabled ? (
        <datalist id={listId}>
          {suggestions.map((text) => (
            <option key={text} value={text} />
          ))}
        </datalist>
      ) : null}
    </>
  );
}
