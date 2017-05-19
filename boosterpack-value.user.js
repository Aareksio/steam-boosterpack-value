// ==UserScript==
// @name            Steam Boosterpack Value Checker
// @namespace       https://sygulski.pl/
// @version         1.0
// @description     Displays the market price of a boosterpack on creation page
// @author          Mole
// @match           *://steamcommunity.com/tradingcards/boostercreator/*
// @match           *://steamcommunity.com/tradingcards/boostercreator/
// @require		    https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min.js
// @grant           none
// ==/UserScript==

$.ajaxSetup({
    xhrFields: {
        withCredentials: true
    }
});

// Current currency (numerical identifier used by Steam)
let g_Currency = 1;
let g_SessionID;

// Detailed information for each currency ID (using information taken from Steam's Javascript source code)
const g_CurrencyInfo = {
    1: { symbol: "$", separator: "." },
    2: { symbol: "£", separator: "." },
    3: { symbol: "€", separator: "," },
    5: { symbol: "RUB", separator: "," }, // No unicode support for the new symbol yet
    7: { symbol: "R$", separator: "," }
};

// Function to format the string using the currency information
function formatPrice(price, full) {
    if (full) {
        return g_CurrencyInfo[g_Currency].symbol + formatPrice(price);
    }

    return price.replace(".", g_CurrencyInfo[g_Currency].separator);
}

$('.booster_game_selector').on('change', loadPrice);
loadPrice();

function loadPrice() {
    const $boosterPack = $('#booster_game_selector_booster');
    const $image = $boosterPack.find('.booster_option_image');

    if (!$image.length) return;
    if ($boosterPack.find('.booster_price').length) return console.log('Already loaded!'); // Already loaded

    const $gemPrice = $boosterPack.find('.booster_goo_cost');
    const gemCost = parseInt($gemPrice.html().replace('&nbsp;', ''), 10);

    const $marketPrice = $('<div class="booster_price" style="color: #67c1f5; margin-bottom: 5px;">Price: <span class="price">Loading...</span></div>');
    const $price = $marketPrice.find('.price');

    $gemPrice.before($marketPrice);

    const gameID = $image.attr('src').match(/\/boosterpack\/(\d+)/)[1];
    const gameName = $image.data('community-tooltip-notused');
    const marketURL = 'http://steamcommunity.com/market/listings/753/' + gameID + '-' + encodeURIComponent(gameName + ' Booster Pack');

    $.get(marketURL, function(html) {
        if (html.match(/There are no listings for this item\./)) {
            return $price.text('Error');
        }

        const marketID = html.match(/Market_LoadOrderSpread\(\s*(\d+)\s*\);/);
        const sessionID = html.match(/g_sessionID = "(.+)";/);
        const countryCode = html.match(/g_strCountryCode = "([a-zA-Z0-9]+)";/);
        const currency = html.match(/"wallet_currency":(\d)/);
        const hashName = html.match(/"market_hash_name":"([^"]+)"/);

        if (!marketID || !sessionID || !countryCode || !currency || !hashName) {
            return $price.text('Error');
        }

        g_Currency = currency[1];
        g_SessionID = sessionID[1];

        $.get('/market/itemordershistogram', {
            country: countryCode[1],
            language: 'english',
            currency: g_Currency,
            item_nameid: marketID[1]
        }, function(json) {
            if (!json.success) {
                return $price.text('Error');
            }

            const price = parseInt(json.lowest_sell_order, 10) / 100;
            const pricePerThousand = price * 1000 / gemCost;

            $price.text(formatPrice(price.toFixed(2), true) + ' (' + formatPrice(pricePerThousand.toFixed(2), true) + ' for 1000 gems)');
        });
    });
}
