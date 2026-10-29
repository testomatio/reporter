import { expect } from 'chai';
import { hideTestomatioToken } from '../../src/utils/hide_token.js';

describe('hideTestomatioToken', () => {
  it('hides the api_key value of a JSON body', () => {
    expect(hideTestomatioToken('{"api_key":"tstmt_secret123","title":"x"}')).to.equal(
      '{"api_key": "<hidden>","title":"x"}',
    );
  });

  it('hides a token inside an escaped JSON body, as inspected errors print it', () => {
    const inspected = 'config: { data: \'{\\"api_key\\":\\"tstmt_secret123\\"}\' }';

    expect(hideTestomatioToken(inspected)).to.not.include('tstmt_secret123');
    expect(hideTestomatioToken(inspected)).to.include('tstmt_***');
  });

  it('hides a bare token, wherever it appears', () => {
    expect(hideTestomatioToken('key=tstmt_secret-123 used')).to.equal('key=tstmt_*** used');
  });

  it('keeps data without a token unchanged', () => {
    expect(hideTestomatioToken('nothing to hide here')).to.equal('nothing to hide here');
  });

  it('returns an empty string for non-string data', () => {
    // @ts-ignore - the logger may pass anything
    expect(hideTestomatioToken({ api_key: 'tstmt_secret123' })).to.equal('');
  });
});
