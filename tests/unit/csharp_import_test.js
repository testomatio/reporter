import { expect } from 'chai';
import { fetchSourceCode } from '../../src/utils/utils.js';

describe('C# Code Import Tests', function () {
  const sampleCSharpCode = `using NUnit.Framework;

namespace NUnit_sample_test.Tests;

[TestFixture]
public class SampleTests
{
    [TestCase(true)]
    [TestCase(false)]
    public void TestBooleanValue(bool inputValue)
    {
        // Arrange
        var expectedResult = inputValue;
        
        // Act
        var actualResult = ProcessBooleanValue(inputValue);
        
        // Assert
        Assert.That(actualResult, Is.EqualTo(expectedResult));
    }
    
    /// <summary>
    /// We want also to keep this summary as a part of test
    /// source code in Testomat
    /// </summary>
    [TestCase(1, 2, 3)]
    [TestCase(5, 10, 15)]
    [TestCase(-1, -2, -3)]
    public void TestAddition(int a, int b, int expected)
    {
        // Arrange & Act
        var result = AddNumbers(a, b);
        
        // Assert
        Assert.That(result, Is.EqualTo(expected));
    }
    
    [TestCase("hello", "HELLO")]
    [TestCase("world", "WORLD")]
    [TestCase("", "")]
    public void TestStringToUpper(string input, string expected)
    {
        // Arrange & Act
        var result = input.ToUpper();
        
        // Assert
        Assert.That(result, Is.EqualTo(expected));
    }
    
    // Helper methods for testing
    private bool ProcessBooleanValue(bool value)
    {
        return value;
    }
    
    private int AddNumbers(int a, int b)
    {
        return a + b;
    }

    [TestCase]
    public void SamplePTest()
    {
        Console.Write("some text");
    }

}`;

  it('should import TestBooleanValue method with [TestCase] attributes', () => {
    const result = fetchSourceCode(sampleCSharpCode, {
      title: 'TestBooleanValue',
      lang: 'csharp',
    });

    expect(result).to.include('[TestCase(true)]');
    expect(result).to.include('[TestCase(false)]');
    expect(result).to.include('public void TestBooleanValue(bool inputValue)');
    expect(result).to.include('Assert.That(actualResult, Is.EqualTo(expectedResult));');
    expect(result).to.not.include('TestAddition'); // Should not include other methods
    expect(result).to.not.include('private bool ProcessBooleanValue'); // Should not include helper method definitions
  });

  it('should import TestAddition method with XML documentation', () => {
    const result = fetchSourceCode(sampleCSharpCode, {
      title: 'TestAddition',
      lang: 'csharp',
    });

    expect(result).to.include('/// <summary>');
    expect(result).to.include('We want also to keep this summary as a part of test');
    expect(result).to.include('[TestCase(1, 2, 3)]');
    expect(result).to.include('[TestCase(5, 10, 15)]');
    expect(result).to.include('[TestCase(-1, -2, -3)]');
    expect(result).to.include('public void TestAddition(int a, int b, int expected)');
    expect(result).to.include('Assert.That(result, Is.EqualTo(expected));');
    expect(result).to.not.include('TestBooleanValue'); // Should not include other methods
    expect(result).to.not.include('private int AddNumbers'); // Should not include helper method definitions
  });

  it('should import TestStringToUpper method with [TestCase] attributes', () => {
    const result = fetchSourceCode(sampleCSharpCode, {
      title: 'TestStringToUpper',
      lang: 'csharp',
    });

    expect(result).to.include('[TestCase("hello", "HELLO")]');
    expect(result).to.include('[TestCase("world", "WORLD")]');
    expect(result).to.include('[TestCase("", "")]');
    expect(result).to.include('public void TestStringToUpper(string input, string expected)');
    expect(result).to.include('Assert.That(result, Is.EqualTo(expected));');
    expect(result).to.not.include('TestAddition'); // Should not include other methods
    expect(result).to.not.include('Helper methods'); // Should not include helper comment
  });

  it('should import SamplePTest method with [TestCase] attribute', () => {
    const result = fetchSourceCode(sampleCSharpCode, {
      title: 'SamplePTest',
      lang: 'csharp',
    });

    expect(result).to.include('[TestCase]');
    expect(result).to.include('public void SamplePTest()');
    expect(result).to.include('Console.Write("some text");');
    expect(result).to.not.include('TestStringToUpper'); // Should not include other methods
    expect(result).to.not.include('}'); // Should not include class closing brace
  });

  it('should handle parameterized test titles correctly', () => {
    // Test with parameterized title (as it might come from XML)
    const result = fetchSourceCode(sampleCSharpCode, {
      title: 'TestBooleanValue(true)',
      lang: 'csharp',
    });

    expect(result).to.include('[TestCase(true)]');
    expect(result).to.include('[TestCase(false)]');
    expect(result).to.include('public void TestBooleanValue(bool inputValue)');
    expect(result).to.not.include('TestAddition');
  });

  it('should not import multiple methods in one call', () => {
    const result = fetchSourceCode(sampleCSharpCode, {
      title: 'TestBooleanValue',
      lang: 'csharp',
    });

    // Count method declarations
    const methodMatches = result.match(/public\s+(void|async\s+Task)\s+\w+\(/g);
    expect(methodMatches).to.have.length(1);
  });

  it('should include XML documentation when present', () => {
    const result = fetchSourceCode(sampleCSharpCode, {
      title: 'TestAddition',
      lang: 'csharp',
    });

    expect(result).to.include('/// <summary>');
    expect(result).to.include('/// We want also to keep this summary as a part of test');
    expect(result).to.include('/// source code in Testomat');
    expect(result).to.include('/// </summary>');
  });

  it('should stop at helper methods and not include them', () => {
    const result = fetchSourceCode(sampleCSharpCode, {
      title: 'TestStringToUpper',
      lang: 'csharp',
    });

    expect(result).to.not.include('private bool ProcessBooleanValue');
    expect(result).to.not.include('private int AddNumbers');
    expect(result).to.not.include('// Helper methods for testing');
  });
});
