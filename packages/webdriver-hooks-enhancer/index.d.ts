export default class WebdriverHooksEnhancer {
  constructor();
  trackHookFailure(hook: any): void;
  handleSuiteEnd(suiteOrScenario: any, client: any, getTestomatIdFromTestTitle: (title: string) => string): Promise<void>;
  extractTestsFromSpecFile(filePath: string): string[];
  hasHookFailure(suiteTitle: string): boolean;
  getHookFailure(suiteTitle: string): any;
  clearHookFailures(): void;
  hookFailures: Record<string, any>;
}

export declare function createHooksEnhancer(reporter: any): WebdriverHooksEnhancer;
