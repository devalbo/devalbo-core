import React, { useState, useEffect, useEffectEvent } from 'react';
import { Box, Text } from 'ink';
import { useShell } from './ShellContext';

interface CountdownProps {
  seconds?: number;
}

export function Countdown({ seconds = 5 }: CountdownProps) {
  const { startCommand, endCommand } = useShell();
  const [count, setCount] = useState(seconds);
  const [done, setDone] = useState(false);

  const onCountdownComplete = useEffectEvent(() => {
    endCommand();
  });

  // Signal that a blocking command has started
  useEffect(() => {
    startCommand();
  }, [startCommand]);

  useEffect(() => {
    if (count > 1) {
      const timer = setTimeout(() => setCount(count - 1), 1000);
      return () => clearTimeout(timer);
    } else if (count === 1 && !done) {
      const timer = setTimeout(() => {
        setDone(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [count, done]);

  // End command after "Done!" has been displayed
  useEffect(() => {
    if (done) {
      const timer = setTimeout(() => onCountdownComplete(), 500);
      return () => clearTimeout(timer);
    }
  }, [done]);

  if (done) {
    return (
      <Box padding={1}>
        <Text color="green" bold>Done!</Text>
      </Box>
    );
  }

  return (
    <Box padding={1}>
      <Text>Countdown: </Text>
      <Text color="yellow" bold>{count}</Text>
    </Box>
  );
}
