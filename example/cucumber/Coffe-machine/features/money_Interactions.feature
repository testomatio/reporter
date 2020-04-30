Feature:
    As a coffee buyer
    I want to be able to recieve the money i inserted when i press the cancel button and the machine is not brewing
    Because i changed my mind

    Background:
        Given that the machine is plugged in

    Scenario Outline: the user inserts a lot of different coins and wants the correct change
        When I have inserted a <coin1> coin
        And a <coin2> coin
        And a <coin3> coin
        And a <coin4> coin
        And a <coin5> coin
        And a <coin6> coin
        And a <coin7> coin
        And I press the startbutton
        Then i should recieve <change>kr in coins back

        Examples:
            | coin1 | coin2 | coin3 | coin4 | coin5 | coin6 | coin7 | change |
            | 10    | 0     | 0     | 0     | 0     | 0     | 0     | 0      |
            | 1     | 1     | 1     | 2     | 2     | 2     | 2     | 1      |
            | 5     | 2     | 2     | 2     | 0     | 0     | 0     | 1      |
            | 10    | 5     | 5     | 2     | 1     | 0     | 0     | 13     |

    Scenario: the user inserts something that is not a valid coin into the coinsocket
        When I insert something that is not a valid coin into the coinsocket
        Then I should get an error message

    Scenario Outline: The user puts in a coin, and then pays by card
        When I insert a <coin>kr coin
        And I pay <cardAmount>kr with card
        And i press the startbutton
        Then i should recieve <change>kr in change

        Examples:
            | coin | cardAmount | change |
            | 5    | 10         | 5      |
            | 2    | 10         | 2      |
            | 1    | 10         | 1      |
    
    Scenario: The user pays with a card without enough funds on it
        When i pay by card
        And i do not have enough money
        Then i should get a message that i do not have enough funds

    Scenario: The user tries to buy a coffee without inserting enough money
        Given that i have not inserted enough money
        When I press the startbutton
        Then I should get a message that i have not inserted enough money
    
    Scenario Outline: The user presses the cancel button when the machine is not brewing
        Given that i have payed <amount> kr
        And have not pressed the startbutton
        When i press the cancelbutton
        Then i should get <change>kr back

        Examples:
            | amount | change |
            | 10     | 10     |
            | 13     | 13     |

    Scenario: User pays with card, then presses the cancelbutton
        Given that the user has payed with card
        When the user presses the cancelbutton
        Then the user gets no change back
        And no money is deducted from the card

