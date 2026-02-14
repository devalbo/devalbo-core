import { Data } from 'effect';

export class MissingArgument extends Data.TaggedError('MissingArgument')<{
  argName: string;
  message: string;
  defaultValue?: string;
}> {}

export class FileNotFound extends Data.TaggedError('FileNotFound')<{
  path: string;
  message: string;
}> {}
