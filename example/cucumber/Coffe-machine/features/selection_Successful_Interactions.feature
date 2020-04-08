Feature:
As a coffee buyer
I want to be able to pick different types of beverages and get the beverage i picked
Because my taste of beverage varies from day to day

Background:
Given that the machine is plugged in
And there is water available
And the user has paid enough money

Scenario Outline:
Given that the user has selected <beverage>
And there is enough components for <beverage>
When the user presses the startbutton
Then the user recieves <cups> cup of beverage

Examples:
    |         beverage | cups |
    | kaffemjolksocker |    1 |
    |       kaffemjolk |    1 |
    |      kaffesocker |    1 |
    |            kaffe |    1 |
    |            latte |    1 |
    |               te |    1 |
    |          choklad |    1 |
    |            kanna |    0 |


Scenario Outline: User selects a beverage(coffee,latte,te,chocolate), the button lights up and the others goes dark
When the user presses the <button1> button
Then the button should light up
And the <button2> should go dark
And the <button3> should go dark
And the <button4> should go dark

Examples:
    |   button1 | button2 | button3 |   button4 |
    |     kaffe |      te |   latte | chocolate |
    |     latte |   kaffe |      te | chocolate |
    |        te |   kaffe |   latte | chocolate |
    | chocolate |   kaffe |   latte |        te |


Scenario:User buys a coffee with milk and sugar
When the user selects a coffee with milk and sugar
And presses the startbutton
Then the coffee machine brews a coffee with milk and sugar

    Scenario: User presses the cancelbutton within three seconds from the moment the machine started brewing
        Given that the user has pressed startbutton
        When the user presses the cancelbutton
        And it has been less than three seconds since machine started brewing
        Then the machine stops brewing
        And goes back to the screen displayed before the user pressed start


