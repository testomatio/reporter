const assert = require('assert');
const { defineSupportCode } = require('cucumber');
const coffeeMachine = require('../../index.js');


defineSupportCode(({ Given, When, Then }) => {

  let myMachine = new coffeeMachine();

  Given(/^that the machine is plugged in$/, () => {
    myMachine.pluggedInPower = true;
    assert.deepEqual(myMachine.pluggedInPower, true, 'machine is plugged in');
  });

  When(/^I have inserted a (\d+) coin$/, (def1) => {
    def1 = Number(def1);
    assert.deepEqual(myMachine.checkInsertedCoinObject(def1), true, 'User inserted money');
    assert.deepEqual(myMachine.amountOfMoneyPaid, def1);
  });

  When(/^a (\d+) coin$/, (arg1) => {
    arg1 = Number(arg1);
    const checkAmount = arg1 + myMachine.amountOfMoneyPaid;
    assert.deepEqual(myMachine.checkInsertedCoinObject(arg1), true, 'User inserted more money');
    assert.deepEqual(myMachine.amountOfMoneyPaid, checkAmount);
  });

  When(/^I press the startbutton$/, () => {
    myMachine.startButtonPressed = true;
    assert.deepEqual(myMachine.startButtonPressed, true);
  });

  Then(/^i should recieve (\d+)kr in coins back$/, (arg1) => {
    arg1 = Number(arg1);
    assert.deepEqual(myMachine.returnChange(), arg1);
  });

  myMachine = new coffeeMachine();

  When(/^I insert something that is not a valid coin into the coinsocket$/, () => {
    assert.deepEqual(myMachine.checkInsertedCoinObject('knapp'), 'Invalid object, try again');
    assert.deepEqual(myMachine.checkInsertedCoinObject('elefant'), 'Invalid object, try again');
  });

  Then(/^I should get an error message$/, () => {
    assert.deepEqual(myMachine.checkInsertedCoinObject('polett'), 'Invalid object, try again');
  });

  myMachine = new coffeeMachine();

  When(/^I insert a (\d+)kr coin$/, (arg1) => {
    arg1 = Number(arg1);
    myMachine.checkInsertedCoinObject(arg1);
    assert.deepEqual(arg1, myMachine.amountOfMoneyPaid);
  });

  When(/^I pay (\d+)kr with card$/, (arg1) => {
    arg1 = Number(arg1);
    const checkerAmount = myMachine.reservedAmountFromCardPaid + arg1;
    myMachine.payByCard(true);
    assert.deepEqual(myMachine.reservedAmountFromCardPaid, checkerAmount);
  });

  When(/^i press the startbutton$/, () => {
    myMachine.startButtonPressed = true;
    assert.deepEqual(myMachine.startButtonPressed, true);
  });

  Then(/^i should recieve (\d+)kr in change$/, (arg1) => {
    arg1 = Number(arg1);

    assert.deepEqual(myMachine.returnChange(), arg1);
  });

  myMachine = new coffeeMachine();

  When(/^i pay by card$/, () => {
    assert(true);
  });

  When(/^i do not have enough money$/, () => {
    assert.notDeepEqual(myMachine.payByCard(false), true);
  });

  Then(/^i should get a message that i do not have enough funds$/, () => {
    assert.deepEqual(myMachine.payByCard(false), 'Transaction failed, not enough funds');
  });

  myMachine = new coffeeMachine();

  Given(/^that i have not inserted enough money$/, () => {
    myMachine.pluggedInWater = true;
    myMachine.amountOfCups = 5;
    assert.equal(true, myMachine.amountOfMoneyPaid < myMachine.pricePerCup);
  });

  Then(/^I should get a message that i have not inserted enough money$/, () => {
    assert.deepEqual(myMachine.start(), 'Not enough money paid');
  });

  mymachine = new coffeeMachine();

  Given(/^that i have payed (\d+) kr$/, (arg1) => {
    arg1 = Number(arg1);
    myMachine.payByCash(arg1);
    assert.deepEqual(myMachine.amountOfMoneyPaid, arg1);
  });

  Given(/^have not pressed the startbutton$/, () => {
    myMachine.startButtonPressed = false;
    assert.deepEqual(myMachine.startButtonPressed, false);
  });

  When(/^i press the cancelbutton$/, () => {
    myMachine.cancelButtonPressed = true;
    assert.deepEqual(myMachine.cancelButtonPressed, true);
  });

  Then(/^i should get (\d+)kr back$/, (arg1) => {
    arg1 = Number(arg1);
    myMachine.timesPaidWithCardCounter = 0;
    const changeIGetBack = myMachine.returnChange();
    assert.deepEqual(changeIGetBack, arg1);
  });

  mymachine = new coffeeMachine();

  Given(/^that the user has payed with card$/, () => {
    myMachine.payByCard(true);
    assert.equal(true, myMachine.reservedAmountFromCardPaid > 0);
  });

  When(/^the user presses the cancelbutton$/, () => {
    myMachine.cancelButtonPressed = true;
    assert.deepEqual(myMachine.cancelButtonPressed, true);
  });

  Then(/^the user gets no change back$/, () => {
    assert.deepEqual(myMachine.returnChange(), 0);
  });

  Then(/^no money is deducted from the card$/, () => {
    assert.deepEqual(myMachine.reservedAmountFromCardPaid, 0);
  });

  myMachine = new coffeeMachine();

  Given(/^that I have opened the lid to the deposit$/, () => {
    myMachine.coffeeLidClosed = false;
    myMachine.milkLidClosed = false;
    myMachine.cupLidClosed = false;
    myMachine.chocolateLidClosed = false;
    myMachine.sugarLidClosed = false;

    assert.deepEqual(myMachine.coffeeLidClosed, false);
    assert.deepEqual(myMachine.milkLidClosed, false);
    assert.deepEqual(myMachine.cupLidClosed, false);
    assert.deepEqual(myMachine.chocolateLidClosed, false);
    assert.deepEqual(myMachine.sugarLidClosed, false);
  });

  Given(/^that the sugar deposit contains (\d+)$/, (amount) => {
    amount = Number(amount);
    myMachine.amountofSugar = amount;

    assert.deepEqual(myMachine.amountofSugar, amount);
  });

  Given(/^I put in (\d+) in the sugar deposit$/, (refillAmount) => {
    refillAmount = Number(refillAmount);
    assert.deepEqual(myMachine.refillSugar(refillAmount), true);
  });

  When(/^I close the lid of the deposit$/, () => {
    myMachine.sugarLidClosed = true;
    assert.deepEqual(myMachine.sugarLidClosed, true);
  });

  Then(/^I should have (\d+) in the sugar deposit$/, (totalAmount) => {
    totalAmount = Number(totalAmount);
    assert.deepEqual(myMachine.amountofSugar, totalAmount);
  });

  Given(/^that the coffee deposit contains (\d+)$/, (amountOfCoffeeStart) => {
    amountOfCoffeeStart = Number(amountOfCoffeeStart);
    myMachine.amountofCoffee = amountOfCoffeeStart;

    assert.deepEqual(myMachine.amountofCoffee, amountOfCoffeeStart);
  });

  Given(/^I put in (\d+) in the coffee deposit$/, (amountToRefill) => {
    amountToRefill = Number(amountToRefill);

    assert.deepEqual(myMachine.refillCoffee(amountToRefill), true);
  });

  Then(/^I should have (\d+) in the coffee deposit$/, (totalAmount) => {
    totalAmount = Number(totalAmount);
    assert.deepEqual(myMachine.amountofCoffee, totalAmount);
  });

  Given(/^that the milk deposit contains (\d+)$/, (amountOfMilkStart) => {
    amountOfMilkStart = Number(amountOfMilkStart);
    myMachine.amountofMilk = amountOfMilkStart;

    assert.deepEqual(myMachine.amountofMilk, amountOfMilkStart);
  });

  Given(/^I put in (\d+) in the milk deposit$/, (amountToRefill) => {
    amountToRefill = Number(amountToRefill);

    assert.deepEqual(myMachine.refillMilk(amountToRefill), true);
  });

  Then(/^I should have (\d+) in the milk deposit$/, (totalAmount) => {
    totalAmount = Number(totalAmount);
    assert.deepEqual(myMachine.amountofMilk, totalAmount);
  });

  Given(/^that the chocolate deposit contains (\d+)$/, (amountOfChocolateStart) => {
    amountOfChocolateStart = Number(amountOfChocolateStart);
    myMachine.amountofChocolate = amountOfChocolateStart;

    assert.deepEqual(myMachine.amountofChocolate, amountOfChocolateStart);
  });

  Given(/^I put in (\d+) in the chocolate deposit$/, (amountToRefill) => {
    amountToRefill = Number(amountToRefill);

    assert.deepEqual(myMachine.refillChocolate(amountToRefill), true);
  });

  Then(/^I should have (\d+) in the chocolate deposit$/, (totalAmount) => {
    totalAmount = Number(totalAmount);
    assert.deepEqual(myMachine.amountofChocolate, totalAmount);
  });

  Given(/^that the cup deposit contains (\d+)$/, (amountOfCupsStart) => {
    amountOfCupsStart = Number(amountOfCupsStart);
    myMachine.amountOfCups = amountOfCupsStart;

    assert.deepEqual(myMachine.amountOfCups, amountOfCupsStart);
  });

  Given(/^I put in (\d+) in the cup deposit$/, (amountToRefill) => {
    amountToRefill = Number(amountToRefill);

    assert.deepEqual(myMachine.refillCups(amountToRefill), true);
  });

  Then(/^I should have (\d+) in the cup deposit$/, (totalAmount) => {
    totalAmount = Number(totalAmount);
    assert.deepEqual(myMachine.amountOfCups, totalAmount);
  });

  mymachine = new coffeeMachine();

  Given(/^there is water available$/, () => {
    myMachine.checkIfWaterIsPluggedIn();

    assert.deepEqual(myMachine.pluggedInWater, true);
  });

  Given(/^the user has paid enough money$/, () => {
    myMachine.payByCash(300);

    assert.equal(true, myMachine.amountOfMoneyPaid > myMachine.pricePerCup);
  });

  Given(/^that the user has selected kaffemjolksocker$/, () => {
    myMachine.selectMilk();
    myMachine.selectSugar();

    assert.deepEqual(myMachine.kaffeButtonPressed, true);
    assert.deepEqual(myMachine.sockerButtonPressed, true);
    assert.deepEqual(myMachine.mjolkButtonPressed, true);
  });

  Given(/^there is enough components for kaffemjolksocker$/, () => {
    myMachine.refillCoffee(500);
    myMachine.refillMilk(500);
    myMachine.refillSugar(500);
    myMachine.refillCups(240);
    assert.equal(true, myMachine.amountofCoffee > myMachine.coffeePerCup);
    assert.equal(true, myMachine.amountofSugar > myMachine.sugarPerCup);
    assert.equal(true, myMachine.amountofMilk > myMachine.milkPerCup);
    assert.equal(true, myMachine.amountofMilk > 0);
  });

  When(/^the user presses the startbutton$/, () => {
    myMachine.startButtonPressed = true;
    assert.deepEqual(myMachine.startButtonPressed, true);
  });

  Then(/^the user recieves (\d+) cup of beverage$/, (arg1) => {
    arg1 = Number(arg1);

    assert.deepEqual(myMachine.start(), arg1);
  });
});
