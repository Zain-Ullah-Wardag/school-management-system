import { strict as assert } from 'node:assert';
import { resolveLocalizedValue, type LocalizedValueState } from '../src/context/LanguageContext';

let state: LocalizedValueState | undefined;

state = resolveLocalizedValue('Loading…', 'en', state);
assert.equal(state.rendered, 'Loading…');

// React updates the same text node after its query resolves. The localizer
// must accept that new value rather than restoring the first loading label.
state = resolveLocalizedValue('100%', 'en', state);
assert.equal(state.source, '100%');
assert.equal(state.rendered, '100%');

state = resolveLocalizedValue('Unpaid', 'en');
state = resolveLocalizedValue('Paid', 'en', state);
assert.equal(state.source, 'Paid');
assert.equal(state.rendered, 'Paid');

// Urdu output written by the localizer is not mistaken for an application
// update, but a later React value is translated immediately.
state = resolveLocalizedValue('Unpaid', 'ur');
assert.equal(state.source, 'Unpaid');
assert.equal(state.rendered, 'غیر ادا شدہ');
state = resolveLocalizedValue(state.rendered, 'ur', state);
assert.equal(state.source, 'Unpaid');
state = resolveLocalizedValue('Paid', 'ur', state);
assert.equal(state.source, 'Paid');
assert.equal(state.rendered, 'ادا شدہ');

// Switching back to English restores the latest source, not the initial one.
state = resolveLocalizedValue(state.rendered, 'en', state);
assert.equal(state.rendered, 'Paid');

console.log('Language localization test passed: live React text and attribute updates are preserved in English and Urdu.');
