import { expect } from 'chai';
import { fetchSourceCode, fetchIdFromCode } from '../../src/utils/utils.js';
import DartAdapter from '../../src/junit-adapter/dart.js';

const sampleDartCode = `import 'package:patrol/patrol.dart';

void main() {
  patrolTest('Login test', ($) async {
    // @T00000001
    await $.tap(find.text('Login'));
  });

  patrolTest('Login test: [admin]', ($) async {
    // @T00000002
    await $.tap(find.text('Login as admin'));
  });

  testWidgets('Logout test', (tester) async {
    // @T00000003
    await tester.tap(find.text('Logout'));
  });
}`;

describe('Dart Code Import Tests', function () {
  const adapter = new DartAdapter();

  describe('fetchSourceCode', () => {
    it('finds the Android test block by title and does not leak other tests', () => {
      const result = fetchSourceCode(sampleDartCode, {
        title: 'runDartTest[tests.login_test Login test]',
        lang: 'dart',
      });

      expect(result).to.include("patrolTest('Login test'");
      expect(result).to.include('@T00000001');
      expect(result).to.not.include('@T00000002');
      expect(result).to.not.include('@T00000003');
    });

    it('finds the correct parameterized test block by title', () => {
      const result = fetchSourceCode(sampleDartCode, {
        title: 'runDartTest[tests.login_test Login test: [admin]]',
        lang: 'dart',
      });

      expect(result).to.include("patrolTest('Login test: [admin]'");
      expect(result).to.include('@T00000002');
      expect(result).to.not.include('@T00000001');
      expect(result).to.not.include('@T00000003');
    });

    it('finds the iOS test block by title', () => {
      const result = fetchSourceCode(sampleDartCode, {
        title: 'RunnerUITests tests.logout_test Logout test',
        lang: 'dart',
      });

      expect(result).to.include("testWidgets('Logout test'");
      expect(result).to.include('@T00000003');
      expect(result).to.not.include('@T00000001');
      expect(result).to.not.include('@T00000002');
    });

    it('falls back to main() when the test title cannot be matched', () => {
      const result = fetchSourceCode(sampleDartCode, {
        title: 'runDartTest[tests.unknown_test Unknown test]',
        lang: 'dart',
      });

      expect(result).to.include('void main()');
    });
  });

  describe('fetchIdFromCode', () => {
    it('returns the id for the matched test block only', () => {
      const code = fetchSourceCode(sampleDartCode, {
        title: 'runDartTest[tests.login_test Login test]',
        lang: 'dart',
      });

      expect(fetchIdFromCode(code, { lang: 'dart' })).to.eq('00000001');
    });
  });

  describe('DartAdapter#getFilePath', () => {
    it('resolves the Android file path', () => {
      const filePath = adapter.getFilePath({ title: 'runDartTest[tests.login_test Login test]' });
      expect(filePath.replace(/\\/g, '/')).to.eq('tests/login_test.dart');
    });

    it('resolves the iOS file path', () => {
      const filePath = adapter.getFilePath({ title: 'RunnerUITests tests.login_test Login test' });
      expect(filePath.replace(/\\/g, '/')).to.eq('tests/login_test.dart');
    });

    it('does not misclassify a parameterized iOS title as Android', () => {
      const filePath = adapter.getFilePath({ title: 'RunnerUITests tests.login_test Login: [admin]' });
      expect(filePath.replace(/\\/g, '/')).to.eq('tests/login_test.dart');
    });
  });

  describe('DartAdapter#formatTest', () => {
    it('formats an Android test and sets the file from the title', () => {
      const t = adapter.formatTest({ title: 'runDartTest[tests.path.to.test Login test]', suite_title: 'tests.path.to.test' });

      expect(t.title).to.eq('Login test');
      expect(t.file.replace(/\\/g, '/')).to.eq('tests/path/to/test.dart');
    });

    it('formats a parameterized Android test without leaving stray brackets', () => {
      const t = adapter.formatTest({ title: 'runDartTest[tests.path.to.test Login: [admin]]', suite_title: 'tests.path.to.test' });

      expect(t.title).to.eq('Login: ${param}');
      expect(t.example).to.deep.eq({ param: 'admin' });
      expect(t.file.replace(/\\/g, '/')).to.eq('tests/path/to/test.dart');
    });

    it('does not misclassify a parameterized iOS title as Android', () => {
      const t = adapter.formatTest({
        title: 'RunnerUITests tests.login_test Login: [admin]',
        suite_title: 'tests.login_test',
      });

      expect(t.title).to.eq('Login: ${param}');
      expect(t.file.replace(/\\/g, '/')).to.eq('tests/login_test.dart');
    });

    it('handles parameterized titles without a colon before the brackets', () => {
      const t = adapter.formatTest({ title: 'runDartTest[tests.path.to.test Login test [admin]]', suite_title: 'tests.path.to.test' });

      expect(t.title).to.eq('Login test ${param}');
      expect(t.example).to.deep.eq({ param: 'admin' });
    });

    it('handles multiple params consistently between detection and replacement', () => {
      const t = adapter.formatTest({
        title: 'runDartTest[tests.path.to.test Login [admin] as [root]]',
        suite_title: 'tests.path.to.test',
      });

      expect(t.title).to.eq('Login ${param1} as ${param2}');
      expect(t.example).to.deep.eq({ param1: 'admin', param2: 'root' });
    });

    it('does not keep a dead originalTitle property', () => {
      const t = adapter.formatTest({ title: 'runDartTest[tests.path.to.test Login test]', suite_title: 'tests.path.to.test' });
      expect(t.originalTitle).to.be.undefined;
    });
  });
});
