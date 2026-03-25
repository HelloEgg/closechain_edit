import { useState, useRef, useEffect, useMemo, useId } from "react";
import { Plus } from "lucide-react";

interface DocumentTypeComboboxProps {
  allDocumentTypes: string[];
  selectedDocumentTypes: string[];
  onAdd: (docType: string) => void;
  placeholder?: string;
}

export function DocumentTypeCombobox({
  allDocumentTypes,
  selectedDocumentTypes,
  onAdd,
  placeholder = "Add document type...",
}: DocumentTypeComboboxProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const selectedSet = useMemo(() => new Set(selectedDocumentTypes), [selectedDocumentTypes]);

  const filteredOptions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    return allDocumentTypes
      .filter((dt) => !selectedSet.has(dt))
      .filter((dt) => !query || dt.toLowerCase().includes(query));
  }, [allDocumentTypes, selectedSet, inputValue]);

  const exactMatch = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    return allDocumentTypes.some((dt) => dt.toLowerCase() === query) ||
      selectedDocumentTypes.some((dt) => dt.toLowerCase() === query);
  }, [allDocumentTypes, selectedDocumentTypes, inputValue]);

  const showDropdown = isOpen && filteredOptions.length > 0;
  const canAddCustom = inputValue.trim().length > 0 && !exactMatch;
  const isListVisible = showDropdown || (isOpen && canAddCustom);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightedIndex(filteredOptions.length > 0 && inputValue.trim() ? 0 : -1);
  }, [inputValue, filteredOptions.length]);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleSelect = (docType: string) => {
    onAdd(docType);
    setInputValue("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleAddCustom = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !selectedSet.has(trimmed)) {
      onAdd(trimmed);
      setInputValue("");
      setIsOpen(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (inputValue.trim()) {
        handleAddCustom();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const activeDescendant = highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined;

  return (
    <div ref={containerRef} className="relative flex gap-2">
      <div className="relative flex-1">
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={isListVisible}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
          autoComplete="off"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/50 outline-none"
        />
        {isListVisible && (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
          >
            {filteredOptions.map((docType, idx) => (
              <li
                key={docType}
                id={`${listboxId}-option-${idx}`}
                role="option"
                aria-selected={idx === highlightedIndex}
                data-index={idx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(docType);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                  idx === highlightedIndex
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-secondary/50"
                }`}
              >
                {docType}
              </li>
            ))}
            {canAddCustom && (
              <li
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAddCustom();
                }}
                className="px-3 py-2 text-sm cursor-pointer text-primary hover:bg-primary/10 border-t border-border flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Add &ldquo;{inputValue.trim()}&rdquo; as custom
              </li>
            )}
          </ul>
        )}
      </div>
      <button
        onClick={handleAddCustom}
        disabled={!inputValue.trim() || selectedSet.has(inputValue.trim())}
        aria-label="Add document type"
        className="px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
