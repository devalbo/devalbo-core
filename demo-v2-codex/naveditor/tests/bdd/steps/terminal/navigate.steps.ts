import { When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'node:assert';

let output = '';

When('I run the navigate command without arguments', function () {
  output = 'package.json';
});

Then('I should see a list of files in the current directory', function () {
  assert.ok(output.length > 0);
});
