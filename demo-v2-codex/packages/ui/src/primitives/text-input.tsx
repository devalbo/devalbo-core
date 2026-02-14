import React from 'react';
import { TextInput as InkTextInput } from '@inkjs/ui';

interface TextInputProps {
  value?: string;
  defaultValue?: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  suggestions?: string[];
}

export const TextInput: React.FC<TextInputProps> = ({
  value,
  defaultValue,
  onChange,
  onSubmit,
  placeholder,
  isDisabled,
  suggestions
}) => {
  const inputProps = {
    onChange,
    onSubmit: (nextValue: string) => onSubmit?.(nextValue),
    ...(typeof isDisabled === 'boolean' ? { isDisabled } : {}),
    ...(typeof placeholder === 'string' ? { placeholder } : {}),
    ...(typeof (value ?? defaultValue) === 'string' ? { defaultValue: value ?? defaultValue } : {}),
    ...(Array.isArray(suggestions) ? { suggestions } : {})
  };

  return (
    <InkTextInput {...inputProps} />
  );
};
