import { useCallback, useEffect, useState } from 'react';
import { asFilePath } from '@devalbo/shared';
import { getDriver } from '../lib/file-operations';

export interface UseFileEditorReturn {
  content: string;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  save: () => Promise<void>;
  revert: () => Promise<void>;
  setContent: (next: string) => void;
}

export const useFileEditor = (filePath: string): UseFileEditorReturn => {
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const driver = await getDriver();
    setIsLoading(true);
    setError(null);
    try {
      const bytes = await driver.readFile(asFilePath(filePath));
      const text = new TextDecoder().decode(bytes);
      setContent(text);
      setSavedContent(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    const driver = await getDriver();
    const data = new TextEncoder().encode(content);
    await driver.writeFile(asFilePath(filePath), data);
    setSavedContent(content);
  }, [content, filePath]);

  return {
    content,
    isDirty: content !== savedContent,
    isLoading,
    error,
    save,
    revert: load,
    setContent
  };
};
