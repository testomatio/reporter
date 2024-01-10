const { expect } = require('chai');
const {
  fetchFilesFromStackTrace,
  fetchSourceCodeFromStackTrace,
  fetchIdFromCode,
  fetchIdFromOutput,
  fetchSourceCode,
 } = require('../lib/utils/utils');

describe('Utils', () => {
  it('#fetchFilesFromStackTrace | should match images from stack trace', () => {
    const file1 = `${process.cwd()}/tests/data/artifacts/failed_test.png`
    const file2 = `${process.cwd()}/tests/data/artifacts/screenshot1.png`
    
    const stack = `
PayrollPBTest:everyPayrollIsPositive =
                              |-------------------jqwik-------------------
tries = 1000                  | # of calls to property
checks = 1000                 | # of not rejected calls
  file:/${file1}
generation = RANDOMIZED       | parameters are randomly generated
after-failure = PREVIOUS_SEED | use the previous seed
edge-cases# file:/${file2}
edge-cases#total = 12         | # of all combined edge cases
edge-cases#tried = 12         | # of edge cases tried in current run
seed = 7004898156813507962    | random seed to reproduce generated values
    `
    const files = fetchFilesFromStackTrace(stack);
    expect(files).to.include(file1);
    expect(files).to.include(file2);
  });

  it('#fetchFilesFromStackTrace | should match images with one /', () => {
    const file1 = `${process.cwd()}/tests/data/artifacts/failed_test.png`
    
    const stack = `
PayrollPBTest:everyPayrollIsPositive =
                              |-------------------jqwik-------------------
tries = 1000                  | # of calls to property
  and file:${file1}
    `
    const files = fetchFilesFromStackTrace(stack);
    expect(files).to.include(file1);
  });  

  it('#fetchSourceCodeFromStackTrace | prefixed with at ', () => {
    const stack = `
Expected: <4.0>
     but: was <6.0>
  at ${process.cwd()}/tests/data/cli/RunCest.php:24
    `
    const source = fetchSourceCodeFromStackTrace(stack);
    expect(source).to.include(`$I->executeCommand('run --colors tests/dummy/FileExistsCept.php');`);
    expect(source).to.include(`24 >`);
  })

  it('#fetchSourceCodeFromStackTrace | without prefix', () => {
    const stack = `
Expected: <4.0>
     but: was <6.0>
${process.cwd()}/tests/data/cli/RunCest.php:24
    `
    const source = fetchSourceCodeFromStackTrace(stack);
    expect(source).to.include(`$I->executeCommand('run --colors tests/dummy/FileExistsCept.php');`);
    expect(source).to.include(`24 >`);
  })

  it('#fetchIdFromCode', () => {
    const code = `
    void sumIsNeutral(@ForAll double first, @ForAll double second) throws Exception {
      // @T8acca9eb
      double actual = calculator.Calculate(first, second, "+");
      double actualPlusZero = calculator.Calculate(actual, 0.0, "+");

      assertThat(actual, is(equalTo(actualPlusZero)));
  }

    `
    const id = fetchIdFromCode(code);
    expect(id).to.eql(`8acca9eb`);
  })

  it('#fetchIdFromOutput', () => {
    const code = `
    linss
    tid://@T8acca9eb

      assertThat(actual, is(equalTo(actualPlusZero)));
  }

    `
    const id = fetchIdFromOutput(code);
    expect(id).to.eql(`8acca9eb`);
  })

  it('#fetchSourceCode for complex java example', () => {

    const code = `
    import org.junit.jupiter.api.Assertions;
    import org.junit.jupiter.api.DisplayName;
    import org.junit.jupiter.api.Test;
    
    @Slf4j
    public class UserLoginTests extends BaseTest {
    ;
        @Test
        @DisplayName("UserLogin")
        public void testUserLogin() {
            // @Te4e19da3
            MainSearchScreen mainSearchScreen = new MainSearchScreen(driver);
        }
    }    
    `

    const test = fetchSourceCode(code, { lang: 'java', title: 'UserLogin' });
    // console.log(test);

    expect(test).to.include(`UserLogin`);
    expect(test).to.include(`@Te4e19da3`);

  })

  it('#fetchSourceCode takes DisplayName into account', () => {
    const code = `
    import org.junit.jupiter.api.Assertions;
    import org.junit.jupiter.api.DisplayName;
    import org.junit.jupiter.api.Test;
    
    public class BookingAppointmentTests extends BaseTest {
        @Test
        @DisplayName("BookingBySearch")
        public void testBookingAppointmentBySearch() {
            // @Tb60ca408
            MainSearchScreen mainSearchScreen = new MainSearchScreen(driver);
        }
    }
    `

    const test = fetchSourceCode(code, { lang: 'java', title: 'BookingBySearch' });
    // console.log(test);

    expect(test).to.include(`BookingBySearch`);
    expect(test).to.include(`@Tb60ca408`);


  })


});
