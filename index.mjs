import "dotenv/config";
import XLSX from "xlsx";
import { authenticator } from "otplib";
import { SmartAPI, WebSocket, WebSocketV2 } from "smartapi-javascript";
import fs from "node:fs";
import chalk from "chalk";
import {
  GttIds,
  percentMappings,
  tokensMap,
  investMentCapitalAllowedOneTenth,
  scriptsFormalNames,
  scriptsRealNames,
} from "./config.mjs";
const ChalkSuccess = chalk.green;
const ChalkError = chalk.red;
const ChalkWarning = chalk.yellow;

let smart_api = new SmartAPI({
  api_key: process.env.apiKey, // PROVIDE YOUR API KEY HERE
});

function computeQuantityPortfolioSpecific(
  investMentCapitalAllowedOneTenth,
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

function computeQuantity(
  investMentCapitalAllowedOneTenth,
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

function getMyBuyingAveragePrice(
  script,
  mapMyBuyingAveragePrice,
  scriptsRealNames
) {
  return mapMyBuyingAveragePrice.get(script);
}
function getClosingPrice(script, mapClosingPrices, scriptsRealNames) {
  return mapClosingPrices.get(scriptsRealNames[script]);
}

async function modifyGttOrder(orderDetail, smart_api) {
  console.log("Modifying GTT ORDER !");
  console.log(orderDetail);

  await smart_api.modifyRule(orderDetail);
}

async function modifyGTTAccToYesterdayClose(
  GttIds,
  mapClosingPrices,
  fetchedGtts
) {
  return new Promise((resolve, reject) => {
    console.log(":: Modifying GTT according to Yesterday Close");
    let timeout = 1000;
    let promises = [];
    Object.entries(GttIds.yesterdayClose).forEach(([howMuchPercent, obj]) => {
      Object.entries(obj).forEach(([script, gttID]) => {
        if (gttID) {
          let promise = new Promise((resolve) => {
            setTimeout(() => {
              console.log(`\n:: Processing ${howMuchPercent}`);
              console.log(`:: ${script}: ${gttID}`);
              console.log(":: API req made to modify gtt!");
              modifyGtt(
                gttID,
                script,
                percentMappings.get(howMuchPercent),
                mapClosingPrices,
                fetchedGtts
              );
              resolve();
            }, timeout);
          });

          promises.push(promise);
          timeout += Number(process.env.timeOutDelayBetweenModifyGttReq);
          // now i want to get the yesterday closing price of current script
        }
      });
      // console.log(obj)
    });
    Promise.all(promises)
      .then(() => {
        resolve("processing completed!");
      })
      .catch((err) => {
        reject(err);
      });
    // resolve("processing completed!");
  });
}

async function modifyGTTAccToPortfolio5Percent(
  GttIds,
  mapMyBuyingAveragePrice,
  fetchedGtts,
  holdingsPAndL
) {
  return new Promise((resolve, reject) => {
    console.log(mapMyBuyingAveragePrice);
    console.log(":: Modifying GTT according to Portfolio");
    let timeout = 1000;
    let promises = [];
    Object.entries(GttIds.portfolio).forEach(([howMuchPercent, obj]) => {
      Object.entries(obj).forEach(([script, gttID]) => {
        if (gttID) {
          let promise = new Promise((resolve) => {
            setTimeout(() => {
              console.log(`\n:: Processing ${howMuchPercent}`);
              console.log(`:: ${script}: ${gttID}`);
              console.log(":: API req made to modify gtt!");
              modifyGttAccToPortfolio(
                gttID,
                script,
                percentMappings.get(howMuchPercent),
                mapMyBuyingAveragePrice,
                fetchedGtts,
                holdingsPAndL
              );
              resolve();
            }, timeout);
          });

          promises.push(promise);
          timeout += Number(process.env.timeOutDelayBetweenModifyGttReq);
          // now i want to get the yesterday closing price of current script
        }
      });
      // console.log(obj)
    });
    Promise.all(promises)
      .then(() => {
        resolve("processing completed!");
      })
      .catch((err) => {
        reject(err);
      });
    // resolve("processing completed!");
  });
}
// modifyGTTAccToYesterdayClose(GttIds);

async function initializeTheClosingPriceOfAllScripts(smart_api) {
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

async function fetchActiveGTTs(smart_api) {
  try {
    console.log(":: Fetching Active GTTs And Storing Them into File");
    const response = await smart_api.ruleList({
      status: ["NEW"],
      page: 1,
      count: 100,
    });
    if (!response?.data) {
      throw new Error("Failed to fetch GTTs");
    }
    // now creating map out of it
    const mapOfFetchedGtts = new Map();
    response.data.forEach((gtt) => {
      mapOfFetchedGtts.set(gtt.id, gtt);
    });
    return mapOfFetchedGtts;
  } catch (error) {
    throw error;
  }
}

async function storeFetchedGttsIntoJsonFile(fetchedGtts) {
  try {
    if (process.env.isFetchedGttsStorageIntoJsonFileRequired === "true") {
      console.log("\n:: Saving fetched GTTs into JSON file!");
      // console.log(response.data);
      const fetchedGttsObj = Object.fromEntries(fetchedGtts);
      fs.writeFileSync(
        process.env.jsonFileForStoringActiveFetchedGTTs,
        JSON.stringify(fetchedGttsObj, null, "\t")
      );

      console.log(
        ChalkSuccess(
          `fetched GTTs stored successfully into ${process.env.jsonFileForStoringActiveFetchedGTTs}\n`
        )
      );
    }
  } catch (error) {
    throw error;
  }
}
function roundOffTriggerPrice(triggerPrice) {
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

async function saveIntoExcelFile(mapClosingPrices, holdingsPAndL) {
  // let me crate array of array in the format Script, NSE-Close, OverallG/L
  let data = [];
  data.push(["Script", "NSE-Close", "OverallG/L"]);
  Object.entries(scriptsRealNames).forEach(([scriptName, value]) => {
    data.push([
      scriptName,
      mapClosingPrices.get(scriptsRealNames[scriptName]),
      holdingsPAndL[scriptName] + "%",
    ]);
  });
  console.log(data);
  if (process.env.isFetchingAndSavingClosingAndPLIntoExcelAllowed === "true") {
    try {
      console.log(":: Saving Closing Prices and Overall G/L into excel file!");
      // wrting to excel file
      var ws = XLSX.utils.aoa_to_sheet(data);
      /* create workbook and export */
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      await XLSX.writeFile(wb, process.env.excelFileNameForStoringPAndL);
      console.log(
        ChalkSuccess(
          `G/L Saved Successfully! into ${process.env.excelFileNameForStoringPAndL}\n`
        )
      );
    } catch (error) {
      throw error;
    }
  }
}

async function fetchHoldings(smart_api) {
  try {
    console.log(":: Fetching Holdings");
    let holdings = await smart_api.getHolding();
    if (holdings) {
      holdings = holdings.data;
    } else {
      throw new Error("failed to fetch Holdings");
    }
    return holdings;
  } catch (error) {
    throw error;
  }
}

function fetchMyBuyingAvergePrice(holdings) {
  try {
    console.log(":: Extracting My Buying Average Price from Holdings");
    // creating simple mapping out of it
    const mappingMyBuyingAveragePrice = new Map();
    holdings.forEach((script) => {
      const scriptFormalName = scriptsFormalNames[script.tradingsymbol];
      if (scriptFormalName !== undefined) {
        mappingMyBuyingAveragePrice.set(scriptFormalName, script.averageprice);
      }
    });

    return mappingMyBuyingAveragePrice;
  } catch (error) {
    throw error;
  }
}

function fetchOverallGainLoss(holdings) {
  try {
    console.log(":: Extracting overall Gain/Loss from Holdings");
    // creating simple mapping out of it
    const mappingPAndL = {};
    holdings.forEach((script) => {
      const scriptFormalName = scriptsFormalNames[script.tradingsymbol];
      if (scriptFormalName !== undefined) {
        mappingPAndL[scriptFormalName] = script.pnlpercentage;
      }
    });

    return mappingPAndL;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

function modifyGtt(
  gttID,
  scriptName,
  percentFromPreviousClose,
  mapClosingPrices,
  fetchedGtts
) {
  try {
    const closingPrice = getClosingPrice(
      scriptName,
      mapClosingPrices,
      scriptsRealNames
    );

    // x% from yesterday close
    const xPercent = percentFromPreviousClose / 100;
    const limitPrice = Number(
      (closingPrice - closingPrice * xPercent).toFixed(2)
    );

    const triggerPrice = roundOffTriggerPrice(limitPrice + 0.01);
    // now i want to make sure that trigger price be either .05 or .00 whole number

    const quantity = computeQuantity(
      investMentCapitalAllowedOneTenth,
      scriptName,
      limitPrice,
      xPercent
    );

    console.log(
      `script: ${scriptName} closingPrice: ${closingPrice}, limitPrice: ${limitPrice}, triggerPrice:${triggerPrice}, quantity: ${quantity}`
    );

    const orderDetail = {
      id: gttID,
      symboltoken: tokensMap.get(scriptName),
      exchange: "NSE",
      qty: quantity,
      price: limitPrice,
      triggerprice: triggerPrice,
    };
    // making API Call
    // first let me check is modification actually required?

    let isGttModificationRequired = true;
    try {
      let fetchedGtt = fetchedGtts.get(gttID);
      // console.log(fetchedGtt);
      if (
        fetchedGtt.qty === orderDetail.qty &&
        fetchedGtt.triggerprice === orderDetail.triggerprice &&
        fetchedGtt.price === orderDetail.price
      ) {
        isGttModificationRequired = false;
      }
    } catch (error) {
      console.log(ChalkError(error.message));
      throw error;
    }

    if (isGttModificationRequired) {
      if (process.env.isAllowedToModifyGTTOrders === "true") {
        console.log(".env file allowed to modify GTT!");

        modifyGttOrder(orderDetail, smart_api);
      } else {
        console.log(ChalkWarning("Not allowed to modify GTT, check .env!"));
      }
    } else {
      console.log(ChalkSuccess("GTT modification not required! (skipping)"));
    }
  } catch (error) {
    throw new Error("Failed to modify GTT, ", error.message);
  }
}

function modifyGttAccToPortfolio(
  gttID,
  scriptName,
  percentFromPortfolio,
  mapMyBuyingAveragePrice,
  fetchedGtts,
  holdingsPAndL
) {
  try {
    const myBuyingAveragePrice = getMyBuyingAveragePrice(
      scriptName,
      mapMyBuyingAveragePrice,
      scriptsRealNames
    );

    // x% from portfolio close
    const xPercent = percentFromPortfolio / 100;
    const limitPrice = Number(
      (myBuyingAveragePrice - myBuyingAveragePrice * xPercent).toFixed(2)
    );

    const triggerPrice = roundOffTriggerPrice(limitPrice + 0.01);
    // now i want to make sure that trigger price be either .05 or .00 whole number

    const quantity = computeQuantityPortfolioSpecific(
      investMentCapitalAllowedOneTenth,
      scriptName,
      limitPrice,
      xPercent,
      holdingsPAndL
    );

    console.log(
      `script: ${scriptName}, myBuyingAveragePrice: ${myBuyingAveragePrice}, limitPrice: ${limitPrice}, triggerPrice:${triggerPrice}, quantity: ${quantity}`
    );

    const orderDetail = {
      id: gttID,
      symboltoken: tokensMap.get(scriptName),
      exchange: "NSE",
      qty: quantity,
      price: limitPrice,
      triggerprice: triggerPrice,
    };
    console.log(orderDetail);
    // making API Call
    // first let me check is modification actually required?

    let isGttModificationRequired = true;
    try {
      let fetchedGtt = fetchedGtts.get(gttID);
      // console.log(fetchedGtt);
      if (
        fetchedGtt.qty === orderDetail.qty &&
        fetchedGtt.triggerprice === orderDetail.triggerprice &&
        fetchedGtt.price === orderDetail.price
      ) {
        isGttModificationRequired = false;
      }
    } catch (error) {
      console.log(ChalkError(error.message));
      throw error;
    }

    if (isGttModificationRequired) {
      if (process.env.isAllowedToModifyGTTOrders === "true") {
        console.log(".env file allowed to modify GTT!");

        modifyGttOrder(orderDetail, smart_api);
      } else {
        console.log(ChalkWarning("Not allowed to modify GTT, check .env!"));
      }
    } else {
      console.log(ChalkSuccess("GTT modification not required! (skipping)"));
    }
  } catch (error) {
    console.log(error);
    throw new Error("Failed to modify GTT, ", error.message);
  }
}

async function init() {
  smart_api.setSessionExpiryHook(() => {
    console.log(":: +++++++++++++Logging Out");
  });
  try {
    // authenticate
    await smart_api.generateSession(
      process.env.clientId,
      process.env.mpin,
      authenticator.generate(process.env.totp)
    );

    // return;
    // do the work

    // fetching latest GTTs
    const fetchedGtts = await fetchActiveGTTs(smart_api);

    storeFetchedGttsIntoJsonFile(fetchedGtts);

    // fetching holding
    const holdings = await fetchHoldings(smart_api);

    const holdingsPAndL = fetchOverallGainLoss(holdings);
    // console.log(holdingsPAndL);

    // fetch my buying average price
    const mapMyBuyingAveragePrice = fetchMyBuyingAvergePrice(holdings);

    // Getting closing prices
    console.log(":: Fetching Closing Prices");
    const mapClosingPrices = await initializeTheClosingPriceOfAllScripts(
      smart_api
    );
    // console.log(mapClosingPrices);

    // saving into excel file
    await saveIntoExcelFile(mapClosingPrices, holdingsPAndL);

    // let me try to modify any gtt order
    console.log(":: Modifying GTT");
    await modifyGTTAccToYesterdayClose(GttIds, mapClosingPrices, fetchedGtts);

    await modifyGTTAccToPortfolio5Percent(
      GttIds,
      mapMyBuyingAveragePrice,
      fetchedGtts,
      holdingsPAndL
    );

    console.log("\n:: All done Gracefully !");
  } catch (error) {
    console.log(error);
    console.log(ChalkError("ERROR: ", error.message));
  } finally {
    console.log("logged out!");
    await smart_api.logout(process.env.clientId);
  }
}

init();
