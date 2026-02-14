import { describe, expect, it } from 'vitest';
import { asDirectoryPath, asFilePath } from '../src/types/branded';

describe('branded paths', () => {
  it('creates file path brand without changing value', () => {
    const value = '/tmp/file.txt';
    const filePath = asFilePath(value);
    expect(filePath).toBe(value);
  });

  it('creates directory path brand without changing value', () => {
    const value = '/tmp';
    const dirPath = asDirectoryPath(value);
    expect(dirPath).toBe(value);
  });
});
