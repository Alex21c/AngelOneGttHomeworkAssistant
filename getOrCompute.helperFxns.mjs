import {
  tokensMap,
  investMentCapitalAllowedOneTenth,
  scriptsRealNames,
  smart_api,
} from "./config.mjs";

export function computeQuantityPortfolioSpecific(
  scriptName,
  limitPrice,
  portfolioPercent,
  holdingsPAndL
) {
  if (!holdingsPAndL[scriptName]) {
    throw new Error(`failed to get holdingPAndL for ${scriptName}`);
  }

  let quantity = investMentCapitalAllowedOneTenth[scriptName] / limitPrice;
  if (portfolioPercent === 0.05) {
    quantity *= 2;
  }

  // safeguard
  if (
    Number(holdingsPAndL[scriptName]) <=
    Number(
      process.env.setQuantityToOneForPortfolioIfClosingIsLessThanEqualToXPercent
    )
  ) {
    return 1;
  }

  return Math.ceil(quantity);
}

export function computeQuantity(
  scriptName,
  limitPrice,
  percentFromYesterdayClose
) {
  // console.log(
  //   investMentCapitalAllowedOneTenth,
  //   limitPrice,
  //   percentFromYesterdayClose
  // );
  let quantity = investMentCapitalAllowedOneTenth[scriptName] / limitPrice;
  if (scriptName === "GoldBees" || scriptName === "SilverBees") {
    if (
      percentFromYesterdayClose === 0.06 ||
      percentFromYesterdayClose === 0.09
    ) {
      quantity *= 2;
    }
  } else {
    if (
      percentFromYesterdayClose === 0.05 ||
      percentFromYesterdayClose === 0.08
    ) {
      quantity *= 2;
    }
  }
  return Math.ceil(quantity);
}

export function getMyBuyingAveragePrice(script, mapMyBuyingAveragePrice) {
  return mapMyBuyingAveragePrice.get(script);
}

export function getClosingPrice(script, mapClosingPrices) {
  return mapClosingPrices.get(scriptsRealNames[script]);
}

// modifyGTTAccToYesterdayClose(GttIds);

export async function initializeTheClosingPriceOfAllScripts() {
  // console.log(smart_api);
  const scriptTokens = [];
  tokensMap.forEach((token, scriptName) => {
    scriptTokens.push(token);
  });

  let response = await smart_api.marketData({
    mode: "OHLC",
    exchangeTokens: {
      NSE: scriptTokens,
    },
  });
  try {
    const closingPrices = response?.data?.fetched;
    // Safeguard
    if (!closingPrices) {
      throw new Error("Unable to fetch Closing prices");
    }

    // creating map out of it
    const mapClosingPrices = new Map();
    closingPrices.forEach((data) => {
      mapClosingPrices.set(data.tradingSymbol, Number(data.ltp));
    });
    return mapClosingPrices;
  } catch (error) {
    throw error;
  }
}

export function roundOffTriggerPrice(triggerPrice) {
  const dataSet = [
    [0.0, 0.05, 0.1],
    [0.11, 0.15, 0.2],
    [0.21, 0.25, 0.3],
    [0.31, 0.35, 0.4],
    [0.41, 0.45, 0.5],
    [0.51, 0.55, 0.6],
    [0.61, 0.65, 0.7],
    [0.71, 0.75, 0.8],
    [0.81, 0.85, 0.9],
    [0.91, 0.95, 1.0],
  ];

  let decimalPart = Number(
    (triggerPrice - Math.floor(triggerPrice)).toFixed(2)
  );

  // now try to find in which part of dataSet does this decimal part lies?
  for (let [low, mid, high] of dataSet) {
    // console.log(low, mid, high);
    if (decimalPart >= low && decimalPart <= high) {
      if (decimalPart === mid || decimalPart === high) {
        break;
      } else if (decimalPart > mid) {
        decimalPart = high;
        break;
      } else if (decimalPart < mid) {
        decimalPart = mid;
        break;
      }
    }
  }

  triggerPrice = Math.floor(triggerPrice) + decimalPart;

  return triggerPrice;
}
