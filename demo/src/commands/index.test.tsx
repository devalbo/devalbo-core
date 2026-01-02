import { describe, it, expect } from 'vitest';
import { commands } from './index';

describe('commands', () => {
  describe('greet', () => {
    it('should greet with default name', () => {
      // Arrange & Act
      const result = commands.greet([]);

      // Assert
      expect(result.component).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should greet with specific name', () => {
      // Arrange & Act
      const result = commands.greet(['Alice']);

      // Assert
      expect(result.component).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should greet with multi-word name', () => {
      // Arrange & Act
      const result = commands.greet(['Alice', 'Smith']);

      // Assert
      expect(result.component).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe('info', () => {
    it('should return info component', () => {
      // Arrange & Act
      const result = commands.info();

      // Assert
      expect(result.component).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe('loading', () => {
    it('should return loading component', () => {
      // Arrange & Act
      const result = commands.loading();

      // Assert
      expect(result.component).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe('help', () => {
    it('should return help component', () => {
      // Arrange & Act
      const result = commands.help();

      // Assert
      expect(result.component).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });
});
