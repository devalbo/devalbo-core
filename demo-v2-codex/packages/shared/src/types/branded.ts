declare const __brand: unique symbol;
type Brand<B> = { [__brand]: B };

export type Branded<T, B> = T & Brand<B>;
export type FilePath = Branded<string, 'FilePath'>;
export type DirectoryPath = Branded<string, 'DirectoryPath'>;

export const asFilePath = (path: string): FilePath => path as FilePath;
export const asDirectoryPath = (path: string): DirectoryPath => path as DirectoryPath;
