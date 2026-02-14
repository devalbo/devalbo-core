import { asFilePath } from '@devalbo/shared';
import { InMemoryDriver } from '@devalbo/filesystem';

const driver = new InMemoryDriver();
await driver.writeFile(asFilePath('/tmp/demo.txt'), new TextEncoder().encode('demo'));

const bytes = await driver.readFile(asFilePath('/tmp/demo.txt'));
console.log(new TextDecoder().decode(bytes));
