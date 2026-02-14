import { describe, expect, it } from 'vitest';
import { commands } from '@/commands';

describe('commands', () => {
  it('returns help output', () => {
    const result = commands.help();
    expect(result.error).toBeUndefined();
    expect(result.component).toBeTruthy();
  });

  it('returns navigate component', () => {
    const result = commands.navigate(['.']);
    expect(result.component).toBeTruthy();
  });
});
