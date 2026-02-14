import { useInput } from 'ink';

export const useKeyboard = (handler: (input: string, key: { upArrow: boolean; downArrow: boolean; return: boolean }) => void) => {
  useInput((input, key) => {
    handler(input, {
      upArrow: key.upArrow,
      downArrow: key.downArrow,
      return: key.return
    });
  });
};
