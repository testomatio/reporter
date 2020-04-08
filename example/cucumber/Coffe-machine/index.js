class MyMachine{

    constructor() {
        this.pluggedInWater = false
        this.pluggedInPower = false
        this.waterPerCup = 180
        this.waterPerKanna = 1800
        this.waterPerLatte = 60
        this.coffeePerCup = 9
        this.coffePerLatteCup = 3
        this.milkPerCup = 10
        this.milkPerLatteCup = 120
        this.coffeePerKanna = 90
        this.sugarPerCup = 10
        this.chocolatePerCup = 10
        this.amountofCoffee = 0
        this.amountofMilk = 0
        this.amountofSugar = 0
        this.amountofChocolate = 0
        this.latteButtonPressed = false
        this.kaffeButtonPressed = true
        this.teButtonPressed = false
        this.chokladButtonPressed = false
        this.sockerButtonPressed = false
        this.mjolkButtonPressed = false
        this.kannaButtonPressed = false
        this.startButtonPressed = false
        this.cancelButtonPressed = false
        this.amountOfMoneyPaid = 0
        this.reservedAmountFromCardPaid = 0
        this.pricePerCup = 10
        this.amountOfCups = 0
        this.coffeeLidClosed = true
        this.milkLidClosed = true
        this.cupLidClosed = true
        this.chocolateLidClosed = true
        this.cardPaymentSuccessful = false
        this.amountOfChange = 0
        this.beverageBrewedSuccessfully = false
        this.timesPaidWithCardCounter = 0

    }

    checkIfPluggedIn() {
        
    }

    checkIfWaterIsPluggedIn() {

        this.pluggedInWater = true

    }

    coffeeSupplyLeft() {

    }

    milkSupplyLeft() {

    }

    sugarSupplyLeft() {

    }

    chocolateSupplyLeft() {

    }

    cupSupplyLeft() {

    }

    start() {

        if (this.pluggedInWater == false) {

            return 'No water plugged in, please call maintenance'
        
        }
        
        else if (this.amountOfCups == 0) {
            
            return 'Not enough cups, please refill'

        }

        else if (this.amountOfMoneyPaid + this.reservedAmountFromCardPaid < 10) {
            
            return 'Not enough money paid'
            
        }

        else if (this.kaffeButtonPressed && this.mjolkButtonPressed && this.sockerButtonPressed) {
            if (this.amountofCoffee < this.coffeePerCup || this.amountofMilk < this.milkPerCup || this.amountofSugar < this.sugarPerCup) {
                return 'Not enough ingredients, please refill!'
            }
            else {
                return 1
            }
        }

    }

    cancel() {

    }

    brewBeverage() {

    }

    brewCoffeeMilkSugar() {

    }

    brewCoffeeMilk() {

    }

    brewCoffeeSugar() {

    }

    brewCoffee() {

    }

    brewTe() {

    }

    brewLatte() {

    }

    brewKanna() {

    }

    brewChocolate() {

    }

    reservedCardPaymentHandler() {
        
    }

    returnChange() {

        if (this.cancelButtonPressed && this.reservedAmountFromCardPaid > 0 && this.amountOfMoneyPaid > 0) {
            this.amountOfChange = this.amountOfMoneyPaid
            this.amountOfMoneyPaid = 0
            //insert method here to tell bank to not pay the reserved amount, i dont
            this.reservedAmountFromCardPaid = 0
            this.cancelButtonPressed = false
            return this.amountOfChange
        }

        else if (this.timesPaidWithCardCounter > 0) {
            this.amountOfChange = this.amountOfMoneyPaid + this.reservedAmountFromCardPaid - this.pricePerCup * this.timesPaidWithCardCounter
            this.amountOfMoneyPaid = 0
            this.reservedAmountFromCardPaid = 0
            this.startButtonPressed = false
            this.timesPaidWithCardCounter = 0
            return this.amountOfChange
        }
        else if (this.timesPaidWithCardCounter == 0 && this.startButtonPressed == true) {

            this.amountOfChange = this.amountOfMoneyPaid + this.reservedAmountFromCardPaid - this.pricePerCup
            this.amountOfMoneyPaid = 0
            this.reservedAmountFromCardPaid = 0
            this.startButtonPressed = false
            this.timesPaidWithCardCounter = 0
            return this.amountOfChange
            
        }

        else if (this.timesPaidWithCardCounter == 0 && this.cancelButtonPressed == true) {

            this.amountOfChange = this.amountOfMoneyPaid
            this.amountOfMoneyPaid = 0
            this.reservedAmountFromCardPaid = 0
            this.startButtonPressed = false
            this.timesPaidWithCardCounter = 0
            return this.amountOfChange

        }

    }

    payByCard(ifTransactionSucceeded) {

        if (ifTransactionSucceeded) {
            this.reservedAmountFromCardPaid += 10
            this.timesPaidWithCardCounter++
        }

        else {
            return 'Transaction failed, not enough funds'
        }

    }

    payByStudentCard() {

        this.reservedAmountFromCardPaid += 10
        this.timesPaidWithCardCounter++

    }

    checkInsertedCoinObject(objectValue) {

        objectValue = Number(objectValue)
        //code here for determinining correct currency
        if (objectValue == 1 || objectValue == 2 || objectValue == 5 || objectValue == 10 || objectValue == 0) {
            this.payByCash(objectValue)
            return true
        }

        else {
            return 'Invalid object, try again'
        }
        
    }

    payByCash(amount) {
        let paidMoney = amount/1
        this.amountOfMoneyPaid += paidMoney
        return true
    }

    selectSugar() {

        if (this.sockerButtonPressed) {
            this.sockerButtonPressed = false
        }
        else {
            this.sockerButtonPressed = true
        }
        

    }

    selectMilk() {

        if (this.mjolkButtonPressed) {
            this.mjolkButtonPressed = false
        }
        else {
            this.mjolkButtonPressed = true
        }

    }

    selectKanna() {

        if (this.kannaButtonPressed) {
            this.kannaButtonPressed = false
        }
        else {
            this.kannaButtonPressed = true
            this.kaffeButtonPressed = true
            this.sockerButtonPressed = false
            this.mjolkButtonPressed = false
            this.teButtonPressed = false
            this.chokladButtonPressed = false
            this.latteButtonPressed = false
        }

    }

    selectCoffee() {

        if (this.kaffeButtonPressed) {
            this.kaffeButtonPressed = false
        }
        else {
            this.kaffeButtonPressed = true
            this.latteButtonPressed = false
            this.teButtonPressed = false
            this.chokladButtonPressed = false
        }

    }

    selectLatte() {

        if (this.latteButtonPressed) {
            this.latteButtonPressed = false
        }
        else {
            this.kaffeButtonPressed = false
            this.latteButtonPressed = true
            this.teButtonPressed = false
            this.chokladButtonPressed = false
        }

    }

    selectTe() {

        if (this.teButtonPressed) {
            this.teButtonPressed = false
        }
        else {
            this.kaffeButtonPressed = false
            this.latteButtonPressed = false
            this.teButtonPressed = true
            this.chokladButtonPressed = false
        }

    }

    selectChocolate() {

        if (this.chokladButtonPressed) {
            this.chokladButtonPressed = false
        }
        else {
            this.kaffeButtonPressed = false
            this.latteButtonPressed = false
            this.teButtonPressed = false
            this.chokladButtonPressed = true
        }

    }

    refillSugar(weightAmount) {

        this.amountofSugar += weightAmount
        return true

    }

    refillMilk(weightAmount) {

        this.amountofMilk += weightAmount
        return true

    }

    refillCoffee(weightAmount) {

        this.amountofCoffee += weightAmount
        return true

    }

    refillChocolate(weightAmount) {

        this.amountofChocolate += weightAmount
        return true
        
    }

    refillCups(weightAmount) {

        weightAmount = (weightAmount / 2.4)
        this.amountOfCups += weightAmount
        return true

    }

    



}


module.exports = MyMachine;