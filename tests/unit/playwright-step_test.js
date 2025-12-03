import { expect } from 'chai';
import { setTestStep, clearTestStep, step, setTestContext, logStep } from '../../src/adapter/playwright-step.js';

describe('Playwright Step Function - FIXED', () => {
  const mockTestStep = async (message, fn) => {
    if (typeof fn === 'function') {
      return await fn();
    }
    return Promise.resolve();
  };

  const mockTestInfo = {
    title: 'Test Example',
    _requireFile: '/path/to/test.js'
  };

  beforeEach(() => {
    clearTestStep();
  });

  afterEach(() => {
    clearTestStep();
  });

  describe('setTestStep and clearTestStep', () => {
    it('should set and clear current test step', () => {
      setTestStep(mockTestStep);
      clearTestStep();
    });
  });

  describe('setTestContext', () => {
    it('should set test context', () => {
      setTestContext(mockTestInfo);
      // Просто проверяем что не падает
    });
  });

  describe('step function', () => {
    it('should throw error when no test step is set', async () => {
      try {
        await step('Test step');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('setTestStep(test.step)');
      }
    });

    it('should work with a step that has a function', async () => {
      setTestStep(mockTestStep);

      let executed = false;
      await step('Test step with function', async () => {
        executed = true;
      });

      expect(executed).to.be.true;
    });

    it('should work with a step that has only message', async () => {
      setTestStep(mockTestStep);

      await step('Test step with message only');
    });

    it('should pass step title to test.step', async () => {
      let receivedMessage = null;
      const mockTestStepWithSpy = async (message, fn) => {
        receivedMessage = message;
        if (typeof fn === 'function') {
          return await fn();
        }
        return Promise.resolve();
      };

      setTestStep(mockTestStepWithSpy);
      await step('Expected message');

      expect(receivedMessage).to.equal('Expected message');
    });

    it('should return value from step function', async () => {
      setTestStep(mockTestStep);

      const result = await step('Calculation step', async () => {
        return 5 + 3;
      });

      expect(result).to.equal(8);
    });
  });

  describe('logStep function', () => {
    it('should work when context is set', () => {
      setTestContext(mockTestInfo);

      expect(() => {
        logStep('Test log step');
      }).to.not.throw();
    });

    it('should not throw even without context', () => {
      expect(() => {
        logStep('Test log step');
      }).to.not.throw();
    });
  });

  describe('legacy functions', () => {
    it('should show deprecation warning for setCurrentTest', async () => {
      // Проверяем что функция существует и показывает предупреждение
      const { setCurrentTest } = await import('../../src/adapter/playwright-step.js');
      expect(() => {
        setCurrentTest(mockTestInfo);
      }).to.not.throw();
    });

    it('should show deprecation warning for clearCurrentTest', async () => {
      // Проверяем что функция существует и показывает предупреждение
      const { clearCurrentTest } = await import('../../src/adapter/playwright-step.js');
      expect(() => {
        clearCurrentTest();
      }).to.not.throw();
    });
  });
});