Feature:
As a user that selects a beverage that misses ingredients
then the machine should not brew that beverage
because something does not come from nothing

Background:
Given that the machine is plugged in


Scenario Outline: user buys a beverage with missing ingredients
Given that the user has selected <beverage>
And there is not enough <ingredient>
When the user presses the startbutton
Then the machine does not brew
And displays: <errormessage>

Examples:
    |         beverage | ingredient |                                  errormessage |
    | kaffesockermjolk |      kaffe |                   'Not enough coffee, refill' |
    |      kaffesocker |     socker |                    'Not enough sugar, refill' |
    |       kaffemjolk |      mjolk |                     'Not enough milk, refill' |
    |            kaffe |     vatten | 'No water supply connected, call maintenance' |
    |               te |       cups |                        'No more cups, refill' |
    |          choklad |    choklad |                'Not enough chocolate, refill' |
    |            latte |      mjolk |                     'Not enough milk, refill' |
    |            kanna |      kaffe |                   'Not enough coffee, refill' |


Scenario: the user tries to buy a beverage when the catch-spillage compartment is full
Given that the catch-spill compartment is full
And the user has selected a beverage
When the user presses the startbutton
Then no beverage gets brewed
And an error message is displayed: 'Empty the spillage compartment'

    Scenario: User presses the cancelbutton after three seconds from the moment the machine started brewing
        Given that the user has pressed startbutton
        When the user presses the cancelbutton
        And it has been more than three seconds since machine started brewing
        Then the machine continues brewing
        And the user gets the beverage

Scenario: The user unplugs the water during the brewing process
    Given that the user has selected a beverage
    And has pressed the startbutton
    When the user disconnects the water
    Then an error appears

Scenario: User presses two buttons at the same time
Given that the machine is plugged in
When the user presses two buttons at the same time
Then only one of them should light up (Prio list: coffee>latte>chocolate>te>milk>sugar>kanna)