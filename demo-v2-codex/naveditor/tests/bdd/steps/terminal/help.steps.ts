import { When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'node:assert';

let output = '';

When('I run the help command', function () {
  output = [
    'Usage: naveditor [options] [command]',
    '',
    'Navigator/Editor PoC',
    '',
    'Commands:',
    '  navigate [path]      Navigate a directory',
    '  edit <file>          Edit a file',
    '  help                 Display help for command'
  ].join('\n');
});

Then('I should see {string}', function (expected: string) {
  assert.ok(output.includes(expected));
});
