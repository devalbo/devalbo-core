import { useCallback, useEffect, useState } from 'react';
import { asFilePath } from '@devalbo/shared';
import { getDriver } from '../lib/file-operations';

export interface UseFileEditorReturn {
  content: string;
  isDirty: boolean;
  isLoading: boolean;
  isBinary: boolean;
  fileExists: boolean;
  error: string | null;
  save: () => Promise<void>;
  revert: () => Promise<void>;
  createFile: () => Promise<void>;
  setContent: (next: string) => void;
}

const decodeUtf8 = (bytes: Uint8Array): { text: string; binary: boolean } => {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return { text: decoder.decode(bytes), binary: false };
  } catch {
    return { text: '', binary: true };
  }
};

export const useFileEditor = (filePath: string): UseFileEditorReturn => {
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBinary, setIsBinary] = useState(false);
  const [fileExists, setFileExists] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const driver = await getDriver();
    setIsLoading(true);
    setError(null);
    try {
      const bytes = await driver.readFile(asFilePath(filePath));
      const { text, binary } = decodeUtf8(bytes);
      setIsBinary(binary);
      setFileExists(true);
      setContent(text);
      setSavedContent(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('not found')) {
        setFileExists(false);
        setIsBinary(false);
        setContent('');
        setSavedContent('');
      } else {
        setError(message);
      }
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
    setFileExists(true);
    setIsBinary(false);
  }, [content, filePath]);

  const createFile = useCallback(async () => {
    const driver = await getDriver();
    await driver.writeFile(asFilePath(filePath), new Uint8Array());
    setContent('');
    setSavedContent('');
    setFileExists(true);
    setError(null);
  }, [filePath]);

  return {
    content,
    isDirty: content !== savedContent,
    isLoading,
    isBinary,
    fileExists,
    error,
    save,
    revert: load,
    createFile,
    setContent
  };
};
