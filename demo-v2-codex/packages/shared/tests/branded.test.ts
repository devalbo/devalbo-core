import { describe, expect, it } from 'vitest';
import {
  unsafeAsDirectoryPath,
  unsafeAsFilePath,
  assertDirectoryPath,
  assertFilePath,
  parseDirectoryPath,
  parseFilePath,
  unsafeAsDirectoryPath,
  unsafeAsFilePath
} from '../src/types/branded';

describe('branded paths', () => {
  it('creates file path brand without changing value', () => {
    const value = '/tmp/file.txt';
    const filePath = unsafeAsFilePath(value);
    expect(filePath).toBe(value);
  });

  it('creates directory path brand without changing value', () => {
    const value = '/tmp';
    const dirPath = unsafeAsDirectoryPath(value);
    expect(dirPath).toBe(value);
  });

  it('parses file path from untrusted input', () => {
    expect(parseFilePath('/tmp/demo.txt').success).toBe(true);
    expect(parseFilePath('').success).toBe(false);
  });

  it('asserts directory path for valid input', () => {
    expect(assertDirectoryPath('/tmp')).toBe('/tmp');
    expect(() => assertFilePath('')).toThrow();
  });

  it('keeps explicit unsafe aliases', () => {
    expect(unsafeAsFilePath('/tmp/a.txt')).toBe('/tmp/a.txt');
    expect(unsafeAsDirectoryPath('/tmp')).toBe('/tmp');
  });
});
