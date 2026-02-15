import { asDirectoryPath, detectPlatform, RuntimePlatform } from '@devalbo/shared';
import { InMemoryDriver, createWatcherService, type IFilesystemDriver, type IWatcherService } from '@devalbo/filesystem';

let browserDriver: IFilesystemDriver | undefined;
const normalizeBrowserPath = (input: string): string => {
  if (input === '' || input === '.') return '/';
  if (input.startsWith('/')) return input;
  return `/${input}`;
};

export const getDriver = async (): Promise<IFilesystemDriver> => {
  const env = detectPlatform();
  if (env.platform === RuntimePlatform.NodeJS) {
    const { NativeFSDriver } = await import('@devalbo/filesystem/node');
    return new NativeFSDriver();
  }
  if (!browserDriver) {
    browserDriver = new InMemoryDriver({
      '/README.md': '# naveditor\nBrowser demo filesystem',
      '/notes.txt': 'Type commands in the shell to navigate or edit files.',
      '/src/index.ts': 'export const hello = () => \"world\";',
      '/tests/fixtures/sample-files/hello.txt': 'Hello, World!'
    });
    await browserDriver.mkdir(asDirectoryPath('/src'));
    await browserDriver.mkdir(asDirectoryPath('/tests'));
    await browserDriver.mkdir(asDirectoryPath('/tests/fixtures'));
    await browserDriver.mkdir(asDirectoryPath('/tests/fixtures/sample-files'));
  }

  return {
    readFile: (path) => browserDriver!.readFile(normalizeBrowserPath(path) as typeof path),
    writeFile: (path, data) => browserDriver!.writeFile(normalizeBrowserPath(path) as typeof path, data),
    readdir: (path) => browserDriver!.readdir(normalizeBrowserPath(path) as typeof path),
    stat: (path) => browserDriver!.stat(normalizeBrowserPath(path) as typeof path),
    mkdir: (path) => browserDriver!.mkdir(normalizeBrowserPath(path) as typeof path),
    rm: (path) => browserDriver!.rm(normalizeBrowserPath(path) as typeof path),
    exists: (path) => browserDriver!.exists(normalizeBrowserPath(path) as typeof path)
  };
};

export const getWatcher = async (): Promise<IWatcherService> => createWatcherService();
