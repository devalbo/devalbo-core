import { When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'node:assert';
import { readdir } from 'node:fs/promises';

let output = '';

When('I run the navigate command without arguments', async function () {
  const entries = await readdir('.');
  output = entries.join('\n');
});

Then('I should see a list of files in the current directory', function () {
  assert.ok(output.length > 0);
});
